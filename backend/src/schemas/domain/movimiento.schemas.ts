import { z } from "zod";
import { claveStrict, nonNegativeInt, safeText } from "../shared/_helpers";

/* ===========================================================
   Reglas reutilizables (alineadas con productos)
   =========================================================== */

/** Texto seguro sin HTML/JS ni floods y además sin '@' ni URLs */
const labelNoAt = (campo: string, min = 1, max = 120) =>
  safeText(campo, min, max)
    .refine((v) => !/@/.test(v), { message: `${campo} → No debe contener @` })
    .refine((v) => !/(https?:\/\/|www\.)/i.test(v), {
      message: `${campo} → No incluyas URLs`,
    });

/** Entero > 0 (coerce) con tope razonable */
const positiveInt = (campo = "cantidad", max = 1_000_000_000) =>
  nonNegativeInt(campo, max).refine((n) => n > 0, {
    message: `${campo} → Debe ser entero > 0`,
  });

/** Flag flexible: acepta boolean, 0/1, "0"/"1", "true"/"false", "sí"/"no", etc. */
const EntradaFlag = z
  .preprocess((v) => {
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["1", "true", "t", "si", "sí", "yes", "on"].includes(s)) return true;
      if (["0", "false", "f", "no", "off"].includes(s)) return false;
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return v;
  }, z.union([z.boolean(), z.number().int().min(0).max(1)]))
  .transform((v) => (typeof v === "number" ? v === 1 : v));

/* ===========================================================
   Esquema único de movimiento (entrada o salida) — por CLAVE
   =========================================================== */
export const MovimientoSchema = z
  .object({
    /** Flag: true/1 = entrada, false/0 = salida */
    entrada: EntradaFlag,

    /** Clave de producto (estricta, como en productos) */
    producto_clave: claveStrict("producto_clave", 10),

    /** Cantidad ENTERA > 0 */
    cantidad: positiveInt("cantidad"),

    /** Campos de texto seguros (sin @ ni URLs) */
    documento: labelNoAt("documento").optional(),
    responsable: labelNoAt("responsable").optional(),

    /** La fecha se asigna en DB; permitir override opcional (ISO o Date) */
    fecha: z.coerce.date().optional(),

    /** FKs condicionales */
    proveedor_id: z
      .coerce.number()
      .int({ message: "proveedor_id → Debe ser entero" })
      .positive({ message: "proveedor_id inválido" })
      .optional(),

    cliente_id: z
      .coerce.number()
      .int({ message: "cliente_id → Debe ser entero" })
      .positive({ message: "cliente_id inválido" })
      .optional(),
  })
  .strict()
  .superRefine((obj, ctx) => {
    // Reglas de negocio condicionales
    if (obj.entrada === false && !obj.cliente_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cliente_id es requerido para salidas",
        path: ["cliente_id"],
      });
    }
    if (obj.entrada === true && obj.cliente_id != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "cliente_id no aplica en entradas",
        path: ["cliente_id"],
      });
    }
    if (obj.entrada === false && obj.proveedor_id != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "proveedor_id no aplica en salidas",
        path: ["proveedor_id"],
      });
    }
  });

/* ===========================================================
   Tipos
   =========================================================== */
export type MovimientoDTO = z.infer<typeof MovimientoSchema>;
