import { z } from "zod";
import {
  nonEmptyTrimmed, noFlood,
  nonNegativeNoMinusZero, alphaUnidad, alphaCategoria
} from "./_helpers";

/** Campos base (manteniendo tus helpers) */
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
}).strict().superRefine((obj, ctx) => {
  if (obj.stock_minimo > obj.stock_actual) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stock_minimo → No puede ser mayor que stock_actual", path: ["stock_minimo"] });
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
}).strict().superRefine((obj, ctx) => {
  if (obj.stock_minimo != null && obj.stock_actual != null && obj.stock_minimo > obj.stock_actual) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stock_minimo → No puede ser mayor que stock_actual", path: ["stock_minimo"] });
  }
}).refine(o => Object.keys(o).length > 0, { message: "Sin campos para actualizar" });

/** Solo actualizar stock mínimo (compat con rutas por path param) */
export const UpdateStockMinimoSchema = z.object({
  stock_minimo: nonNegativeNoMinusZero("stock_minimo")
}).strict();

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
}).strict();

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
}).strict().superRefine((obj, ctx) => {
  // Regla stock_minimo <= stock_actual si vienen ambos
  if (obj.stock_minimo != null && obj.stock_actual != null && obj.stock_minimo > obj.stock_actual) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stock_minimo → No puede ser mayor que stock_actual", path: ["stock_minimo"] });
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
}).strict();

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
}).strict();

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
}).strict().superRefine((obj, ctx) => {
  // Regla stock_minimo <= stock_actual si vienen ambos
  if (obj.stock_minimo != null && obj.stock_actual != null && obj.stock_minimo > obj.stock_actual) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "stock_minimo → No puede ser mayor que stock_actual", path: ["stock_minimo"] });
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
}).strict();
/* ===========================================================
   ✅ NUEVO: Listado paginado JSON-only (reutilizable desde routes)
   =========================================================== */
export const ProductoListInput = z.object({
  page: z.coerce.number()
    .int("page → Debe ser entero")
    .min(1, "page → Debe ser ≥ 1"),
  per_page: z.coerce.number()
    .int("per_page → Debe ser entero")
    .min(1, "per_page → Debe ser ≥ 1")
    .max(100, "per_page → Máximo 100"),
  sort_by: z.enum(["nombre", "precio", "stock_actual", "creado_en"]).optional(),
  sort_dir: z.enum(["asc", "desc"]).optional(),
  q: z.string()
      .trim()
      .min(2, "q → Debe tener al menos 2 caracteres")
      .max(120, "q → Máximo 120 caracteres")
      .optional(),
}).strict();


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

export type ProductoListInputDTO = z.infer<typeof ProductoListInput>;
