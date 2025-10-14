// src/models/estadisticas.model.ts
import { pool } from "../db";

/* ===========================================================
   Utils de validación/saneo
   =========================================================== */

function isBlank(v: unknown) {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

/** Acepta string ISO/fecha; devuelve string ISO normalizada o null. */
function normTsOrNull(v?: string) {
  if (isBlank(v)) return null;
  const s = String(v).trim();
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined; // inválida
  return d.toISOString();
}

/** Valida rango de fechas (inclusive-exclusive) y devuelve tupla [desdeISO|null, hastaISO|null]. */
function validarRangoFechas(desde?: string, hasta?: string) {
  const d = normTsOrNull(desde);
  const h = normTsOrNull(hasta);

  if (d === undefined) {
    const err: any = new Error("desde → Fecha inválida: usa ISO-8601 (p. ej. 2025-01-01T00:00:00Z)");
    err.status = 400; err.code = "RANGO_FECHAS_INVALIDO"; err.detail = { desde };
    throw err;
  }
  if (h === undefined) {
    const err: any = new Error("hasta → Fecha inválida: usa ISO-8601 (p. ej. 2025-02-01T00:00:00Z)");
    err.status = 400; err.code = "RANGO_FECHAS_INVALIDO"; err.detail = { hasta };
    throw err;
  }
  if (d && h && d >= h) {
    const err: any = new Error("Rango de fechas inválido: 'hasta' debe ser mayor que 'desde' (modelo [desde, hasta))");
    err.status = 400; err.code = "RANGO_FECHAS_INVALIDO"; err.detail = { desde: d, hasta: h };
    throw err;
  }
  return [d ?? null, h ?? null] as const;
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
    // En lugar de error duro, capamos a max y dejamos traza
    return { value: max, capped: true, original: n };
  }
  return { value: n, capped: false };
}

/* ===========================================================
   Consultas
   =========================================================== */

/**
 * Total vendido (salidas) por producto, orden DESC.
 * - Valida rango de fechas ISO.
 * - Devuelve solo productos con total > 0.
 */
export async function ventasPorProducto(desde?: string, hasta?: string) {
  const [d, h] = validarRangoFechas(desde, hasta);

  try {
    const { rows } = await pool.query(
      `SELECT p.id AS producto_id, p.clave, p.nombre,
              COALESCE(SUM(m.cantidad),0) AS total_vendido
         FROM productos p
    LEFT JOIN movimientos m
           ON m.producto_id = p.id
          AND m.tipo = 'salida'
          AND ($1::timestamptz IS NULL OR m.fecha >= $1)
          AND ($2::timestamptz IS NULL OR m.fecha <  $2)
     GROUP BY p.id, p.clave, p.nombre
       HAVING COALESCE(SUM(m.cantidad),0) > 0
     ORDER BY total_vendido DESC, p.nombre ASC`,
      [d, h]
    );
    return rows;
  } catch (e: any) {
    const err: any = new Error("Error de base de datos al calcular ventas por producto");
    err.status = 500; err.code = "DB_ERROR"; err.detail = { pg: { code: e?.code, detail: e?.detail, message: e?.message } };
    throw err;
  }
}

/**
 * Productos con menor total vendido (salidas) en el rango.
 * - Valida rango ISO.
 * - 'limite' entero positivo (1..1000). Si sobrepasa, se capa a 1000.
 */
export async function productosMenorVenta(desde?: string, hasta?: string, limite: unknown = 10) {
  const [d, h] = validarRangoFechas(desde, hasta);
  const lim = validarEnteroPositivo(limite, "limite", { min: 1, max: 1000, defecto: 10 });

  try {
    const { rows } = await pool.query(
      `SELECT p.id AS producto_id, p.clave, p.nombre,
              COALESCE(SUM(m.cantidad),0) AS total_vendido
         FROM productos p
    LEFT JOIN movimientos m
           ON m.producto_id = p.id
          AND m.tipo = 'salida'
          AND ($1::timestamptz IS NULL OR m.fecha >= $1)
          AND ($2::timestamptz IS NULL OR m.fecha <  $2)
     GROUP BY p.id, p.clave, p.nombre
     ORDER BY total_vendido ASC, p.nombre ASC
        LIMIT $3`,
      [d, h, lim.value]
    );

    // Si capamos el límite, devolvemos meta para diagnóstico (sin romper compat)
    return lim.capped ? { items: rows, meta: { limite_aplicado: lim.value, limite_original: lim.original } } : rows;
  } catch (e: any) {
    const err: any = new Error("Error de base de datos al calcular productos de menor venta");
    err.status = 500; err.code = "DB_ERROR"; err.detail = { pg: { code: e?.code, detail: e?.detail, message: e?.message } };
    throw err;
  }
}

/**
 * Entre los más vendidos (top N), devuelve:
 *  - mas_barato_mas_vendido
 *  - mas_caro_mas_vendido
 * - Valida rango ISO.
 * - 'top' entero positivo (1..1000). Si sobrepasa, se capa a 1000.
 */
export async function productosExtremos(desde?: string, hasta?: string, top: unknown = 10) {
  const [d, h] = validarRangoFechas(desde, hasta);
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
            AND ($1::timestamptz IS NULL OR m.fecha >= $1)
            AND ($2::timestamptz IS NULL OR m.fecha <  $2)
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
            SELECT id AS producto_id, clave, nombre, total_vendido, precio
              FROM topn ORDER BY precio ASC, nombre ASC LIMIT 1
         ) t) AS mas_barato_mas_vendido,
         (SELECT row_to_json(t) FROM (
            SELECT id AS producto_id, clave, nombre, total_vendido, precio
              FROM topn ORDER BY precio DESC, nombre ASC LIMIT 1
         ) t) AS mas_caro_mas_vendido`,
      [d, h, t.value]
    );

    const base = rows[0] ?? { mas_barato_mas_vendido: null, mas_caro_mas_vendido: null };
    // Adjuntamos meta si capamos top (no rompe contratos existentes porque es opcional)
    return t.capped ? { ...base, meta: { top_aplicado: t.value, top_original: t.original } } : base;
  } catch (e: any) {
    const err: any = new Error("Error de base de datos al calcular productos extremos");
    err.status = 500; err.code = "DB_ERROR"; err.detail = { pg: { code: e?.code, detail: e?.detail, message: e?.message } };
    throw err;
  }
}
