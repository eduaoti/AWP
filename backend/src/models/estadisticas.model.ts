import { pool } from "../db";

/* ===========================================================
   Utils de validación/saneo (estrictas)
   =========================================================== */

const ISO_Z_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/; // ISO-8601 con Z (UTC)

function isBlank(v: unknown) {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

/** Normaliza ISO-Z. Devuelve string ISO o undefined si inválida. */
function normIsoZ(v?: string) {
  if (isBlank(v)) return undefined;
  const s = String(v).trim();
  if (!ISO_Z_REGEX.test(s)) return undefined;
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/**
 * Valida rango (modelo [desde, hasta)) y devuelve:
 * [desdeISO, hastaISO, meta]
 *
 * Reglas:
 * - 'desde' y 'hasta' SON OBLIGATORIOS (no null, no vacíos).
 * - Formato ISO-Z estricto.
 * - Futuro NO permitido.
 * - 'hasta' > 'desde'.
 * - delta ≥ 1s.
 * - rango ≤ 366 días.
 */
function validarRangoFechas(desde?: string, hasta?: string) {
  // obligatorios
  if (isBlank(desde)) {
    const err: any = new Error("desde → Es obligatorio y no puede estar vacío");
    err.status = 400; err.code = "RANGO_FECHAS_INVALIDO"; err.detail = { desde };
    throw err;
  }
  if (isBlank(hasta)) {
    const err: any = new Error("hasta → Es obligatorio y no puede estar vacío");
    err.status = 400; err.code = "RANGO_FECHAS_INVALIDO"; err.detail = { hasta };
    throw err;
  }

  const d = normIsoZ(desde);
  const h = normIsoZ(hasta);
  if (d === undefined) {
    const err: any = new Error("desde → Fecha inválida: formato ISO-8601 con Z requerido (ej. 2025-01-01T00:00:00Z)");
    err.status = 400; err.code = "RANGO_FECHAS_INVALIDO"; err.detail = { desde };
    throw err;
  }
  if (h === undefined) {
    const err: any = new Error("hasta → Fecha inválida: formato ISO-8601 con Z requerido (ej. 2025-02-01T00:00:00Z)");
    err.status = 400; err.code = "RANGO_FECHAS_INVALIDO"; err.detail = { hasta };
    throw err;
  }

  const nowIso = new Date().toISOString();

  // futuro NO permitido
  if (d > nowIso) {
    const err: any = new Error("Rango inválido: 'desde' no puede ser una fecha futura");
    err.status = 400; err.code = "RANGO_FECHAS_INVALIDO"; err.detail = { desde: d, now: nowIso };
    throw err;
  }
  if (h > nowIso) {
    const err: any = new Error("Rango inválido: 'hasta' no puede ser una fecha futura");
    err.status = 400; err.code = "RANGO_FECHAS_INVALIDO"; err.detail = { hasta: h, now: nowIso };
    throw err;
  }

  // orden y tamaño
  if (h <= d) {
    const err: any = new Error("Rango inválido: 'hasta' debe ser mayor que 'desde' (modelo [desde, hasta))");
    err.status = 400; err.code = "RANGO_FECHAS_INVALIDO"; err.detail = { desde: d, hasta: h };
    throw err;
  }

  const deltaMs = new Date(h).getTime() - new Date(d).getTime();
  if (deltaMs < 1000) {
    const err: any = new Error("Rango inválido: la ventana debe ser de al menos 1 segundo");
    err.status = 400; err.code = "RANGO_FECHAS_INVALIDO"; err.detail = { desde: d, hasta: h, deltaMs };
    throw err;
  }
  const dias = deltaMs / (1000 * 60 * 60 * 24);
  if (dias > 366) {
    const err: any = new Error("Rango inválido: la ventana no debe exceder 366 días");
    err.status = 400; err.code = "RANGO_FECHAS_INVALIDO"; err.detail = { desde: d, hasta: h, dias: Math.floor(dias) };
    throw err;
  }

  const meta = { rango_aplicado: { desde: d, hasta: h }, ahora_utc: nowIso };
  return [d, h, meta] as const;
}

/** Valida un entero positivo con límites. */
function validarEnteroPositivo(
  raw: unknown,
  nombre: string,
  { min = 1, max = 1000, defecto = 10 }: { min?: number; max?: number; defecto?: number } = {}
) {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    const err: any = new Error(`${nombre} → Debe ser un entero (sin decimales)`);
    err.status = 400; err.code = "PARAMETRO_INVALIDO"; err.detail = { [nombre]: raw };
    throw err;
  }
  if (n < min) {
    const err: any = new Error(`${nombre} → Debe ser ≥ ${min}`);
    err.status = 400; err.code = "PARAMETRO_INVALIDO"; err.detail = { [nombre]: n, min };
    throw err;
  }
  if (n > max) {
    return { value: max, capped: true, original: n };
  }
  return { value: n, capped: false };
}

/* ===========================================================
   Consultas
   =========================================================== */

/** Total vendido (salidas) por producto (DESC). */
export async function ventasPorProducto(desde?: string, hasta?: string) {
  const [d, h, meta] = validarRangoFechas(desde, hasta);

  try {
    const { rows } = await pool.query(
      `SELECT p.id AS producto_id, p.clave, p.nombre,
              COALESCE(SUM(m.cantidad),0) AS total_vendido
         FROM productos p
    LEFT JOIN movimientos m
           ON m.producto_id = p.id
          AND m.tipo = 'salida'
          AND (m.fecha >= $1)
          AND (m.fecha <  $2)
     GROUP BY p.id, p.clave, p.nombre
       HAVING COALESCE(SUM(m.cantidad),0) > 0
     ORDER BY total_vendido DESC, p.nombre ASC`,
      [d, h]
    );
    return { items: rows, meta };
  } catch (e: any) {
    const err: any = new Error("Error de base de datos al calcular ventas por producto");
    err.status = 500; err.code = "DB_ERROR"; err.detail = { pg: { code: e?.code, detail: e?.detail, message: e?.message } };
    throw err;
  }
}

/** Productos con menor total vendido. */
export async function productosMenorVenta(desde?: string, hasta?: string, limite: unknown = 10) {
  const [d, h, metaRango] = validarRangoFechas(desde, hasta);
  const lim = validarEnteroPositivo(limite, "limite", { min: 1, max: 1000, defecto: 10 });

  try {
    const { rows } = await pool.query(
      `SELECT p.id AS producto_id, p.clave, p.nombre,
              COALESCE(SUM(m.cantidad),0) AS total_vendido
         FROM productos p
    LEFT JOIN movimientos m
           ON m.producto_id = p.id
          AND m.tipo = 'salida'
          AND (m.fecha >= $1)
          AND (m.fecha <  $2)
     GROUP BY p.id, p.clave, p.nombre
     ORDER BY total_vendido ASC, p.nombre ASC
        LIMIT $3`,
      [d, h, lim.value]
    );

    const meta = {
      ...metaRango,
      limite: { aplicado: lim.value, original: lim.capped ? lim.original : lim.value, capped: lim.capped },
    };

    return { items: rows, meta };
  } catch (e: any) {
    const err: any = new Error("Error de base de datos al calcular productos de menor venta");
    err.status = 500; err.code = "DB_ERROR"; err.detail = { pg: { code: e?.code, detail: e?.detail, message: e?.message } };
    throw err;
  }
}

/** Entre los más vendidos (top N): más barato y más caro. */
export async function productosExtremos(desde?: string, hasta?: string, top: unknown = 10) {
  const [d, h, metaRango] = validarRangoFechas(desde, hasta);
  const t = validarEnteroPositivo(top, "top", { min: 1, max: 1000, defecto: 10 });

  try {
    const { rows } = await pool.query(
      `WITH ventas AS (
         SELECT p.id, p.clave, p.nombre, p.precio,
                COALESCE(SUM(m.cantidad),0) AS total_vendido
           FROM productos p
      LEFT JOIN movimientos m
             ON m.producto_id = p.id
            AND m.tipo = 'salida'
            AND (m.fecha >= $1)
            AND (m.fecha <  $2)
       GROUP BY p.id, p.clave, p.nombre, p.precio
       ),
       topn AS (
         SELECT * FROM ventas
          WHERE total_vendido > 0
          ORDER BY total_vendido DESC, nombre ASC
          LIMIT $3
       )
       SELECT
         (SELECT row_to_json(t) FROM (
            SELECT id AS producto_id, clave, nombre, total_vendido, precio AS precio_referencia
              FROM topn ORDER BY precio ASC, nombre ASC LIMIT 1
         ) t) AS mas_barato_mas_vendido,
         (SELECT row_to_json(t) FROM (
            SELECT id AS producto_id, clave, nombre, total_vendido, precio AS precio_referencia
              FROM topn ORDER BY precio DESC, nombre ASC LIMIT 1
         ) t) AS mas_caro_mas_vendido`,
      [d, h, t.value]
    );

    const base = rows[0] ?? { mas_barato_mas_vendido: null, mas_caro_mas_vendido: null };
    const meta = {
      ...metaRango,
      top: { aplicado: t.value, original: t.capped ? t.original : t.value, capped: t.capped },
    };

    return { ...base, meta };
  } catch (e: any) {
    const err: any = new Error("Error de base de datos al calcular productos extremos");
    err.status = 500; err.code = "DB_ERROR"; err.detail = { pg: { code: e?.code, detail: e?.detail, message: e?.message } };
    throw err;
  }
}
