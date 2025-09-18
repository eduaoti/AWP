import { z } from "zod";
import { emailNorm, nombrePersona } from "./common";
import { strongPassword } from "./password";

export const rolEnum = z.enum(["admin", "editor", "lector"]);

export const crearUsuarioSchema = z.object({
  body: z.object({
    nombre: nombrePersona,
    email: emailNorm,
    password: strongPassword,
    rol: rolEnum
  }).strict()
}).strict();

export const actualizarUsuarioSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive(),
    nombre: nombrePersona,
    email: emailNorm,
    rol: rolEnum
  }).strict()
}).strict();

export const eliminarUsuarioSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive()
  }).strict()
}).strict();

export const consultarUsuarioSchema = z.object({
  body: z.object({
    id: z.coerce.number().int().positive().optional(),
    email: emailNorm.optional()
  })
  .strict()
  .refine(b => !!b.id || !!b.email, { message: "Proporciona id o email" })
}).strict();

export const loginSchema = z.object({
  body: z.object({
    email: emailNorm,
    password: strongPassword
  }).strict()
}).strict();
