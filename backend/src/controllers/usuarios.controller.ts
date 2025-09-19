import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UsuarioModel } from "../models/usuario.model";
import { AppCode } from "../status/codes";
import { sendCode, ok } from "../status/respond";

const toUsuarioPublic = (row: any) => ({
  id: row.id,
  nombre: row.nombre,
  email: row.email,
  rol: row.rol,
  creado_en: row.creado_en,
});

export const createUser = async (req: Request, res: Response) => {
  const { nombre, email, password, rol } = req.body;

  const nombreNorm = String(nombre).trim();
  const emailNorm = String(email).trim().toLowerCase();

  const dup = await UsuarioModel.findByEmail(emailNorm);
  if (dup) return sendCode(req, res, AppCode.USER_ALREADY_EXISTS);

  const hashed = await bcrypt.hash(password, 10);
  const row = await UsuarioModel.create(nombreNorm, emailNorm, hashed, rol);
  // 201: éxito con creación
  return sendCode(req, res, AppCode.OK, toUsuarioPublic(row), { httpStatus: 201 });
};

export const listUsers = async (req: Request, res: Response) => {
  const usuarios = await UsuarioModel.findAll();
  return ok(req, res, usuarios.map(toUsuarioPublic));
};

export const updateUser = async (req: Request, res: Response) => {
  const { id, nombre, email, rol } = req.body;
  const row = await UsuarioModel.update(
    Number(id),
    String(nombre).trim(),
    String(email).trim().toLowerCase(),
    rol
  );
  if (!row) return sendCode(req, res, AppCode.USER_NOT_FOUND);
  return ok(req, res, toUsuarioPublic(row));
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.body;
  const row = await UsuarioModel.remove(Number(id));
  if (!row) return sendCode(req, res, AppCode.USER_NOT_FOUND);
  return ok(req, res, { id: row.id, mensaje: "Usuario eliminado" });
};
