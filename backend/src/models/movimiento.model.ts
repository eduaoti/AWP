// backend/src/models/movimiento.model.ts
import { pool } from "../db";
import type { MovimientoDTO } from "../schemas/domain/movimiento.schemas";

/* =========================
   Tipos
   ========================= */
type MovimientoRow = {
  id: number;
  fecha: string;
  tipo: "entrada" | "salida";
  producto_id: number;
  cantidad: number;
  documento?: string | null;
  responsable?: string | null;
  proveedor_id?: number | null; // solo entradas
  cliente_id?: number | null;   // solo salidas
};

/* =========================
   Helpers de error consistentes
   ========================= */
function apiError(status: number, code: string, message: string, extra?: any) {
  const err: any = new Error(message);
  err.status = status;
  err.code = code;
  if (extra) err.detail = extra;
  return err;
}

/* =========================
   Normalizadores suaves
   ========================= */
function cleanTextOrNull(v?: string | null) {
  const s = typeof v === "string" ? v.normalize("NFKC").trim() : v ?? null;
  return s && s.length ? s : null;
}

/* =========================
   Pre-chequeos de existencia
   ========================= */
async function getProductoByClaveForUpdate(client: any, clave: string) {
  const { rows } = await client.query(
    `SELECT * FROM productos WHERE LOWER(clave) = LOWER($1) FOR UPDATE`,
    [clave]
  );
  if (!rows.length) throw apiError(404, "NOT_FOUND", "Producto no encontrado");
  return rows[0];
}

async function ensureProveedorIfAny(client: any, id?: number | null) {
  if (!id) return true;
  const { rows } = await client.query(`SELECT 1 FROM proveedores WHERE id = $1`, [id]);
  if (!rows.length) throw apiError(404, "NOT_FOUND", "Proveedor no encontrado");
  return true;
}

async function ensureCliente(client: any, id: number) {
  const { rows } = await client.query(`SELECT 1 FROM clientes WHERE id = $1`, [id]);
  if (!rows.length) throw apiError(404, "NOT_FOUND", "Cliente no encontrado");
  return true;
}

/* ===========================================================
   ✅ ÚNICO REGISTRO DE MOVIMIENTO (entrada o salida) POR CLAVE
   - entrada: boolean (true=entrada, false=salida)
   - producto_clave: string
   - cantidad: entero > 0
   - documento/responsable opcionales (sanitizados)
   - proveedor_id opcional solo para entrada
   - cliente_id requerido solo para salida
   =========================================================== */
export async function registrarMovimiento(
  data: MovimientoDTO
): Promise<{ movimiento: MovimientoRow; producto: any }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Producto por CLAVE (con lock)
    const prod = await getProductoByClaveForUpdate(client, data.producto_clave);

    // 2) Validaciones condicionales de FK para evitar errores 23503
    const esEntrada = !!data.entrada;
    if (esEntrada) {
      await ensureProveedorIfAny(client, data.proveedor_id ?? null);
    } else {
      await ensureCliente(client, data.cliente_id as number);
    }

    const cant = Number(data.cantidad);
    const stockActual = Number(prod.stock_actual);

    // 3) Regla de negocio para salida: no permitir salidas > stock
    if (!esEntrada && cant > stockActual) {
      throw apiError(400, "STOCK_INSUFICIENTE", "Cantidad solicitada excede el stock disponible");
    }

    // 4) Actualizar stock
    const nuevoStock = esEntrada ? stockActual + cant : stockActual - cant;

    const { rows: updRows } = await client.query(
      `UPDATE productos
         SET stock_actual = $1, actualizado_en = NOW()
       WHERE id = $2
       RETURNING *`,
      [nuevoStock, prod.id]
    );
    const productoActualizado = updRows[0];

    // 5) Insertar movimiento
    if (esEntrada) {
      const { rows: movRows } = await client.query(
        `INSERT INTO movimientos
           (fecha, tipo, producto_id, cantidad, documento, responsable, proveedor_id)
         VALUES
           (COALESCE($1, NOW()), 'entrada', $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.fecha ?? null,
          prod.id,
          cant,
          cleanTextOrNull(data.documento),
          cleanTextOrNull(data.responsable),
          data.proveedor_id ?? null,
        ]
      );
      await client.query("COMMIT");
      return { movimiento: movRows[0], producto: productoActualizado };
    } else {
      const { rows: movRows } = await client.query(
        `INSERT INTO movimientos
           (fecha, tipo, producto_id, cantidad, documento, responsable, cliente_id)
         VALUES
           (COALESCE($1, NOW()), 'salida', $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.fecha ?? null,
          prod.id,
          cant,
          cleanTextOrNull(data.documento),
          cleanTextOrNull(data.responsable),
          data.cliente_id as number,
        ]
      );
      await client.query("COMMIT");
      return { movimiento: movRows[0], producto: productoActualizado };
    }
  } catch (e: any) {
    await client.query("ROLLBACK");

    // Traducciones de errores de BD
    if (e?.code === "23503") {
      const c = e?.constraint ?? "";
      if (c.includes("movimientos_cliente_id_fkey")) {
        throw apiError(404, "NOT_FOUND", "Cliente no encontrado", { constraint: c });
      }
      if (c.includes("movimientos_proveedor_id_fkey")) {
        throw apiError(404, "NOT_FOUND", "Proveedor no encontrado", { constraint: c });
      }
      if (c.includes("movimientos_producto_id_fkey")) {
        throw apiError(404, "NOT_FOUND", "Producto no encontrado", { constraint: c });
      }
      throw apiError(400, "DB_FK", "Referencia inválida (clave foránea).", { constraint: c });
    }
    if (e?.code === "23514") {
      // CHECK constraints (cantidad > 0, etc.)
      throw apiError(
        400,
        "VALIDATION_FAILED",
        "Movimiento inválido: no cumple restricciones (revisa cantidad > 0, etc.)",
        { constraint: e?.constraint }
      );
    }
    if (e?.status) throw e;

    throw apiError(500, "DB_ERROR", "Error de base de datos al registrar movimiento.", e?.message ?? e);
  } finally {
    client.release();
  }
}

/* ===========================================================
   Listado con límites defensivos + joins amigables
   =========================================================== */
export async function listarMovimientos(limit = 50, offset = 0) {
  const lim = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 50;
  const off = Number.isFinite(offset) && offset >= 0 ? offset : 0;

  const { rows } = await pool.query(
    `SELECT
        m.id, m.fecha, m.tipo, m.producto_id, m.cantidad,
        m.documento, m.responsable, m.proveedor_id, m.cliente_id,
        p.clave     AS producto_clave,
        p.nombre    AS producto_nombre,
        prov.nombre AS proveedor_nombre,
        cli.nombre  AS cliente_nombre
     FROM movimientos m
     JOIN productos   p   ON p.id = m.producto_id
     LEFT JOIN proveedores prov ON prov.id = m.proveedor_id
     LEFT JOIN clientes   cli  ON cli.id = m.cliente_id
     ORDER BY m.fecha DESC, m.id DESC
     LIMIT $1 OFFSET $2`,
    [lim, off]
  );
  return rows;
}
