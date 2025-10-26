// src/dto/cliente.dto.ts
import { z } from "zod";
import {
  ClienteCrearSchema,
  ClienteActualizarSchema,
  ClienteEliminarSchema,
} from "../schemas/domain/cliente.schemas";

/* ===========================================================
   Tipos derivados directamente de los schemas
   =========================================================== */

export type ClienteCrearDTO = z.infer<typeof ClienteCrearSchema>;
export type ClienteActualizarDTO = z.infer<typeof ClienteActualizarSchema>;
export type ClienteEliminarDTO = z.infer<typeof ClienteEliminarSchema>;

/* ===========================================================
   Validadores reutilizables (según el patrón de producto.dto.ts)
   =========================================================== */

/**
 * Valida el cuerpo recibido para creación de cliente.
 * Retorna { ok: true } si pasa, o { ok: false, errores: string[] } si no.
 */
export function validarClienteCrear(body: unknown): { ok: true } | { ok: false; errores: string[] } {
  const parsed = ClienteCrearSchema.safeParse(body);
  if (parsed.success) return { ok: true };
  return { ok: false, errores: parsed.error.issues.map(i => i.message) };
}

/**
 * Valida el cuerpo recibido para actualización de cliente.
 */
export function validarClienteActualizar(body: unknown): { ok: true } | { ok: false; errores: string[] } {
  const parsed = ClienteActualizarSchema.safeParse(body);
  if (parsed.success) return { ok: true };
  return { ok: false, errores: parsed.error.issues.map(i => i.message) };
}

/**
 * Valida el cuerpo recibido para eliminación de cliente.
 */
export function validarClienteEliminar(body: unknown): { ok: true } | { ok: false; errores: string[] } {
  const parsed = ClienteEliminarSchema.safeParse(body);
  if (parsed.success) return { ok: true };
  return { ok: false, errores: parsed.error.issues.map(i => i.message) };
}
