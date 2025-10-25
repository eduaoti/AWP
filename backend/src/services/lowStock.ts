// src/services/lowStock.ts  (1 solo correo por ciclo; asuntos sin "Bajo stock")
import { pool } from "../db";
import {
  sendNowOrEnqueue,
  buildSingleProductHtml,
  buildResolvedHtml,
  enqueueLowStockAlertToChief, // ⬅️ nuevo: batch mail
} from "./emailQueue";
import { UsuarioModel } from "../models/usuario.model";

const REMINDER_EVERY_MINUTES = Number(process.env.LOW_STOCK_REMINDER_MINUTES ?? 60);

/** Email del jefe de inventario */
async function getChiefEmail(): Promise<string | null> {
  try {
    return await UsuarioModel.findInventoryChiefEmail();
  } catch {
    return null;
  }
}

type ProductRow = {
  id: number;
  clave: string;
  nombre: string;
  stock_actual: number;  // INTEGER en BD
  stock_minimo: number;  // INTEGER en BD
};

/** Crea/actualiza alertas activas para productos bajo stock (sin depender de endpoints) */
export async function upsertActiveLowStockAlerts(): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const underRes = await client.query<ProductRow>(`
      SELECT id, clave, nombre, stock_actual, stock_minimo
        FROM productos
       WHERE stock_actual < stock_minimo
    `);

    let insertedCount = 0;

    for (const p of underRes.rows) {
      // UPSERT y saber si fue INSERT real
      const upRes = await client.query<{ inserted: boolean }>(
        `
        INSERT INTO low_stock_alerts
          (producto_id, first_detected_at, last_notified_at, next_notify_at,
           times_notified, active, last_stock_actual, last_stock_minimo)
        VALUES ($1, NOW(), NULL, NOW(), 0, TRUE, $2, $3)
        ON CONFLICT (producto_id) WHERE active = TRUE
        DO UPDATE SET
          last_stock_actual = EXCLUDED.last_stock_actual,
          last_stock_minimo = EXCLUDED.last_stock_minimo,
          next_notify_at    = LEAST(low_stock_alerts.next_notify_at, NOW())
        RETURNING (xmax = 0) AS inserted
        `,
        [p.id, p.stock_actual, p.stock_minimo]
      );

      const wasInserted = upRes.rows[0]?.inserted === true;
      if (wasInserted) {
        insertedCount++;
        await client.query(
          `INSERT INTO low_stock_events (producto_id, kind, snapshot)
           VALUES ($1, 'detected', $2::jsonb)`,
          [p.id, JSON.stringify(p)]
        );
      }
    }

    await client.query("COMMIT");
    return insertedCount;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Notifica las alertas vencidas en **un solo correo** y reprograma su siguiente recordatorio */
export async function notifyDueLowStockAlerts(): Promise<number> {
  const chief = await getChiefEmail();
  if (!chief) return 0;

  // Trae las alertas vencidas con los datos del producto
  const { rows } = await pool.query<{
    id: number;
    producto_id: number;
    times_notified: number;
    clave: string;
    nombre: string;
    stock_actual: number;
    stock_minimo: number;
  }>(`
    SELECT a.id, a.producto_id, a.times_notified,
           p.clave, p.nombre, p.stock_actual, p.stock_minimo
      FROM low_stock_alerts a
      JOIN productos p ON p.id = a.producto_id
     WHERE a.active = TRUE
       AND a.next_notify_at <= NOW()
     ORDER BY a.next_notify_at ASC
     LIMIT 200
  `);

  if (!rows.length) return 0;

  // Armamos el lote de productos a incluir en EL correo
  const items = rows.map(r => ({
    id: r.producto_id,
    clave: r.clave,
    nombre: r.nombre,
    stock_actual: r.stock_actual | 0,
    stock_minimo: r.stock_minimo | 0,
    faltante: Math.max(0, (r.stock_minimo | 0) - (r.stock_actual | 0)),
  }));

  // Encola/envida UN solo correo con todos los productos
  await enqueueLowStockAlertToChief(items);

  // Registra evento por cada producto y reprograma cada alerta
  for (const r of rows) {
    await pool.query(
      `INSERT INTO low_stock_events (producto_id, kind, snapshot)
       VALUES ($1, 'reminder', $2::jsonb)`,
      [r.producto_id, JSON.stringify({
        id: r.producto_id,
        clave: r.clave,
        nombre: r.nombre,
        stock_actual: r.stock_actual,
        stock_minimo: r.stock_minimo,
        faltante: Math.max(0, (r.stock_minimo | 0) - (r.stock_actual | 0)),
        batched: true,
      })]
    );

    await pool.query(
      `UPDATE low_stock_alerts
          SET last_notified_at  = NOW(),
              times_notified    = times_notified + 1,
              next_notify_at    = NOW() + make_interval(mins => $2),
              last_stock_actual = $3,
              last_stock_minimo = $4
        WHERE id = $1`,
      [r.id, REMINDER_EVERY_MINUTES, r.stock_actual, r.stock_minimo]
    );
  }

  // devolvemos cuántos productos se incluyeron en el correo
  return items.length;
}

