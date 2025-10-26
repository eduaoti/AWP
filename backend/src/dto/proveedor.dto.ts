// src/dto/proveedor.dto.ts
import { z } from "zod";
import { CreateProveedorSchema } from "../schemas/domain/proveedor.schemas";

/* ===========================================================
   Tipos derivados del schema
   =========================================================== */
export type CreateProveedorDTO = z.infer<typeof CreateProveedorSchema>;

/* ===========================================================
   Validadores reutilizables
   =========================================================== */

/**
 * Valida el cuerpo recibido para creación de proveedor.
 */
export function validarProveedorCrear(body: unknown): { ok: true } | { ok: false; errores: string[] } {
  const parsed = CreateProveedorSchema.safeParse(body);
  if (parsed.success) return { ok: true };
  return { ok: false, errores: parsed.error.issues.map(i => i.message) };
}
