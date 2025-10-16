// src/schemas/producto.schemas.ts
import { z } from "zod";
import {
  nonEmptyTrimmed,
  noFlood,
  nonNegativeNoMinusZero,
  alphaUnidad,
  alphaCategoria,
} from "./_helpers";

/* ===========================================================
   🧱 Campos base
   =========================================================== */

const Nombre = nonEmptyTrimmed(2, 120, "nombre").and(noFlood("nombre"));

const Descripcion = z
  .string()
  .default("")
  .transform((v) => v.trim())
  .refine((v) => v.length <= 240, {
    message: "descripcion → No debe exceder 240 caracteres",
  })
  .refine((v) => !/(.)\1{4,}/.test(v), {
    message: "descripcion → Contenido ambiguo o repetitivo",
  });

/** 👉 'clave' sustituye a 'codigo' */
const Clave = nonEmptyTrimmed(1, 60, "clave");

/* ===========================================================
   ✨ Crear producto
   =========================================================== */

export const CreateProductoSchema = z
  .object({
    clave: Clave,
    nombre: Nombre,
    unidad: alphaUnidad,
    descripcion: Descripcion.optional(),
    categoria: alphaCategoria, // OBLIGATORIA
    precio: nonNegativeNoMinusZero("precio").default(0),
    stock_minimo: nonNegativeNoMinusZero("stock_minimo").default(0),
    stock_actual: nonNegativeNoMinusZero("stock_actual").default(0),
  })
  .strict()
  .superRefine((obj, ctx) => {
    if (obj.stock_minimo > obj.stock_actual) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "stock_minimo → No puede ser mayor que stock_actual",
        path: ["stock_minimo"],
      });
    }
  });

/* ===========================================================
   ✨ Actualización genérica (por clave en path param)
   =========================================================== */

export const UpdateProductoSchema = z
  .object({
    nombre: Nombre.optional(),
    unidad: alphaUnidad.optional(),
    descripcion: Descripcion.optional(),
    categoria: alphaCategoria.optional(),
    precio: nonNegativeNoMinusZero("precio").optional(),
    stock_minimo: nonNegativeNoMinusZero("stock_minimo").optional(),
    stock_actual: nonNegativeNoMinusZero("stock_actual").optional(),
  })
  .strict()
  .superRefine((obj, ctx) => {
    if (
      obj.stock_minimo != null &&
      obj.stock_actual != null &&
      obj.stock_minimo > obj.stock_actual
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "stock_minimo → No puede ser mayor que stock_actual",
        path: ["stock_minimo"],
      });
    }
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "Sin campos para actualizar",
  });

/* ===========================================================
   ✨ Solo actualizar stock mínimo
   =========================================================== */

export const UpdateStockMinimoSchema = z
  .object({
    stock_minimo: nonNegativeNoMinusZero("stock_minimo"),
  })
  .strict();

/* ===========================================================
   ✅ Rutas JSON-only POR CLAVE
   =========================================================== */

export const IdPorClaveSchema = z
  .object({
    clave: Clave,
  })
  .strict();

export const UpdatePorClaveSchema = z
  .object({
    clave: Clave, // no se permite cambiar aquí
    nombre: Nombre.optional(),
    unidad: alphaUnidad.optional(),
    descripcion: Descripcion.optional(),
    categoria: alphaCategoria.optional(),
    precio: nonNegativeNoMinusZero("precio").optional(),
    stock_minimo: nonNegativeNoMinusZero("stock_minimo").optional(),
    stock_actual: nonNegativeNoMinusZero("stock_actual").optional(),
  })
  .strict()
  .superRefine((obj, ctx) => {
    if (
      obj.stock_minimo != null &&
      obj.stock_actual != null &&
      obj.stock_minimo > obj.stock_actual
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "stock_minimo → No puede ser mayor que stock_actual",
        path: ["stock_minimo"],
      });
    }
    const { clave, ...rest } = obj as Record<string, unknown>;
    const tieneAlgo = Object.values(rest).some((v) => v !== undefined);
    if (!tieneAlgo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes incluir al menos un campo para actualizar",
      });
    }
  });

export const UpdateStockMinimoPorClaveSchema = z
  .object({
    clave: Clave,
    stock_minimo: nonNegativeNoMinusZero("stock_minimo"),
  })
  .strict();

/* ===========================================================
   ✅ Rutas JSON-only POR NOMBRE
   =========================================================== */

export const IdPorNombreSchema = z
  .object({
    nombre: Nombre,
  })
  .strict();