/** Cierra alertas de productos repuestos y avisa */
export async function resolveRecoveredAlerts(): Promise<number> {
  const { rows } = await pool.query<{ id: number; producto_id: number }>(`
    SELECT a.id, a.producto_id
      FROM low_stock_alerts a
      JOIN productos p ON p.id = a.producto_id
     WHERE a.active = TRUE
       AND p.stock_actual >= p.stock_minimo
     LIMIT 200
  `);

  if (!rows.length) return 0;

  const chief = await getChiefEmail();
  let resolved = 0;

  for (const a of rows) {
    const prod = await pool.query<ProductRow>(
      `SELECT id, clave, nombre, stock_actual, stock_minimo
         FROM productos
        WHERE id = $1`,
      [a.producto_id]
    );
    const p = prod.rows[0];

    await pool.query(
      `UPDATE low_stock_alerts
          SET active = FALSE,
              resolved_at = NOW(),
              last_stock_actual = COALESCE($2, last_stock_actual),
              last_stock_minimo = COALESCE($3, last_stock_minimo)
        WHERE id = $1`,
      [a.id, p?.stock_actual ?? null, p?.stock_minimo ?? null]
    );

    await pool.query(
      `INSERT INTO low_stock_events (producto_id, kind, snapshot)
       VALUES ($1, 'resolved', $2::jsonb)`,
      [a.producto_id, JSON.stringify(p ?? {})]
    );

    if (chief && p) {
      // Asunto SIN “Bajo stock”
      const subject = `Inventario normalizado: ${p.clave} – ${p.nombre}`;
      const html = buildResolvedHtml(p.clave, p.nombre, p.stock_actual, p.stock_minimo);
      await sendNowOrEnqueue(chief, subject, html);
    }

    resolved++;
  }

  return resolved;
}

/** Acciones instantáneas desde endpoints (por clave) */
export async function checkAndNotifyByClave(clave: string) {
  const { rows } = await pool.query<ProductRow>(
    `SELECT id, clave, nombre, stock_actual, stock_minimo
       FROM productos
      WHERE clave = $1`,
    [clave]
  );
  const p = rows[0];
  if (!p) return;
  return checkAndNotifyProductRow(p);
}

/** Acciones instantáneas desde endpoints (por nombre) */
export async function checkAndNotifyByNombre(nombre: string) {
  const { rows } = await pool.query<ProductRow>(
    `SELECT id, clave, nombre, stock_actual, stock_minimo
       FROM productos
      WHERE nombre = $1`,
    [nombre]
  );
  const p = rows[0];
  if (!p) return;
  return checkAndNotifyProductRow(p);
}

async function checkAndNotifyProductRow(p: ProductRow) {
  const chief = await getChiefEmail();
  const under = p.stock_actual < p.stock_minimo;

  if (under) {
    // Crea/actualiza alerta y dispara notificación inmediata (solo este producto)
    await pool.query(
      `INSERT INTO low_stock_alerts
        (producto_id, first_detected_at, last_notified_at, next_notify_at,
         times_notified, active, last_stock_actual, last_stock_minimo)
       VALUES ($1, NOW(), NOW(), NOW(), 1, TRUE, $2, $3)
       ON CONFLICT (producto_id) WHERE active = TRUE
       DO UPDATE SET
         last_notified_at  = NOW(),
         next_notify_at    = NOW(),
         times_notified    = low_stock_alerts.times_notified + 1,
         last_stock_actual = EXCLUDED.last_stock_actual,
         last_stock_minimo = EXCLUDED.last_stock_minimo`,
      [p.id, p.stock_actual, p.stock_minimo]
    );

    await pool.query(
      `INSERT INTO low_stock_events (producto_id, kind, snapshot)
       VALUES ($1, 'detected', $2::jsonb)`,
      [p.id, JSON.stringify(p)]
    );

    if (chief) {
      const faltante = p.stock_minimo - p.stock_actual;
      // Asunto SIN “Bajo stock”
      const subject = `Aviso de inventario: ${p.clave} – ${p.nombre} (${p.stock_actual}/${p.stock_minimo})`;
      const html = buildSingleProductHtml(p.clave, p.nombre, p.stock_actual, p.stock_minimo, faltante);
      await sendNowOrEnqueue(chief, subject, html);
    }
  } else {
    // Si estaba activa, ciérrala y avisa
    const { rows: active } = await pool.query<{ id: number }>(
      `SELECT id FROM low_stock_alerts WHERE producto_id = $1 AND active = TRUE`,
      [p.id]
    );

    if (active.length) {
      await pool.query(
        `UPDATE low_stock_alerts
            SET active = FALSE,
                resolved_at = NOW(),
                last_stock_actual = $2,
                last_stock_minimo = $3
          WHERE producto_id = $1
            AND active = TRUE`,
        [p.id, p.stock_actual, p.stock_minimo]
      );

      await pool.query(
        `INSERT INTO low_stock_events (producto_id, kind, snapshot)
         VALUES ($1, 'resolved', $2::jsonb)`,
        [p.id, JSON.stringify(p)]
      );

      if (chief) {
        const subject = `Inventario normalizado: ${p.clave} – ${p.nombre}`;
        const html = buildResolvedHtml(p.clave, p.nombre, p.stock_actual, p.stock_minimo);
        await sendNowOrEnqueue(chief, subject, html);
      }
    }
  }
}
