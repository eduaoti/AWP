// src/models/proveedor.model.ts
import { pool } from "../db";
import type { CreateProveedorDTO } from "../schemas/proveedor.schemas";

export async function crearProveedor(data: CreateProveedorDTO) {
  const { rows } = await pool.query(
    `INSERT INTO proveedores (nombre, telefono, contacto)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.nombre, data.telefono ?? null, data.contacto ?? null]
  );
  return rows[0];
}

export async function listarProveedores(limit = 100, offset = 0) {
  const { rows } = await pool.query(
    `SELECT * FROM proveedores
      ORDER BY nombre ASC
      LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}
