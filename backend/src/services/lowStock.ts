import { pool } from "../db";
import { enqueueMail } from "./emailQueue";
import { UsuarioModel } from "../models/usuario.model";

/** Configuración */
const REMINDER_EVERY_MINUTES = Number(process.env.LOW_STOCK_REMINDER_MINUTES ?? 60);

/** Email del jefe de inventario */
async function getChiefEmail(): Promise<string | null> {
  try {
    return await UsuarioModel.findInventoryChiefEmail();
  } catch {
    return null;
  }
}

/** Crea/actualiza alertas activas para productos bajo stock */
export async function upsertActiveLowStockAlerts(): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const underRes = await client.query<{
      id: number; clave: string; nombre: string;
      stock_actual: string; stock_minimo: string;
    }>(
      `SELECT id, clave, nombre, stock_actual, stock_minimo
         FROM productos
        WHERE stock_actual < stock_minimo`
    );

    let touched = 0;

    for (const p of underRes.rows) {
      const ins = await client.query(
        `INSERT INTO low_stock_alerts
          (producto_id, first_detected_at, last_notified_at, next_notify_at,
           times_notified, active, last_stock_actual, last_stock_minimo)
         VALUES ($1, NOW(), NULL, NOW(), 0, TRUE, $2, $3)
         ON CONFLICT (producto_id) WHERE active = TRUE
         DO UPDATE SET
           last_stock_actual = EXCLUDED.last_stock_actual,
           last_stock_minimo = EXCLUDED.last_stock_minimo`,
        [p.id, p.stock_actual, p.stock_minimo]
      );

     if ((ins.rowCount ?? 0) > 0) {
  touched++;
  await client.query(
    `INSERT INTO low_stock_events (producto_id, kind, snapshot)
     VALUES ($1, 'detected', $2::jsonb)`,
    [p.id, JSON.stringify(p)]
  );
}

    }

    await client.query("COMMIT");
    return touched;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Notifica las alertas vencidas y reprograma su siguiente recordatorio */
export async function notifyDueLowStockAlerts(): Promise<number> {
  const chief = await getChiefEmail();
  if (!chief) return 0;

  const { rows } = await pool.query<{
    id: number; producto_id: number; times_notified: number;
  }>(
    `SELECT id, producto_id, times_notified
       FROM low_stock_alerts
      WHERE active = TRUE
        AND next_notify_at <= NOW()
      ORDER BY next_notify_at ASC
      LIMIT 100`
  );

  if (!rows.length) return 0;

  let sent = 0;

  for (const a of rows) {
    const { rows: prodRows } = await pool.query(
      `SELECT clave, nombre, stock_actual, stock_minimo
         FROM productos
        WHERE id = $1`,
      [a.producto_id]
    );
    const p = prodRows[0];

    if (!p) {
      // Producto borrado: cierra alerta
      await pool.query(
        `UPDATE low_stock_alerts
            SET active = FALSE, resolved_at = NOW()
          WHERE id = $1`,
        [a.id]
      );
      continue;
    }

    const faltante = Number(p.stock_minimo) - Number(p.stock_actual);
    const subject =
      a.times_notified === 0
        ? `🚨 Bajo stock: ${p.clave} – ${p.nombre}`
        : `⏰ Recordatorio bajo stock: ${p.clave} – ${p.nombre}`;

    const html = buildSingleProductHtml(
      p.clave, p.nombre, Number(p.stock_actual), Number(p.stock_minimo), faltante
    );

    await enqueueMail(chief, subject, html);
    sent++;

    await pool.query(
      `INSERT INTO low_stock_events (producto_id, kind, snapshot)
       VALUES ($1, 'reminder', $2::jsonb)`,
      [a.producto_id, JSON.stringify({ ...p, faltante })]
    );

    await pool.query(
      `UPDATE low_stock_alerts
          SET last_notified_at = NOW(),
              times_notified   = times_notified + 1,
              next_notify_at   = NOW() + make_interval(mins => $2),
              last_stock_actual = $3,
              last_stock_minimo = $4
        WHERE id = $1`,
      [a.id, REMINDER_EVERY_MINUTES, p.stock_actual, p.stock_minimo]
    );
  }

  return sent;
}

