// src/models/movimiento.model.ts
import { pool } from "../db";
import type { MovimientoEntradaDTO, MovimientoSalidaDTO } from "../schemas/movimiento.schemas";

type MovimientoRow = {
  id: number;
  fecha: string;
  tipo: "entrada" | "salida";
  producto_id: number;
  cantidad: number;
  documento?: string | null;
  responsable?: string | null;
  proveedor_id?: number | null; // <-- NUEVO
};

export async function registrarEntrada(data: MovimientoEntradaDTO): Promise<{ movimiento: MovimientoRow; producto: any }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Bloquear producto
    const { rows: prodRows } = await client.query(`SELECT * FROM productos WHERE id = $1 FOR UPDATE`, [data.producto_id]);
    if (prodRows.length === 0) {
      throw Object.assign(new Error("Producto no encontrado"), { status: 404 });
    }
    const prod = prodRows[0];

    // Actualizar stock (suma)
    const nuevoStock = Number(prod.stock_actual) + Number(data.cantidad);
    const { rows: updRows } = await client.query(
      `UPDATE productos SET stock_actual = $1, actualizado_en = NOW() WHERE id = $2 RETURNING *`,
      [nuevoStock, data.producto_id]
    );
    const productoActualizado = updRows[0];

    // Insertar movimiento (NUEVO: proveedor_id)
    const { rows: movRows } = await client.query(
      `INSERT INTO movimientos (fecha, tipo, producto_id, cantidad, documento, responsable, proveedor_id)
       VALUES (COALESCE($1, NOW()), 'entrada', $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.fecha ?? null,
        data.producto_id,
        data.cantidad,
        data.documento ?? null,
        data.responsable ?? null,
        data.proveedor_id ?? null
      ]
    );

    await client.query("COMMIT");
    return { movimiento: movRows[0], producto: productoActualizado };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function registrarSalida(data: MovimientoSalidaDTO): Promise<{ movimiento: MovimientoRow; producto: any }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Bloquear producto
    const { rows: prodRows } = await client.query(`SELECT * FROM productos WHERE id = $1 FOR UPDATE`, [data.producto_id]);
    if (prodRows.length === 0) {
      throw Object.assign(new Error("Producto no encontrado"), { status: 404 });
    }
    const prod = prodRows[0];
    const stockActual = Number(prod.stock_actual);
    const cant = Number(data.cantidad);

    // Regla de negocio: no permitir salidas mayores al stock
    if (cant > stockActual) {
      const err = new Error("Cantidad solicitada excede el stock disponible");
      (err as any).status = 400;
      (err as any).code = "STOCK_INSUFICIENTE";
      throw err;
    }

    // Actualizar stock (resta)
    const nuevoStock = stockActual - cant;
    const { rows: updRows } = await client.query(
      `UPDATE productos SET stock_actual = $1, actualizado_en = NOW() WHERE id = $2 RETURNING *`,
      [nuevoStock, data.producto_id]
    );
    const productoActualizado = updRows[0];

    // Insertar movimiento (sin proveedor)
    const { rows: movRows } = await client.query(
      `INSERT INTO movimientos (fecha, tipo, producto_id, cantidad, documento, responsable)
       VALUES (COALESCE($1, NOW()), 'salida', $2, $3, $4, $5)
       RETURNING *`,
      [data.fecha ?? null, data.producto_id, data.cantidad, data.documento ?? null, data.responsable ?? null]
    );

    await client.query("COMMIT");
    return { movimiento: movRows[0], producto: productoActualizado };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listarMovimientos(limit = 50, offset = 0) {
  const { rows } = await pool.query(
    `SELECT
        m.*,
        p.codigo AS producto_codigo,
        p.nombre AS producto_nombre,
        prov.nombre AS proveedor_nombre
     FROM movimientos m
     JOIN productos p ON p.id = m.producto_id
     LEFT JOIN proveedores prov ON prov.id = m.proveedor_id
     ORDER BY m.fecha DESC, m.id DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}
