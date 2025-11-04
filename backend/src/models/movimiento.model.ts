import { pool } from "../db";
import type { MovimientoDTO } from "../schemas/domain/movimiento.schemas";

/* ===========================================================
   Tipos base del modelo
   =========================================================== */
type MovimientoRow = {
  id: number;
  fecha: string; // fecha del movimiento
  tipo: "entrada" | "salida";
  producto_id: number;
  cantidad: number;
  documento?: string | null;
  responsable?: string | null;
  proveedor_id?: number | null; // solo en entradas
  cliente_id?: number | null;   // solo en salidas
};

/* ===========================================================
   Helper: creación de errores consistentes
   =========================================================== */
function apiError(status: number, code: string, message: string, extra?: any) {
  const err: any = new Error(message);
  err.status = status;
  err.code = code;
  if (extra) err.detail = extra;
  return err;
}

/* ===========================================================
   Helper: normalización de textos
   =========================================================== */
function cleanTextOrNull(v?: string | null) {
  const s = typeof v === "string" ? v.normalize("NFKC").trim() : v ?? null;
  return s && s.length ? s : null;
}

/* ===========================================================
   Pre-chequeos de existencia (FKs)
   =========================================================== */
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
   Registrar un movimiento (entrada o salida)
   =========================================================== */
export async function registrarMovimiento(
  data: MovimientoDTO
): Promise<{ movimiento: MovimientoRow; producto: any }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 🔹 1. Obtener producto y bloquear fila para consistencia
    const prod = await getProductoByClaveForUpdate(client, data.producto_clave);

    // 🔹 2. Validar FKs
    const esEntrada = !!data.entrada;
    if (esEntrada) {
      await ensureProveedorIfAny(client, data.proveedor_id ?? null);
    } else {
      await ensureCliente(client, data.cliente_id as number);
    }

    // 🔹 3. Validaciones de cantidad y stock
    const cant = Number(data.cantidad);
    const stockActual = Number(prod.stock_actual);
    if (!esEntrada && cant > stockActual) {
      throw apiError(400, "STOCK_INSUFICIENTE", "Cantidad solicitada excede el stock disponible");
    }

    // 🔹 4. Calcular nuevo stock y actualizar producto
    const nuevoStock = esEntrada ? stockActual + cant : stockActual - cant;
    const { rows: updRows } = await client.query(
      `UPDATE productos
         SET stock_actual = $1, actualizado_en = NOW()
       WHERE id = $2
       RETURNING *`,
      [nuevoStock, prod.id]
    );
    const productoActualizado = updRows[0];

    // 🔹 5. Insertar movimiento con fecha (si no se pasa, usar NOW())
    const { rows: movRows } = await client.query(
      `INSERT INTO movimientos
         (fecha, tipo, producto_id, cantidad, documento, responsable, proveedor_id, cliente_id)
       VALUES
         (COALESCE($1, NOW()), $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.fecha ?? null,
        esEntrada ? "entrada" : "salida",
        prod.id,
        cant,
        cleanTextOrNull(data.documento),
        cleanTextOrNull(data.responsable),
        esEntrada ? data.proveedor_id ?? null : null,
        !esEntrada ? data.cliente_id ?? null : null,
      ]
    );

    await client.query("COMMIT");
    return { movimiento: movRows[0], producto: productoActualizado };
  } catch (e: any) {
    await client.query("ROLLBACK");

    // 🔹 Traducciones específicas de errores SQL
    if (e?.code === "23503") {
      const c = e?.constraint ?? "";
      if (c.includes("movimientos_cliente_id_fkey"))
        throw apiError(404, "NOT_FOUND", "Cliente no encontrado", { constraint: c });
      if (c.includes("movimientos_proveedor_id_fkey"))
        throw apiError(404, "NOT_FOUND", "Proveedor no encontrado", { constraint: c });
      if (c.includes("movimientos_producto_id_fkey"))
        throw apiError(404, "NOT_FOUND", "Producto no encontrado", { constraint: c });
      throw apiError(400, "DB_FK", "Referencia inválida (clave foránea).", { constraint: c });
    }

    if (e?.code === "23514") {
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
   Listar movimientos (GET) con paginación y joins informativos
   =========================================================== */
export async function listarMovimientos(limit = 50, offset = 0) {
  const lim = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 50;
  const off = Number.isFinite(offset) && offset >= 0 ? offset : 0;

  const { rows } = await pool.query(
    `SELECT
        m.id,
        m.fecha,
        m.tipo,
        m.producto_id,
        m.cantidad,
        m.documento,
        m.responsable,
        m.proveedor_id,
        m.cliente_id,
        p.clave       AS producto_clave,
        p.nombre      AS producto_nombre,
        prov.nombre   AS proveedor_nombre,
        cli.nombre    AS cliente_nombre
     FROM movimientos m
     JOIN productos p ON p.id = m.producto_id
     LEFT JOIN proveedores prov ON prov.id = m.proveedor_id
     LEFT JOIN clientes cli ON cli.id = m.cliente_id
     ORDER BY m.fecha DESC, m.id DESC
     LIMIT $1 OFFSET $2`,
    [lim, off]
  );

  return {
    items: rows,
    meta: {
      limit: lim,
      offset: off,
      count: rows.length,
    },
  };
}