/** Cierra alertas de productos que ya se repusieron y envía correo de “repuesto” */
export async function resolveRecoveredAlerts(): Promise<number> {
  const { rows } = await pool.query<{
    id: number; producto_id: number;
  }>(
    `SELECT a.id, a.producto_id
       FROM low_stock_alerts a
       JOIN productos p ON p.id = a.producto_id
      WHERE a.active = TRUE
        AND p.stock_actual >= p.stock_minimo
      LIMIT 200`
  );

  if (!rows.length) return 0;

  const chief = await getChiefEmail();
  let resolved = 0;

  for (const a of rows) {
    const { rows: prodRows } = await pool.query(
      `SELECT clave, nombre, stock_actual, stock_minimo
         FROM productos
        WHERE id = $1`,
      [a.producto_id]
    );
    const p = prodRows[0];

    await pool.query(
      `UPDATE low_stock_alerts
          SET active = FALSE,
              resolved_at = NOW(),
              last_stock_actual = COALESCE($2, last_stock_actual),
              last_stock_minimo = COALESCE($3, last_stock_minimo)
        WHERE id = $1`,
      [a.id, p?.stock_actual, p?.stock_minimo]
    );

    await pool.query(
      `INSERT INTO low_stock_events (producto_id, kind, snapshot)
       VALUES ($1, 'resolved', $2::jsonb)`,
      [a.producto_id, JSON.stringify(p ?? {})]
    );

    if (chief && p) {
      const html = buildResolvedHtml(
        p.clave, p.nombre, Number(p.stock_actual), Number(p.stock_minimo)
      );
      await enqueueMail(chief, `✅ Stock repuesto: ${p.clave} – ${p.nombre}`, html);
    }

    resolved++;
  }

  return resolved;
}

/** HTML: alerta individual */
function buildSingleProductHtml(clave: string, nombre: string, stockActual: number, stockMinimo: number, faltante: number) {
  const nf = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `
<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial;">
  <h2 style="margin:0 0 8px 0;">Alerta: Bajo stock</h2>
  <p style="margin:0 0 10px 0;">Se detectó un producto con <strong>stock menor al mínimo</strong>.</p>
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
    <tbody>
      <tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Clave</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(clave)}</td></tr>
      <tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Nombre</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(nombre)}</td></tr>
      <tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Stock actual</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${nf.format(stockActual)}</td></tr>
      <tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Stock mínimo</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${nf.format(stockMinimo)}</td></tr>
      <tr><td style="padding:6px 8px;">Faltante</td><td style="padding:6px 8px;text-align:right;"><strong>${nf.format(Math.max(0, faltante))}</strong></td></tr>
    </tbody>
  </table>
  <p style="margin-top:12px;color:#555;">Este aviso se repetirá cada ${REMINDER_EVERY_MINUTES} minutos hasta reponer stock.</p>
</div>`;
}

/** HTML: resuelto */
function buildResolvedHtml(clave: string, nombre: string, stockActual: number, stockMinimo: number) {
  const nf = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `
<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial;">
  <h2 style="margin:0 0 8px 0;">Stock repuesto</h2>
  <p style="margin:0 0 10px 0;">El producto anteriormente bajo stock ya se <strong>rellenó</strong>.</p>
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
    <tbody>
      <tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Clave</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(clave)}</td></tr>
      <tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Nombre</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(nombre)}</td></tr>
      <tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">Stock actual</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${nf.format(stockActual)}</td></tr>
      <tr><td style="padding:6px 8px;">Stock mínimo</td><td style="padding:6px 8px;text-align:right;">${nf.format(stockMinimo)}</td></tr>
    </tbody>
  </table>
  <p style="margin-top:12px;color:#555;">Se detienen los recordatorios para este producto.</p>
</div>`;
}

function escapeHtml(s: string) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
