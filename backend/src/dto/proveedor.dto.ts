// src/dto/proveedor.dto.ts
import { z } from "zod";
import { CreateProveedorSchema, UpdateProveedorSchema } from "../schemas/domain/proveedor.schemas";

/* ===========================================================
   Tipos derivados del schema
   =========================================================== */
export type CreateProveedorDTO = z.infer<typeof CreateProveedorSchema>;
export type UpdateProveedorDTO = z.infer<typeof UpdateProveedorSchema>;

/* ===========================================================
   Validadores reutilizables
   =========================================================== */

/**
 * Valida el cuerpo recibido para creación de proveedor.
 */
export function validarProveedorCrear(
  body: unknown
): { ok: true; value: CreateProveedorDTO } | { ok: false; errores: string[] } {
  const parsed = CreateProveedorSchema.safeParse(body);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, errores: parsed.error.issues.map((i) => i.message) };
}

/**
 * Valida el cuerpo + id recibido para actualización de proveedor.
 * (El id se inyecta desde params en el controller).
 */
export function validarProveedorActualizar(
  body: unknown
): { ok: true; value: UpdateProveedorDTO } | { ok: false; errores: string[] } {
  const parsed = UpdateProveedorSchema.safeParse(body);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, errores: parsed.error.issues.map((i) => i.message) };
}
