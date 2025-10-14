// src/models/producto.model.ts
import { pool } from "../db";
import type {
  CreateProductoDTO,
  UpdateProductoDTO,
} from "../schemas/producto.schemas";

/** Obtiene la clave a partir del DTO, aceptando clave o codigo por compat. */
function getClaveFromDTO(d: Partial<CreateProductoDTO | UpdateProductoDTO>) {
  return (d as any).clave ?? (d as any).codigo;
}

/* ===========================================================
   CRUD por CLAVE (columna 'clave' en la BD)
   =========================================================== */

export async function crearProducto(d: CreateProductoDTO) {
  const clave = getClaveFromDTO(d);
  const q = `INSERT INTO productos (clave, nombre, descripcion, categoria, unidad, stock_minimo, stock_actual)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`;
  const { rows } = await pool.query(q, [
    clave,
    d.nombre,
    d.descripcion ?? null,
    d.categoria,
    d.unidad,
    d.stock_minimo ?? 0,
    d.stock_actual ?? 0,
  ]);
  return rows[0];
}

export async function actualizarPorClave(clave: string, data: UpdateProductoDTO) {
  const campos: string[] = [];
  const valores: any[] = [];
  let i = 1;

  for (const [k, v] of Object.entries(data)) {
    // Evitar que intenten cambiar la clave desde aquí
    if (k === "codigo" || k === "clave") continue;
    campos.push(`${k} = $${i++}`);
    valores.push(v);
  }
  if (!campos.length) return obtenerPorClave(clave);

  const q = `UPDATE productos
             SET ${campos.join(", ")}, actualizado_en = NOW()
             WHERE clave = $${i}
             RETURNING *`;
  valores.push(clave);

  const { rows } = await pool.query(q, valores);
  return rows[0] ?? null;
}

export async function eliminarPorClave(clave: string) {
  const { rows } = await pool.query(
    `DELETE FROM productos WHERE clave = $1 RETURNING *`,
    [clave]
  );
  return rows[0] ?? null;
}

export async function obtenerPorClave(clave: string) {
  const { rows } = await pool.query(
    `SELECT * FROM productos WHERE clave = $1`,
    [clave]
  );
  return rows[0] ?? null;
}

export async function actualizarStockMinimoPorClave(clave: string, stockMin: number) {
  const { rows } = await pool.query(
    `UPDATE productos
     SET stock_minimo = $1, actualizado_en = NOW()
     WHERE clave = $2
     RETURNING *`,
    [stockMin, clave]
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

/** 🚨 Alertas: productos con stock bajo (stock_actual < stock_minimo) */
export async function listarProductosBajoStock() {
  const { rows } = await pool.query(
    `SELECT * FROM productos
     WHERE stock_actual < stock_minimo
     ORDER BY (stock_minimo - stock_actual) DESC, nombre ASC`
  );
  return rows;
}

/* ===========================================================
   CRUD por NOMBRE (case-insensitive, usa índice LOWER(nombre))
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
    if (k === "codigo") continue; // permitir cambiar 'clave' aquí (según el esquema), pero no 'codigo' legacy
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

/* ===========================================================
   🔁 COMPATIBILIDAD: alias *PorCodigo → *PorClave (DEPRECADO)
   =========================================================== */

export async function actualizarPorCodigo(codigo: string, data: UpdateProductoDTO) {
  return actualizarPorClave(codigo, data);
}

export async function eliminarPorCodigo(codigo: string) {
  return eliminarPorClave(codigo);
}

export async function obtenerPorCodigo(codigo: string) {
  return obtenerPorClave(codigo);
}

export async function actualizarStockMinimoPorCodigo(codigo: string, stockMin: number) {
  return actualizarStockMinimoPorClave(codigo, stockMin);
}
