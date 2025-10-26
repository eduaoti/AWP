// src/schemas/usuarios.schemas.ts
import { z } from "zod";
import { emailStrict, nombrePersona } from "../shared/common";
import { strongPassword } from "../auth/password";

/* ===== Roles permitidos ===== */
export const rolEnum = z.enum(["admin", "editor", "lector", "jefe_inventario"]);

/* ===== Password sin comillas simples ===== */
const passwordSinComillas = strongPassword.regex(/^[^']*$/, {
  message: "El password no debe contener comillas simples (')"
});

/* ===== Crear usuario ===== */
export const crearUsuarioSchema = z.object({
  body: z.object({
    nombre: nombrePersona,
    email: emailStrict,
    password: passwordSinComillas,
    rol: rolEnum
  }).strict()
}).strict();

/* ===== Actualizar usuario ===== */
export const actualizarUsuarioSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive(),
    nombre: nombrePersona,
    email: emailStrict,
    rol: rolEnum
  }).strict()
}).strict();

/* ===== Eliminar usuario ===== */
export const eliminarUsuarioSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive()
  }).strict()
}).strict();

/* ===== Consultar usuario (por id o email) ===== */
export const consultarUsuarioSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive().optional(),
    email: emailStrict.optional()
  }).strict()
  .refine((b) => !!b.id || !!b.email, {
    message: "Debes proporcionar id o email"
  })
}).strict();

/* ===== Listar usuarios (paginado, orden, búsqueda) — JSON body ===== */
export const listarUsuariosSchema = z.object({
  body: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["id", "nombre", "email", "rol", "creado_en"]).default("id"),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().trim().max(80).optional()
  }).strict()
}).strict();

/* ===== Login de usuario ===== */
export const loginSchema = z.object({
  body: z.object({
    email: emailStrict,
    password: passwordSinComillas
  }).strict()
}).strict();
