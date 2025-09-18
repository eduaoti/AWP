import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UsuarioModel } from "../models/usuario.model";

const ROLES_PERMITIDOS = ["admin", "editor", "lector"] as const;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createUser = async (req: Request, res: Response) => {
  const { nombre, email, password, rol } = req.body ?? {};

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Email con formato inválido" });
  }

  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password debe tener al menos 6 caracteres" });
  }

  if (!ROLES_PERMITIDOS.includes(rol)) {
    return res.status(400).json({ error: "Rol inválido. Use: admin | editor | lector" });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const usuario = await UsuarioModel.create(nombre, email, hashed, rol);
    return res.status(201).json(usuario);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(400).json({ error: "El email ya está registrado" });
    }
    console.error("Error creando usuario:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const listUsers = async (_: Request, res: Response) => {
  try {
    const usuarios = await UsuarioModel.findAll();
    return res.json(usuarios);
  } catch (err) {
    console.error("❌ Error listando usuarios:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, email, rol } = req.body ?? {};

  if (!nombre || !email || !rol) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Email inválido" });
  }

  if (!ROLES_PERMITIDOS.includes(rol)) {
    return res.status(400).json({ error: "Rol inválido" });
  }

  try {
    const usuario = await UsuarioModel.update(Number(id), nombre, email, rol);
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json(usuario);
  } catch (err) {
    console.error("❌ Error actualizando usuario:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const usuario = await UsuarioModel.remove(Number(id));
    if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json({ mensaje: "Usuario eliminado", id: usuario.id });
  } catch (err) {
    console.error("❌ Error eliminando usuario:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};
