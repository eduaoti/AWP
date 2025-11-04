import { z } from "zod";
import {
  AlmacenCrearSchema,
  AlmacenActualizarSchema,
  AlmacenEliminarSchema,
} from "../schemas/domain/almacen.schemas";

/* ===========================================================
   Tipos derivados de los Schemas Zod
   =========================================================== */
export type AlmacenCrearDTO = z.infer<typeof AlmacenCrearSchema>;
export type AlmacenActualizarDTO = z.infer<typeof AlmacenActualizarSchema>;
export type AlmacenEliminarDTO = z.infer<typeof AlmacenEliminarSchema>;

/* ===========================================================
   Validadores consistentes y seguros
   =========================================================== */

/**
 * Valida los datos para crear un almacén.
 * Siempre devuelve un objeto con la forma:
 * { ok: boolean; errores: string[] }
 */
export function validarAlmacenCrear(body: unknown): { ok: boolean; errores: string[] } {
  const parsed = AlmacenCrearSchema.safeParse(body);
  return parsed.success
    ? { ok: true, errores: [] }
    : { ok: false, errores: parsed.error.issues.map((i) => i.message) };
}

/**
 * Valida los datos para actualizar un almacén.
 */
export function validarAlmacenActualizar(body: unknown): { ok: boolean; errores: string[] } {
  const parsed = AlmacenActualizarSchema.safeParse(body);
  return parsed.success
    ? { ok: true, errores: [] }
    : { ok: false, errores: parsed.error.issues.map((i) => i.message) };
}

/**
 * Valida los datos para eliminar un almacén.
 */
export function validarAlmacenEliminar(body: unknown): { ok: boolean; errores: string[] } {
  const parsed = AlmacenEliminarSchema.safeParse(body);
  return parsed.success
    ? { ok: true, errores: [] }
    : { ok: false, errores: parsed.error.issues.map((i) => i.message) };
}
