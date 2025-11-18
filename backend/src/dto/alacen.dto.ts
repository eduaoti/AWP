// src/dto/almacen.dto.ts
import { z } from "zod";
import {
  AlmacenCrearSchema,
  AlmacenActualizarSchema,
  AlmacenEliminarSchema,
} from "../schemas/domain/almacen.schemas";

export type AlmacenCrearDTO = z.infer<typeof AlmacenCrearSchema>;
export type AlmacenActualizarDTO = z.infer<typeof AlmacenActualizarSchema>;
export type AlmacenEliminarDTO = z.infer<typeof AlmacenEliminarSchema>;

function result(parsed: any) {
  return parsed.success
    ? { ok: true, errores: [] as string[] }
    : { ok: false, errores: parsed.error.issues.map((i: any) => i.message) };
}

export function validarAlmacenCrear(body: unknown) {
  return result(AlmacenCrearSchema.safeParse(body));
}

export function validarAlmacenActualizar(body: unknown) {
  return result(AlmacenActualizarSchema.safeParse(body));
}

export function validarAlmacenEliminar(body: unknown) {
  return result(AlmacenEliminarSchema.safeParse(body));
}
