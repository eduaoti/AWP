// src/models/movimiento.model.ts
import { pool } from "../db";
import type {
  MovimientoEntradaDTO,
  MovimientoSalidaDTO,
} from "../schemas/movimiento.schemas";

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
  cliente_id?: number | null;   // solo salidas (E10)
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
async function ensureProducto(client: any, id: number) {
  const { rows } = await client.query(`SELECT * FROM productos WHERE id = $1 FOR UPDATE`, [id]);
  if (!rows.length) throw apiError(404, "NOT_FOUND", "Producto no encontrado");
  return rows[0];
}

async function ensureProveedorIfAny(client: any, id?: number | null) {
  if (!id) return true;
  const { rows } = await client.query(`SELECT 1 FROM proveedores WHERE id = $1`, [id]);
  if (!rows.length) {
    throw apiError(404, "NOT_FOUND", "Proveedor no encontrado");
  }
  return true;
}

async function ensureCliente(client: any, id: number) {
  const { rows } = await client.query(`SELECT 1 FROM clientes WHERE id = $1`, [id]);
  if (!rows.length) throw apiError(404, "NOT_FOUND", "Cliente no encontrado");
  return true;
}

/* ===========================================================
   ENTRADA
   - Valida producto
   - (Opcional) valida proveedor para evitar FK 23503
   - Suma stock_actual
   - Inserta movimiento
   =========================================================== */
export async function registrarEntrada(
  data: MovimientoEntradaDTO
): Promise<{ movimiento: MovimientoRow; producto: any }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Producto (lock) o 404
    const prod = await ensureProducto(client, data.producto_id);

    // Proveedor (si viene) o 404
    await ensureProveedorIfAny(client, data.proveedor_id ?? null);

    // Actualizar stock (suma)
    const nuevoStock = Number(prod.stock_actual) + Number(data.cantidad);
    const { rows: updRows } = await client.query(
      `UPDATE productos
         SET stock_actual = $1, actualizado_en = NOW()
       WHERE id = $2
       RETURNING *`,
      [nuevoStock, data.producto_id]
    );
    const productoActualizado = updRows[0];

    // Insertar movimiento
    const { rows: movRows } = await client.query(
      `INSERT INTO movimientos
         (fecha, tipo, producto_id, cantidad, documento, responsable, proveedor_id)
       VALUES
         (COALESCE($1, NOW()), 'entrada', $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.fecha ?? null,
        data.producto_id,
        data.cantidad,
        cleanTextOrNull(data.documento),
        cleanTextOrNull(data.responsable),
        data.proveedor_id ?? null,
      ]
    );

    await client.query("COMMIT");
    return { movimiento: movRows[0], producto: productoActualizado };
  } catch (e: any) {
    await client.query("ROLLBACK");

    // Mapeo fino de errores de BD
    if (e?.code === "23503") {
      // Violación FK (por si el prechequeo no cubrió)
      const c = e?.constraint ?? "";
      if (c.includes("movimientos_proveedor_id_fkey")) {
        throw apiError(404, "NOT_FOUND", "Proveedor no encontrado", { constraint: c });
      }
      if (c.includes("movimientos_producto_id_fkey")) {
        throw apiError(404, "NOT_FOUND", "Producto no encontrado", { constraint: c });
      }
      throw apiError(400, "DB_FK", "Referencia inválida en movimiento (clave foránea).", { constraint: c });
    }
    if (e?.code === "23514") {
      // CHECK constraints (cantidad > 0, etc.)
      throw apiError(400, "VALIDATION_FAILED", "Movimiento inválido: no cumple restricciones (revisa cantidad > 0, tipo, etc.)", { constraint: e?.constraint });
    }
    if (e?.status) throw e;

    throw apiError(500, "DB_ERROR", "Error de base de datos al registrar entrada.", e?.message ?? e);
  } finally {
    client.release();
  }
}

/* ===========================================================
   SALIDA
   - Valida producto
   - Valida cliente (requerido por esquema)
   - Verifica stock suficiente; si no, 400 + code STOCK_INSUFICIENTE
   - Resta stock_actual
   - Inserta movimiento
   =========================================================== */
export async function registrarSalida(
  data: MovimientoSalidaDTO
): Promise<{ movimiento: MovimientoRow; producto: any }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Producto (lock) o 404
    const prod = await ensureProducto(client, data.producto_id);

    // Cliente requerido (esquema) pero validamos existencia para evitar FK
    await ensureCliente(client, data.cliente_id);

    const stockActual = Number(prod.stock_actual);
    const cant = Number(data.cantidad);

    // Regla de negocio: no permitir salidas mayores al stock
    if (cant > stockActual) {
      throw apiError(
        400,
        "STOCK_INSUFICIENTE",
        "Cantidad solicitada excede el stock disponible"
      );
    }

    // Actualizar stock (resta)
    const nuevoStock = stockActual - cant;
    const { rows: updRows } = await client.query(
      `UPDATE productos
         SET stock_actual = $1, actualizado_en = NOW()
       WHERE id = $2
       RETURNING *`,
      [nuevoStock, data.producto_id]
    );
    const productoActualizado = updRows[0];

    // Insertar movimiento
    const { rows: movRows } = await client.query(
      `INSERT INTO movimientos
         (fecha, tipo, producto_id, cantidad, documento, responsable, cliente_id)
       VALUES
         (COALESCE($1, NOW()), 'salida', $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.fecha ?? null,
        data.producto_id,
        data.cantidad,
        cleanTextOrNull(data.documento),
        cleanTextOrNull(data.responsable),
        data.cliente_id,
      ]
    );

    await client.query("COMMIT");
    return { movimiento: movRows[0], producto: productoActualizado };
  } catch (e: any) {
    await client.query("ROLLBACK");

    if (e?.code === "23503") {
      const c = e?.constraint ?? "";
      if (c.includes("movimientos_cliente_id_fkey")) {
        throw apiError(404, "NOT_FOUND", "Cliente no encontrado", { constraint: c });
      }
      if (c.includes("movimientos_producto_id_fkey")) {
        throw apiError(404, "NOT_FOUND", "Producto no encontrado", { constraint: c });
      }
      throw apiError(400, "DB_FK", "Referencia inválida en movimiento (clave foránea).", { constraint: c });
    }
    if (e?.code === "23514") {
      throw apiError(400, "VALIDATION_FAILED", "Movimiento inválido: no cumple restricciones (revisa cantidad > 0, tipo, etc.)", { constraint: e?.constraint });
    }
    if (e?.status) throw e;

    throw apiError(500, "DB_ERROR", "Error de base de datos al registrar salida.", e?.message ?? e);
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
