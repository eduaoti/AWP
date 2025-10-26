// src/schemas/producto.schemas.ts
import { z } from "zod";
import {
  safeText,
  noFlood,
  positiveMoney,
  nonNegativeInt,
  alphaUnidad,
  alphaCategoria,
  claveStrict,
} from "../shared/_helpers";

/* ===========================================================
   🔧 Helper: permite "" (sin filtro) o valida con el schema dado
   =========================================================== */
const emptyOr = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.union([z.literal(""), schema])
  );

/* ===========================================================
   🧱 Campos base (endurecidos)
   =========================================================== */

/** Nombre: texto seguro, 3–120, sin HTML/JS, sin floods */
const Nombre = safeText("nombre", 3, 120).and(noFlood("nombre"));

/** Descripción: opcional, trim/collapse, ≤ 240, sin HTML/JS ni floods */
const Descripcion = z
  // Normaliza: si es string → trim; si no, deja tal cual (para que .optional() funcione)
  .preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string())
  // Convierte a ZodString para poder usar .max/.refine con types correctos
  .pipe(
    z
      .string()
      .max(240, { message: "descripcion → No debe exceder 240 caracteres" })
      .refine((v: string) => !/<[^>]*>|<|>|&lt;|&gt;/i.test(v), {
        message: "descripcion → HTML/JS no permitido",
      })
      .refine(
        (v: string) => !/(script|onerror|onload|onclick|onmouseover|javascript:)/i.test(v),
        { message: "descripcion → Contenido potencialmente peligroso" }
      )
      .refine((v: string) => !/(.)\1{4,}/.test(v), {
        message: "descripcion → Contenido ambiguo o repetitivo",
      })
  )
  .optional();


/** 👉 'clave' estricta: solo [A-Za-z0-9-], sin “--”, sin iniciar/terminar con -, máx 10 */
const Clave = claveStrict("clave", 10);

/* ===========================================================
   ✨ Crear producto
   =========================================================== */

export const CreateProductoSchema = z
  .object({
    clave: Clave,
    nombre: Nombre,
    unidad: alphaUnidad,                        // validación/normalización
    descripcion: Descripcion,                   // opcional ya arriba
    categoria: alphaCategoria,                  // OBLIGATORIA (segura)
    precio: positiveMoney("precio"),            // > 0, 2 decimales, tope razonable
    stock_minimo: nonNegativeInt("stock_minimo"), // entero ≥ 0
    stock_actual: nonNegativeInt("stock_actual"), // entero ≥ 0
  })
  .strict()
  .superRefine((obj, ctx) => {
    // coherencia de stock
    if (obj.stock_minimo > obj.stock_actual) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "stock_minimo → No puede ser mayor que stock_actual",
        path: ["stock_minimo"],
      });
    }
    // nombre no debe ser solo dígitos/guiones ni idéntico a la clave
    if (/^[\d-]+$/.test(obj.nombre)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "nombre → Debe contener letras (no solo dígitos/guiones)",
        path: ["nombre"],
      });
    }
    if (obj.nombre.toLowerCase() === obj.clave.toLowerCase()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "nombre → No debe ser idéntico a la clave",
        path: ["nombre"],
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
    descripcion: Descripcion, // ya es optional arriba
    categoria: alphaCategoria.optional(),
    precio: positiveMoney("precio").optional(),
    stock_minimo: nonNegativeInt("stock_minimo").optional(),
    stock_actual: nonNegativeInt("stock_actual").optional(),
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
        message: "stock_minimo → No puede ser mayor que stock_actual",
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
    stock_minimo: nonNegativeInt("stock_minimo"),
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
    descripcion: Descripcion,
    categoria: alphaCategoria.optional(),
    precio: positiveMoney("precio").optional(),
    stock_minimo: nonNegativeInt("stock_minimo").optional(),
    stock_actual: nonNegativeInt("stock_actual").optional(),
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
        message: "stock_minimo → No puede ser mayor que stock_actual",
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
    stock_minimo: nonNegativeInt("stock_minimo"),
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
    descripcion: Descripcion,
    categoria: alphaCategoria.optional(),
    precio: positiveMoney("precio").optional(),
    stock_minimo: nonNegativeInt("stock_minimo").optional(),
    stock_actual: nonNegativeInt("stock_actual").optional(),
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
        message: "stock_minimo → No puede ser mayor que stock_actual",
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
    stock_minimo: nonNegativeInt("stock_minimo"),
  })
  .strict();

/* ===========================================================
   ✅ Listado paginado (POST /productos/listar)
   =========================================================== */

export const ProductoListInput = z
  .object({
    page: z.coerce.number().int().min(1, "page → Debe ser ≥ 1"),
    per_page: z
      .coerce.number()
      .int()
      .min(1, "per_page → Debe ser ≥ 1")
      .max(100, "per_page → Máximo 100"),
    sort_by: z.enum(["nombre", "precio", "stock_actual", "creado_en"]).optional(),
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
   ✅ GET unificado: /productos/findbycontainerignorecase (por QUERY)
   - Acepta "" como “sin filtro”, valida fuerte si traen valor
   =========================================================== */

export const ProductoFindQuerySchema = z
  .object({
    clave: emptyOr(claveStrict("clave", 10)).optional().default(""),
    nombre: emptyOr(safeText("nombre", 3, 120)).optional().default(""),
    page: z.coerce.number().int().min(1, "page → Debe ser ≥ 1").default(1),
    per_page: z
      .coerce.number()
      .int()
      .min(1, "per_page → Debe ser ≥ 1")
      .max(100, "per_page → Máximo 100")
      .default(20),
    sort_by: z.enum(["nombre", "precio", "stock_actual", "creado_en"]).optional(),
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
export type UpdateStockMinimoPorClaveDTO = z.infer<typeof UpdateStockMinimoPorClaveSchema>;

export type IdPorNombreDTO = z.infer<typeof IdPorNombreSchema>;
export type UpdatePorNombreDTO = z.infer<typeof UpdatePorNombreSchema>;
export type UpdateStockMinimoPorNombreDTO = z.infer<typeof UpdateStockMinimoPorNombreSchema>;

export type ProductoListInputDTO = z.infer<typeof ProductoListInput>;
export type ProductoFindQueryDTO = z.infer<typeof ProductoFindQuerySchema>;
