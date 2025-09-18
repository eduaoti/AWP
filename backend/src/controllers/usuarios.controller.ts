import { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import bcrypt from "bcrypt";

export const listUsers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query("SELECT id,nombre,email,rol,creado_en FROM usuarios ORDER BY id");
    res.json(rows);
  } catch (e) { next(e); }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, email, password, rol } = req.body as { nombre: string; email: string; password: string; rol: "admin"|"editor"|"lector" };
    if (!nombre || !email || !password || !rol) return res.status(400).json({ error: "nombre, email, password y rol son requeridos" });
    const hash = await bcrypt.hash(password, 10);
    const q = `INSERT INTO usuarios(nombre,email,password,rol)
               VALUES ($1,$2,$3,$4) RETURNING id,nombre,email,rol,creado_en`;
    const { rows } = await pool.query(q, [nombre, email, hash, rol]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query("DELETE FROM usuarios WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, email, rol } = req.body as Partial<{nombre:string; email:string; rol:"admin"|"editor"|"lector"}>;
    const q = `UPDATE usuarios SET nombre=COALESCE($1,nombre),
                                   email=COALESCE($2,email),
                                   rol=COALESCE($3,rol)
              WHERE id=$4 RETURNING id,nombre,email,rol,creado_en`;
    const { rows } = await pool.query(q, [nombre, email, rol, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(rows[0]);
  } catch (e) { next(e); }
};
