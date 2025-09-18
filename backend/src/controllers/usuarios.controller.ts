import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UsuarioModel } from "../models/usuario.model";

// Serializer para no exponer password
const toUsuarioPublic = (row: any) => ({
  id: row.id,
  nombre: row.nombre,
  email: row.email,
  rol: row.rol,
  creado_en: row.creado_en,
});

/**
 * NOTA IMPORTANTE:
 * Ya NO validamos aquí (ni regex, ni rol, ni password mínima).
 * Eso lo hace Zod en los esquemas (crearUsuarioSchema, etc.).
 * Aquí solo normalizamos, ejecutamos negocio y devolvemos DTO.
 */

export const createUser = async (req: Request, res: Response) => {
  const { nombre, email, password, rol } = req.body;

  // Normalización mínima (Zod ya transformó email a lower-case si seguiste el esquema mostrado)
  const nombreNorm = String(nombre).trim();
  const emailNorm = String(email).trim().toLowerCase();

  // Pre-chequeo amigable (además del UNIQUE de DB)
  const dup = await UsuarioModel.findByEmail(emailNorm);
  if (dup) return res.status(400).json({ error: "El email ya está registrado" });

  const hashed = await bcrypt.hash(password, 10);
  const row = await UsuarioModel.create(nombreNorm, emailNorm, hashed, rol);
  return res.status(201).json(toUsuarioPublic(row));
};

export const listUsers = async (_: Request, res: Response) => {
  const usuarios = await UsuarioModel.findAll();
  return res.json(usuarios.map(toUsuarioPublic));
};

export const updateUser = async (req: Request, res: Response) => {
  const { id, nombre, email, rol } = req.body;

  const nombreNorm = String(nombre).trim();
  const emailNorm = String(email).trim().toLowerCase();

  const row = await UsuarioModel.update(Number(id), nombreNorm, emailNorm, rol);
  if (!row) return res.status(404).json({ error: "Usuario no encontrado" });

  return res.json(toUsuarioPublic(row));
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.body;
  const row = await UsuarioModel.remove(Number(id));
  if (!row) return res.status(404).json({ error: "Usuario no encontrado" });
  return res.json({ mensaje: "Usuario eliminado", id: row.id });
};
