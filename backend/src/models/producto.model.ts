// src/models/producto.model.ts
import { pool } from "../db";
import type {
  CreateProductoDTO,
  UpdateProductoDTO,
} from "../schemas/producto.schemas";

/* ===========================================================
   CRUD por CÓDIGO (se mantienen)
   =========================================================== */

export async function crearProducto(d: CreateProductoDTO) {
  const q = `INSERT INTO productos (codigo, nombre, descripcion, categoria, unidad, stock_minimo, stock_actual)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`;
  const { rows } = await pool.query(q, [
    d.codigo,
    d.nombre,
    d.descripcion ?? null,
    d.categoria,
    d.unidad,
    d.stock_minimo ?? 0,
    d.stock_actual ?? 0,
  ]);
  return rows[0];
}

export async function actualizarPorCodigo(codigo: string, data: UpdateProductoDTO) {
  const campos: string[] = [];
  const valores: any[] = [];
  let i = 1;

  for (const [k, v] of Object.entries(data)) {
    campos.push(`${k} = $${i++}`);
    valores.push(v);
  }
  if (!campos.length) return obtenerPorCodigo(codigo);

  const q = `UPDATE productos
             SET ${campos.join(", ")}, actualizado_en = NOW()
             WHERE codigo = $${i}
             RETURNING *`;
  valores.push(codigo);

  const { rows } = await pool.query(q, valores);
  return rows[0] ?? null;
}

export async function eliminarPorCodigo(codigo: string) {
  const { rows } = await pool.query(
    `DELETE FROM productos WHERE codigo = $1 RETURNING *`,
    [codigo]
  );
  return rows[0] ?? null;
}

export async function obtenerPorCodigo(codigo: string) {
  const { rows } = await pool.query(
    `SELECT * FROM productos WHERE codigo = $1`,
    [codigo]
  );
  return rows[0] ?? null;
}

export async function actualizarStockMinimoPorCodigo(codigo: string, stockMin: number) {
  const { rows } = await pool.query(
    `UPDATE productos
     SET stock_minimo = $1, actualizado_en = NOW()
     WHERE codigo = $2
     RETURNING *`,
    [stockMin, codigo]
  );
  return rows[0] ?? null;
}

/* ===========================================================
   Listado
   =========================================================== */

export async function listarProductos() {
  const { rows } = await pool.query(
    `SELECT * FROM productos ORDER BY nombre ASC`
  );
  return rows;
}

/* ===========================================================
   ✅ NUEVO: CRUD por NOMBRE (case-insensitive, usa índice LOWER(nombre))
   Estas funciones están pensadas para las rutas JSON-only.
   =========================================================== */

export async function obtenerPorNombre(nombre: string) {
  const { rows } = await pool.query(
    `SELECT * FROM productos WHERE LOWER(nombre) = LOWER($1)`,
    [nombre]
  );
  return rows[0] ?? null;
}

export async function actualizarPorNombre(nombre: string, data: UpdateProductoDTO) {
  const campos: string[] = [];
  const valores: any[] = [];
  let i = 1;

  for (const [k, v] of Object.entries(data)) {
    campos.push(`${k} = $${i++}`);
    valores.push(v);
  }
  if (!campos.length) return obtenerPorNombre(nombre);

  const q = `UPDATE productos
             SET ${campos.join(", ")}, actualizado_en = NOW()
             WHERE LOWER(nombre) = LOWER($${i})
             RETURNING *`;
  valores.push(nombre);

  const { rows } = await pool.query(q, valores);
  return rows[0] ?? null;
}

export async function actualizarStockMinimoPorNombre(nombre: string, stockMin: number) {
  const { rows } = await pool.query(
    `UPDATE productos
     SET stock_minimo = $1, actualizado_en = NOW()
     WHERE LOWER(nombre) = LOWER($2)
     RETURNING *`,
    [stockMin, nombre]
  );
  return rows[0] ?? null;
}

export async function eliminarPorNombre(nombre: string) {
  const { rows } = await pool.query(
    `DELETE FROM productos WHERE LOWER(nombre) = LOWER($1) RETURNING *`,
    [nombre]
  );
  return rows[0] ?? null;
}
