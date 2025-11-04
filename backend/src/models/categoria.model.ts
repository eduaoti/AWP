import { pool } from "../db";
import type { CreateCategoriaDTO, UpdateCategoriaDTO } from "../schemas/domain/categoria.schemas";

export async function crearCategoria(d: CreateCategoriaDTO) {
  const q = `
    INSERT INTO categorias (nombre, descripcion, activo)
    VALUES ($1, $2, COALESCE($3, true))
    RETURNING *`;
  const { rows } = await pool.query(q, [d.nombre, d.descripcion ?? null, d.activo]);
  return rows[0];
}

export async function listarCategorias(qParam?: string) {
  let q = "SELECT * FROM categorias";
  const params: any[] = [];
  if (qParam) {
    q += " WHERE LOWER(nombre) LIKE LOWER($1)";
    params.push(`%${qParam}%`);
  }
  q += " ORDER BY nombre ASC";
  const { rows } = await pool.query(q, params);
  return rows;
}

export async function obtenerPorId(id: number) {
  const { rows } = await pool.query("SELECT * FROM categorias WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function actualizarCategoria(id: number, data: UpdateCategoriaDTO) {
  const campos: string[] = [];
  const valores: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(data)) {
    campos.push(`${k} = $${i++}`);
    valores.push(v);
  }
  if (!campos.length) return obtenerPorId(id);
  const q = `UPDATE categorias SET ${campos.join(", ")}, actualizado_en = NOW()
             WHERE id = $${i} RETURNING *`;
  valores.push(id);
  const { rows } = await pool.query(q, valores);
  return rows[0] ?? null;
}

export async function eliminarCategoria(id: number) {
  const { rows } = await pool.query("DELETE FROM categorias WHERE id = $1 RETURNING *", [id]);
  return rows[0] ?? null;
}
