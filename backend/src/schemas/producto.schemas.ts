// src/schemas/producto.schemas.ts
import { z } from "zod";
import {
  nonEmptyTrimmed, noFlood,
  nonNegativeNoMinusZero, alphaUnidad, alphaCategoria
} from "./_helpers";

/** Campos base */
const Nombre = nonEmptyTrimmed(2, 120, "nombre").and(noFlood("nombre"));
const Descripcion = z.string()
  .default("")
  .transform(v => v.trim())
  .refine(v => v.length <= 240, { message: "descripcion → No debe exceder 240 caracteres" })
  .refine(v => !/(.)\1{4,}/.test(v), { message: "descripcion → Contenido ambiguo o repetitivo" });

const Codigo = nonEmptyTrimmed(1, 60, "codigo");

/** Crear producto */
export const CreateProductoSchema = z.object({
  codigo: Codigo,
  nombre: Nombre,
  unidad: alphaUnidad,
  descripcion: Descripcion.optional(),
  categoria: alphaCategoria,                          // OBLIGATORIA
  stock_minimo: nonNegativeNoMinusZero("stock_minimo").default(0),
  stock_actual: nonNegativeNoMinusZero("stock_actual").default(0),
}).superRefine((obj, ctx) => {
  if (obj.stock_minimo > obj.stock_actual) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stock_minimo → No puede ser mayor que stock_actual" });
  }
});

/** Actualización genérica (por código/ID según la ruta que uses) */
export const UpdateProductoSchema = z.object({
  codigo: Codigo.optional(),
  nombre: Nombre.optional(),
  unidad: alphaUnidad.optional(),
  descripcion: Descripcion.optional(),
  categoria: alphaCategoria.optional(),
  stock_minimo: nonNegativeNoMinusZero("stock_minimo").optional(),
  stock_actual: nonNegativeNoMinusZero("stock_actual").optional(),
}).superRefine((obj, ctx) => {
  if (obj.stock_minimo != null && obj.stock_actual != null && obj.stock_minimo > obj.stock_actual) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stock_minimo → No puede ser mayor que stock_actual" });
  }
}).refine(o => Object.keys(o).length > 0, { message: "Sin campos para actualizar" });

/** Solo actualizar stock mínimo (rutas por código/ID) */
export const UpdateStockMinimoSchema = z.object({
  stock_minimo: nonNegativeNoMinusZero("stock_minimo")
});

/* ===========================================================
   ✅ NUEVO: Esquemas para rutas JSON-only que operan POR NOMBRE
   - POST   /productos/obtener       { nombre }
   - PUT    /productos/actualizar    { nombre, ...campos }
   - PUT    /productos/stock-minimo  { nombre, stock_minimo }
   - DELETE /productos/eliminar      { nombre }
   =========================================================== */

/** Identificar por nombre (obtener/eliminar) */
export const IdPorNombreSchema = z.object({
  nombre: Nombre
});

/** Actualizar por nombre (exige al menos 1 campo a actualizar además del nombre) */
export const UpdatePorNombreSchema = z.object({
  nombre: Nombre,
  codigo: Codigo.optional(),
  unidad: alphaUnidad.optional(),
  descripcion: Descripcion.optional(),
  categoria: alphaCategoria.optional(),
  stock_minimo: nonNegativeNoMinusZero("stock_minimo").optional(),
  stock_actual: nonNegativeNoMinusZero("stock_actual").optional(),
}).superRefine((obj, ctx) => {
  // Regla stock_minimo <= stock_actual si vienen ambos
  if (obj.stock_minimo != null && obj.stock_actual != null && obj.stock_minimo > obj.stock_actual) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stock_minimo → No puede ser mayor que stock_actual" });
  }
  // Debe traer al menos un campo actualizable aparte de 'nombre'
  const { nombre, ...rest } = obj as Record<string, unknown>;
  const tieneAlgo = Object.values(rest).some(v => v !== undefined);
  if (!tieneAlgo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debes incluir al menos un campo para actualizar" });
  }
});

/** Actualizar stock mínimo por nombre */
export const UpdateStockMinimoPorNombreSchema = z.object({
  nombre: Nombre,
  stock_minimo: nonNegativeNoMinusZero("stock_minimo")
});

/** Tipos */
export type CreateProductoDTO = z.infer<typeof CreateProductoSchema>;
export type UpdateProductoDTO = z.infer<typeof UpdateProductoSchema>;
export type UpdateStockMinimoDTO = z.infer<typeof UpdateStockMinimoSchema>;

export type IdPorNombreDTO = z.infer<typeof IdPorNombreSchema>;
export type UpdatePorNombreDTO = z.infer<typeof UpdatePorNombreSchema>;
export type UpdateStockMinimoPorNombreDTO = z.infer<typeof UpdateStockMinimoPorNombreSchema>;