export const UpdatePorNombreSchema = z
  .object({
    nombre: Nombre,
    clave: Clave.optional(), // permitido aquí
    unidad: alphaUnidad.optional(),
    descripcion: Descripcion.optional(),
    categoria: alphaCategoria.optional(),
    precio: nonNegativeNoMinusZero("precio").optional(),
    stock_minimo: nonNegativeNoMinusZero("stock_minimo").optional(),
    stock_actual: nonNegativeNoMinusZero("stock_actual").optional(),
  })
  .strict()
  .superRefine((obj, ctx) => {
    if (
      obj.stock_minimo != null &&
      obj.stock_actual != null &&
      obj.stock_minimo > obj.stock_actual
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "stock_minimo → No puede ser mayor que stock_actual",
        path: ["stock_minimo"],
      });
    }
    const { nombre, ...rest } = obj as Record<string, unknown>;
    const tieneAlgo = Object.values(rest).some((v) => v !== undefined);
    if (!tieneAlgo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes incluir al menos un campo para actualizar",
      });
    }
  });

export const UpdateStockMinimoPorNombreSchema = z
  .object({
    nombre: Nombre,
    stock_minimo: nonNegativeNoMinusZero("stock_minimo"),
  })
  .strict();

/* ===========================================================
   ✅ Listado paginado (POST /productos/listar)
   =========================================================== */

export const ProductoListInput = z
  .object({
    page: z.coerce
      .number()
      .int("page → Debe ser entero")
      .min(1, "page → Debe ser ≥ 1"),
    per_page: z.coerce
      .number()
      .int("per_page → Debe ser entero")
      .min(1, "per_page → Debe ser ≥ 1")
      .max(100, "per_page → Máximo 100"),
    sort_by: z
      .enum(["nombre", "precio", "stock_actual", "creado_en"])
      .optional(),
    sort_dir: z.enum(["asc", "desc"]).optional(),
    q: z
      .string()
      .trim()
      .min(2, "q → Debe tener al menos 2 caracteres")
      .max(120, "q → Máximo 120 caracteres")
      .optional(),
  })
  .strict();

/* ===========================================================
   ✅ GET unificado: /productos/findbycontainerignorecase
   - Todo por QUERY STRING.
   - Acepta clave y/o nombre vacíos ("") para indicar “no filtrar”.
   - Case-insensitive y coincidencia EXACTA si se envía valor.
   - Mantiene paginación/ordenamiento.
   =========================================================== */

export const ProductoFindQuerySchema = z
  .object({
    // Permite "" o string; se normaliza/trim
    clave: z
      .string()
      .optional()
      .transform((v) => (v ?? "").trim())
      .refine((v) => v.length <= 60, {
        message: "clave → Máximo 60 caracteres",
      }),
    nombre: z
      .string()
      .optional()
      .transform((v) => (v ?? "").trim())
      .refine((v) => v.length <= 120, {
        message: "nombre → Máximo 120 caracteres",
      }),
    page: z
      .coerce.number()
      .int("page → Debe ser entero")
      .min(1, "page → Debe ser ≥ 1")
      .default(1),
    per_page: z
      .coerce.number()
      .int("per_page → Debe ser entero")
      .min(1, "per_page → Debe ser ≥ 1")
      .max(100, "per_page → Máximo 100")
      .default(20),
    sort_by: z
      .enum(["nombre", "precio", "stock_actual", "creado_en"])
      .optional(),
    sort_dir: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

/* ===========================================================
   📦 Tipos
   =========================================================== */

export type CreateProductoDTO = z.infer<typeof CreateProductoSchema>;
export type UpdateProductoDTO = z.infer<typeof UpdateProductoSchema>;
export type UpdateStockMinimoDTO = z.infer<typeof UpdateStockMinimoSchema>;

export type IdPorClaveDTO = z.infer<typeof IdPorClaveSchema>;
export type UpdatePorClaveDTO = z.infer<typeof UpdatePorClaveSchema>;
export type UpdateStockMinimoPorClaveDTO = z.infer<
  typeof UpdateStockMinimoPorClaveSchema
>;

export type IdPorNombreDTO = z.infer<typeof IdPorNombreSchema>;
export type UpdatePorNombreDTO = z.infer<typeof UpdatePorNombreSchema>;
export type UpdateStockMinimoPorNombreDTO = z.infer<
  typeof UpdateStockMinimoPorNombreSchema
>;

export type ProductoListInputDTO = z.infer<typeof ProductoListInput>;
export type ProductoFindQueryDTO = z.infer<typeof ProductoFindQuerySchema>;
