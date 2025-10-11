// src/schemas/producto.schemas.ts
import { z } from "zod";

/** Crear producto */
export const CreateProductoSchema = z.object({
  codigo: z.string().min(1, "codigo requerido"),
  nombre: z.string().min(1, "nombre requerido"),
  unidad: z.string().min(1, "unidad requerida"),
  descripcion: z.string().optional(),
  categoria: z.string().optional(),
  // Acepta número o string numérico; por defecto 0 y no negativo
  stock_minimo: z.coerce.number().nonnegative().optional().default(0),
  stock_actual: z.coerce.number().nonnegative().optional().default(0),
});

/** Actualizar producto (al menos un campo) */
export const UpdateProductoSchema = z
  .object({
    codigo: z.string().min(1).optional(),
    nombre: z.string().min(1).optional(),
    unidad: z.string().min(1).optional(),
    descripcion: z.string().optional(),
    categoria: z.string().optional(),
    stock_minimo: z.coerce.number().nonnegative().optional(),
    stock_actual: z.coerce.number().nonnegative().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Sin campos para actualizar",
  });

/** Actualizar solo el stock mínimo (requerido y ≥ 0) */
export const UpdateStockMinimoSchema = z.object({
  stock_minimo: z.coerce.number().nonnegative({
    message: "stock_minimo debe ser ≥ 0",
  }),
});

export type CreateProductoDTO = z.infer<typeof CreateProductoSchema>;
export type UpdateProductoDTO = z.infer<typeof UpdateProductoSchema>;
