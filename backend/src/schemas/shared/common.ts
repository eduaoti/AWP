// src/schemas/common.ts
import { z, ZodIssueCode, type RefinementCtx } from "zod";
import { checkEmailSafety } from "../../utils/emailSafety";

/* =========================
   Utilidades de validación
   ========================= */
const INVISIBLES = /[\p{Cc}\p{Cf}\u200B-\u200D\u2060]/u; // control + zero-width
const EMOJI = /\p{Extended_Pictographic}/u;

/* =========================
   notBadString
   - Normaliza (NFKC) y recorta ANTES con preprocess
   - Sin HTML, sin "null"/"undefined", sin invisibles
   ========================= */
export const notBadString = z.preprocess((raw: unknown) => {
  if (typeof raw === "string") return raw.normalize("NFKC").trim();
  return raw;
}, z.string()
  .min(1, "Campo requerido")
  .max(255, "Demasiado largo")
  .refine((v: string) => !["null", "undefined"].includes(v.toLowerCase()), "Valor inválido")
  .refine((v: string) => !/[<>]/.test(v), "No se permiten etiquetas HTML")
  .refine((v: string) => !INVISIBLES.test(v), "No se permiten caracteres invisibles o de control")
);

/* =========================
   emailStrict
   - Normaliza/recorta con preprocess
   - Valida formato, longitudes
   - Convierte a lowercase
   - superRefine acumula errores específicos (typos, desechables, etc.)
   ========================= */
export const emailStrict = z.preprocess((raw: unknown) => {
  if (typeof raw === "string") return raw.normalize("NFKC").trim();
  return raw;
}, z.string()
  .min(6, "Email demasiado corto")
  .max(254, "Email demasiado largo")
  .email("Formato de email inválido")
  .transform((v: string) => v.toLowerCase())
  .superRefine((v: string, ctx: RefinementCtx) => {
    const { errors, warnings, suggestion } = checkEmailSafety(v);
    for (const e of errors) ctx.addIssue({ code: ZodIssueCode.custom, message: e, path: [] });
    for (const w of warnings) ctx.addIssue({ code: ZodIssueCode.custom, message: `Aviso: ${w}`, path: [] });
    if (suggestion) ctx.addIssue({ code: ZodIssueCode.custom, message: `Sugerencia: ${suggestion}`, path: [] });
  })
);

/* =========================
   nombrePersona (ultra-estricto)
   - Normaliza/recorta con preprocess
   - Valida solo letras unicode + separadores válidos
   - Sin dígitos/emojis/invisibles
   - Sin guion/apóstrofe al inicio/fin
   - Finalmente normaliza espacios internos a uno
   ========================= */
export const nombrePersona = z.preprocess((raw: unknown) => {
  if (typeof raw === "string") return raw.normalize("NFKC").trim();
  return raw;
}, z.string()
  .min(2, "Nombre muy corto")
  .max(80, "Nombre muy largo")
  // ✅ Validaciones de ZodString ANTES del transform final:
  .regex(/^[\p{L}\p{M} '’-]+$/u, "Solo letras y separadores válidos (espacio, guion, apóstrofe)")
  .refine((v: string) => !/\d/.test(v), "No se permiten dígitos en el nombre")
  .refine((v: string) => !EMOJI.test(v), "No se permiten emojis en el nombre")
  .refine((v: string) => !INVISIBLES.test(v), "No se permiten caracteres invisibles o de control")
  .refine((v: string) => !/(^[-']|[-']$)/.test(v), "Guion o apóstrofe al inicio/fin no permitido")
  // 🔧 Transform final (ya no se encadenan más métodos de ZodString luego de transform)
  .transform((v: string) => v.replace(/\s+/g, " "))
);
