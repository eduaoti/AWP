// backend/src/models/reportes.model.ts
import { pool } from "../db";

/* ===========================================================
   Utils de validación/saneo (alineados con estadisticas.model)
   =========================================================== */

const ISO_Z_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/; // ISO-8601 con Z (UTC)

function isBlank(v: unknown) {
  return (
    v === null || v === undefined || (typeof v === "string" && v.trim() === "")
  );
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
 * - 'desde' y 'hasta' SON OBLIGATORIOS.
 * - Formato ISO-Z estricto.
 * - Futuro NO permitido.
 * - 'hasta' > 'desde'.
 * - delta ≥ 1s.
 * - rango ≤ 366 días.
 */
function validarRangoFechas(desde?: string, hasta?: string) {
  if (isBlank(desde)) {
    const err: any = new Error(
      "desde → Es obligatorio y no puede estar vacío"
    );
    err.status = 400;
    err.code = "RANGO_FECHAS_INVALIDO";
    err.detail = { desde };
    throw err;
  }
  if (isBlank(hasta)) {
    const err: any = new Error(
      "hasta → Es obligatorio y no puede estar vacío"
    );
    err.status = 400;
    err.code = "RANGO_FECHAS_INVALIDO";
    err.detail = { hasta };
    throw err;
  }

  const d = normIsoZ(desde);
  const h = normIsoZ(hasta);
  if (d === undefined) {
    const err: any = new Error(
      "desde → Fecha inválida: formato ISO-8601 con Z requerido (ej. 2025-01-01T00:00:00Z)"
    );
    err.status = 400;
    err.code = "RANGO_FECHAS_INVALIDO";
    err.detail = { desde };
    throw err;
  }
  if (h === undefined) {
    const err: any = new Error(
      "hasta → Fecha inválida: formato ISO-8601 con Z requerido (ej. 2025-02-01T00:00:00Z)"
    );
    err.status = 400;
    err.code = "RANGO_FECHAS_INVALIDO";
    err.detail = { hasta };
    throw err;
  }

  const nowIso = new Date().toISOString();

  if (d > nowIso) {
    const err: any = new Error(
      "Rango inválido: 'desde' no puede ser una fecha futura"
    );
    err.status = 400;
    err.code = "RANGO_FECHAS_INVALIDO";
    err.detail = { desde: d, now: nowIso };
    throw err;
  }
  if (h > nowIso) {
    const err: any = new Error(
      "Rango inválido: 'hasta' no puede ser una fecha futura"
    );
    err.status = 400;
    err.code = "RANGO_FECHAS_INVALIDO";
    err.detail = { hasta: h, now: nowIso };
    throw err;
  }

  if (h <= d) {
    const err: any = new Error(
      "Rango inválido: 'hasta' debe ser mayor que 'desde' (modelo [desde, hasta))"
    );
    err.status = 400;
    err.code = "RANGO_FECHAS_INVALIDO";
    err.detail = { desde: d, hasta: h };
    throw err;
  }

  const deltaMs = new Date(h).getTime() - new Date(d).getTime();
  if (deltaMs < 1000) {
    const err: any = new Error(
      "Rango inválido: la ventana debe ser de al menos 1 segundo"
    );
    err.status = 400;
    err.code = "RANGO_FECHAS_INVALIDO";
    err.detail = { desde: d, hasta: h, deltaMs };
    throw err;
  }
  const dias = deltaMs / (1000 * 60 * 60 * 24);
  if (dias > 366) {
    const err: any = new Error(
      "Rango inválido: la ventana no debe exceder 366 días"
    );
    err.status = 400;
    err.code = "RANGO_FECHAS_INVALIDO";
    err.detail = { desde: d, hasta: h, dias: Math.floor(dias) };
    throw err;
  }

  const meta = { rango_aplicado: { desde: d, hasta: h }, ahora_utc: nowIso };
  return [d, h, meta] as const;
}

/** Valida un entero positivo con límites. */
function validarEnteroPositivo(
  raw: unknown,
  nombre: string,
  {
    min = 1,
    max = 500,
    defecto = 50,
  }: { min?: number; max?: number; defecto?: number } = {}
) {
  if (isBlank(raw)) {
    return { value: defecto, capped: false };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    const err: any = new Error(`${nombre} → Debe ser un entero (sin decimales)`);
    err.status = 400;
    err.code = "PARAMETRO_INVALIDO";
    err.detail = { [nombre]: raw };
    throw err;
  }
  if (n < min) {
    const err: any = new Error(`${nombre} → Debe ser ≥ ${min}`);
    err.status = 400;
    err.code = "PARAMETRO_INVALIDO";
    err.detail = { [nombre]: n, min };
    throw err;
  }
  if (n > max) {
    return { value: max, capped: true, original: n };
  }
  return { value: n, capped: false };
}

/** Valida y normaliza la clave del producto. */
function validarClaveProducto(raw: unknown) {
  if (isBlank(raw)) {
    const err: any = new Error("producto_clave → Es obligatorio");
    err.status = 400;
    err.code = "PARAMETRO_INVALIDO";
    err.detail = { producto_clave: raw };
    throw err;
  }
  const s = String(raw).trim();
  if (s.length < 1 || s.length > 60) {
    const err: any = new Error(
      "producto_clave → Longitud inválida (1 a 60 caracteres)"
    );
    err.status = 400;
    err.code = "PARAMETRO_INVALIDO";
    err.detail = { producto_clave: s };
    throw err;
  }
  // Patrón razonable: letras, números, guiones, guion bajo, sin espacios raros
  if (!/^[\p{L}\p{N}_\-]+$/u.test(s)) {
    const err: any = new Error(
      "producto_clave → Solo letras, números, guiones y guion bajo (sin espacios)"
    );
    err.status = 400;
    err.code = "PARAMETRO_INVALIDO";
    err.detail = { producto_clave: s };
    throw err;
  }
  return s;
}

/** Asegura que el producto exista y devuelve su fila. */
async function ensureProductoPorClave(clave: string) {
  try {
    const { rows } = await pool.query(
      `SELECT id, clave, nombre, unidad
         FROM productos
        WHERE LOWER(clave) = LOWER($1)
        LIMIT 1`,
      [clave]
    );
    if (!rows[0]) {
      const err: any = new Error("Producto no encontrado para la clave indicada.");
      err.status = 404;
      err.code = "PRODUCTO_NO_ENCONTRADO";
      err.detail = { producto_clave: clave };
      throw err;
    }
    return rows[0];
  } catch (e: any) {
    if (e?.code === "PRODUCTO_NO_ENCONTRADO") throw e;
    const err: any = new Error("Error de base de datos al buscar el producto.");
    err.status = 500;
    err.code = "DB_ERROR";
    err.detail = { pg: { code: e?.code, detail: e?.detail, message: e?.message } };
    throw err;
  }
}

/* ===========================================================
   Reporte: movimientos por producto (E11)
   =========================================================== */

export async function movimientosProducto(params: {
  producto_clave: unknown;
  desde?: string;
  hasta?: string;
  limit?: unknown;
  offset?: unknown;
}) {
  const clave = validarClaveProducto(params.producto_clave);
  const [d, h, metaRango] = validarRangoFechas(params.desde, params.hasta);
  const lim = validarEnteroPositivo(params.limit, "limit", {
    min: 1,
    max: 500,
    defecto: 50,
  });
  const off = validarEnteroPositivo(params.offset, "offset", {
    min: 0,
    max: 10_000_000,
    defecto: 0,
  });

  const producto = await ensureProductoPorClave(clave);

  try {
    // Total de movimientos en el rango
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM movimientos m
        WHERE m.producto_id = $1
          AND (m.fecha >= $2)
          AND (m.fecha <  $3)`,
      [producto.id, d, h]
    );
    const total: number = countRows[0]?.total ?? 0;

    // Lista paginada
    const { rows: items } = await pool.query(
      `SELECT
          m.id,
          m.fecha,
          m.tipo,
          m.cantidad,
          m.documento,
          m.responsable,
          m.proveedor_id,
          m.almacen_id
       FROM movimientos m
       WHERE m.producto_id = $1
         AND (m.fecha >= $2)
         AND (m.fecha <  $3)
       ORDER BY m.fecha DESC, m.id DESC
       LIMIT $4 OFFSET $5`,
      [producto.id, d, h, lim.value, off.value]
    );

    // Resumen entradas/salidas en el rango
    const { rows: resumenRows } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo='entrada' THEN cantidad END),0) AS total_entradas,
         COALESCE(SUM(CASE WHEN tipo='salida'  THEN cantidad END),0) AS total_salidas
       FROM movimientos
      WHERE producto_id = $1
        AND (fecha >= $2)
        AND (fecha <  $3)`,
      [producto.id, d, h]
    );

    const resumen = resumenRows[0] || {
      total_entradas: 0,
      total_salidas: 0,
    };

    const meta = {
      ...metaRango,
      paginacion: {
        total,
        limit: lim.value,
        limit_capped: lim.capped ?? false,
        offset: off.value,
        returned: items.length,
      },
    };

    return {
      producto: {
        id: producto.id,
        clave: producto.clave,
        nombre: producto.nombre,
        unidad: producto.unidad,
      },
      resumen: {
        total_entradas: Number(resumen.total_entradas),
        total_salidas: Number(resumen.total_salidas),
      },
      items,
      meta,
    };
  } catch (e: any) {
    const err: any = new Error(
      "Error de base de datos al obtener movimientos del producto."
    );
    err.status = 500;
    err.code = "DB_ERROR";
    err.detail = { pg: { code: e?.code, detail: e?.detail, message: e?.message } };
    throw err;
  }
}
