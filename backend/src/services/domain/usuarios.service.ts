// src/services/domain/usuarios.service.ts
import bcrypt from "bcryptjs";
import { UsuarioModel } from "../../models/usuario.model";
import { toUsuarioPublic } from "../../dto/usuario.dto";

type CrearUsuarioInput = {
  nombre: string;
  email: string;
  password: string;
  rol: "admin" | "editor" | "lector" | "jefe_inventario";
};

type ActualizarUsuarioInput = {
  id: number;
  nombre: string;
  email: string;
  rol: "admin" | "editor" | "lector" | "jefe_inventario";
};

export async function crearUsuario(input: CrearUsuarioInput) {
  const nombre = String(input.nombre).trim();
  const email = String(input.email).trim().toLowerCase();

  const dup = await UsuarioModel.findByEmail(email);
  if (dup) {
    const err: any = new Error("El email ya está registrado");
    err.status = 409;
    err.code = "USER_ALREADY_EXISTS";
    throw err;
  }

  const hashed = await bcrypt.hash(input.password, 10);
  const row = await UsuarioModel.create(nombre, email, hashed, input.rol);
  return toUsuarioPublic(row);
}

export async function listarUsuarios() {
  const rows = await UsuarioModel.findAll();
  return rows.map(toUsuarioPublic);
}

export async function actualizarUsuario(input: ActualizarUsuarioInput) {
  const id = Number(input.id);
  const nombre = String(input.nombre).trim();
  const email = String(input.email).trim().toLowerCase();

  const row = await UsuarioModel.update(id, nombre, email, input.rol);
  if (!row) {
    const err: any = new Error("Usuario no encontrado");
    err.status = 404;
    err.code = "USER_NOT_FOUND";
    throw err;
  }
  return toUsuarioPublic(row);
}

export async function eliminarUsuario(id: number) {
  const row = await UsuarioModel.remove(Number(id));
  if (!row) {
    const err: any = new Error("Usuario no encontrado");
    err.status = 404;
    err.code = "USER_NOT_FOUND";
    throw err;
  }
  return { id: row.id };
}

// Helpers opcionales
export async function obtenerUsuarioPorId(id: number) {
  const row = await UsuarioModel.findById(id);
  return row ? toUsuarioPublic(row) : null;
}

export async function obtenerUsuarioPorEmail(email: string) {
  const row = await UsuarioModel.findByEmail(String(email).trim().toLowerCase());
  return row ? toUsuarioPublic(row) : null;
}
