// src/dto/producto.dto.ts
import { z } from "zod";
import {
  CreateProductoSchema,
  UpdateProductoSchema,
  UpdateStockMinimoSchema,
} from "../schemas/producto.schemas";

// Tipos derivados de las schemas (una sola fuente de verdad)
export type CreateProductoDTO = z.infer<typeof CreateProductoSchema>;
export type UpdateProductoDTO = z.infer<typeof UpdateProductoSchema>;

// Validaciones usando Zod (evita lógica duplicada)
export function validarCreateProducto(body: unknown): { ok: true } | { ok: false; errores: string[] } {
  const parsed = CreateProductoSchema.safeParse(body);
  if (parsed.success) return { ok: true };
  return { ok: false, errores: parsed.error.issues.map(i => i.message) };
}

export function validarStockMinimo(body: unknown): { ok: true } | { ok: false; error: string } {
  const parsed = UpdateStockMinimoSchema.safeParse(body);
  if (parsed.success) return { ok: true };
  // Tomamos el primer mensaje para respuesta breve
  const msg = parsed.error.issues[0]?.message || "Dato inválido";
  return { ok: false, error: msg };
}
