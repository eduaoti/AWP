// src/models/producto.model.ts
import { pool } from "../db"; // ajusta el path si tu pool vive en otro archivo
import type { CreateProductoDTO, UpdateProductoDTO } from "../schemas/producto.schemas";

export async function crearProducto(data: CreateProductoDTO) {
  const q = `
    INSERT INTO productos (codigo, nombre, descripcion, categoria, unidad, stock_minimo, stock_actual)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *;
  `;
  const vals = [
    data.codigo,
    data.nombre,
    data.descripcion ?? null,
    data.categoria ?? null,
    data.unidad,
    data.stock_minimo ?? 0,
    data.stock_actual ?? 0,
  ];
  const { rows } = await pool.query(q, vals);
  return rows[0];
}

export async function actualizarProducto(id: number, data: UpdateProductoDTO) {
  const campos: string[] = [];
  const valores: any[] = [];
  let i = 1;

  for (const [k, v] of Object.entries(data)) {
    campos.push(`${k} = $${i++}`);
    valores.push(v);
  }
  if (!campos.length) return obtenerProducto(id);

  const q = `
    UPDATE productos
       SET ${campos.join(", ")},
           actualizado_en = NOW()
     WHERE id = $${i}
     RETURNING *;
  `;
  valores.push(id);
  const { rows } = await pool.query(q, valores);
  return rows[0] ?? null;
}

export async function actualizarStockMinimo(id: number, stockMin: number) {
  const { rows } = await pool.query(
    `UPDATE productos
        SET stock_minimo = $1, actualizado_en = NOW()
      WHERE id = $2
      RETURNING *;`,
    [stockMin, id]
  );
  return rows[0] ?? null;
}

export async function listarProductos() {
  const { rows } = await pool.query(
    `SELECT * FROM productos ORDER BY nombre ASC;`
  );
  return rows;
}

export async function obtenerProducto(id: number) {
  const { rows } = await pool.query(
    `SELECT * FROM productos WHERE id = $1;`,
    [id]
  );
  return rows[0] ?? null;
}
