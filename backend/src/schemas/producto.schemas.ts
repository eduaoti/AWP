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

/** 👉 Ahora 'clave' sustituye a 'codigo' */
const Clave = nonEmptyTrimmed(1, 60, "clave");

/** Crear producto (usa CLAVE) */
export const CreateProductoSchema = z.object({
  clave: Clave,
  nombre: Nombre,
  unidad: alphaUnidad,
  descripcion: Descripcion.optional(),
  categoria: alphaCategoria,                          // OBLIGATORIA
  precio: nonNegativeNoMinusZero("precio").default(0),
  stock_minimo: nonNegativeNoMinusZero("stock_minimo").default(0),
  stock_actual: nonNegativeNoMinusZero("stock_actual").default(0),
}).superRefine((obj, ctx) => {
  if (obj.stock_minimo > obj.stock_actual) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stock_minimo → No puede ser mayor que stock_actual" });
  }
});

/** Actualización genérica (compat con rutas por clave en path param)
 *  No requiere 'clave' en el body; se actualizan campos normales. */
export const UpdateProductoSchema = z.object({
  nombre: Nombre.optional(),
  unidad: alphaUnidad.optional(),
  descripcion: Descripcion.optional(),
  categoria: alphaCategoria.optional(),
  precio: nonNegativeNoMinusZero("precio").optional(),
  stock_minimo: nonNegativeNoMinusZero("stock_minimo").optional(),
  stock_actual: nonNegativeNoMinusZero("stock_actual").optional(),
}).superRefine((obj, ctx) => {
  if (obj.stock_minimo != null && obj.stock_actual != null && obj.stock_minimo > obj.stock_actual) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stock_minimo → No puede ser mayor que stock_actual" });
  }
}).refine(o => Object.keys(o).length > 0, { message: "Sin campos para actualizar" });

/** Solo actualizar stock mínimo (compat con rutas por path param) */
export const UpdateStockMinimoSchema = z.object({
  stock_minimo: nonNegativeNoMinusZero("stock_minimo")
});

/* ===========================================================
   ✅ NUEVO: Esquemas para rutas JSON-only que operan POR CLAVE
   - POST   /productos/clave/obtener         { clave }
   - PUT    /productos/clave/actualizar      { clave, ...campos }
   - PUT    /productos/clave/stock-minimo    { clave, stock_minimo }
   - DELETE /productos/clave/eliminar        { clave }
   =========================================================== */

/** Identificar por clave (obtener/eliminar) */
export const IdPorClaveSchema = z.object({
  clave: Clave
});

/** Actualizar por clave (exige al menos 1 campo a actualizar además de la clave) */
export const UpdatePorClaveSchema = z.object({
  clave: Clave,
  // No permitimos cambiar la propia 'clave' aquí
  nombre: Nombre.optional(),
  unidad: alphaUnidad.optional(),
  descripcion: Descripcion.optional(),
  categoria: alphaCategoria.optional(),
  precio: nonNegativeNoMinusZero("precio").optional(),
  stock_minimo: nonNegativeNoMinusZero("stock_minimo").optional(),
  stock_actual: nonNegativeNoMinusZero("stock_actual").optional(),
}).superRefine((obj, ctx) => {
  // Regla stock_minimo <= stock_actual si vienen ambos
  if (obj.stock_minimo != null && obj.stock_actual != null && obj.stock_minimo > obj.stock_actual) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stock_minimo → No puede ser mayor que stock_actual" });
  }
  // Debe traer al menos un campo actualizable aparte de 'clave'
  const { clave, ...rest } = obj as Record<string, unknown>;
  const tieneAlgo = Object.values(rest).some(v => v !== undefined);
  if (!tieneAlgo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debes incluir al menos un campo para actualizar" });
  }
});

/** Actualizar stock mínimo por clave */
export const UpdateStockMinimoPorClaveSchema = z.object({
  clave: Clave,
  stock_minimo: nonNegativeNoMinusZero("stock_minimo")
});

/* ===========================================================
   ✅ EXISTENTES: Esquemas para rutas JSON-only que operan POR NOMBRE
   - POST   /productos/obtener       { nombre }
   - PUT    /productos/actualizar    { nombre, ...campos }
   - PUT    /productos/stock-minimo  { nombre, stock_minimo }
   - DELETE /productos/eliminar      { nombre }
   =========================================================== */

/** Identificar por nombre (obtener/eliminar) */
export const IdPorNombreSchema = z.object({
  nombre: Nombre
});

/** Actualizar por nombre (exige al menos 1 campo a actualizar además del nombre)
 *  Aquí sí permitimos opcionalmente cambiar la 'clave'. */
export const UpdatePorNombreSchema = z.object({
  nombre: Nombre,
  clave: Clave.optional(),
  unidad: alphaUnidad.optional(),
  descripcion: Descripcion.optional(),
  categoria: alphaCategoria.optional(),
  precio: nonNegativeNoMinusZero("precio").optional(),
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

export type IdPorClaveDTO = z.infer<typeof IdPorClaveSchema>;
export type UpdatePorClaveDTO = z.infer<typeof UpdatePorClaveSchema>;
export type UpdateStockMinimoPorClaveDTO = z.infer<typeof UpdateStockMinimoPorClaveSchema>;

export type IdPorNombreDTO = z.infer<typeof IdPorNombreSchema>;
export type UpdatePorNombreDTO = z.infer<typeof UpdatePorNombreSchema>;
export type UpdateStockMinimoPorNombreDTO = z.infer<typeof UpdateStockMinimoPorNombreSchema>;
