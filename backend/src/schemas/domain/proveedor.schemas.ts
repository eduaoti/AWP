// src/schemas/proveedor.schemas.ts
import { z } from "zod";
import { nonEmptyTrimmed, noFlood, telefonoSoloDigitos } from "../shared/_helpers";

/* =========================================
   Utilidades locales de validación
   ========================================= */
const INVISIBLES = /[\p{Cc}\p{Cf}\u200B-\u200D\u2060]/u;      // control + zero-width
const EMOJI = /\p{Extended_Pictographic}/u;

/** Normaliza y recorta (NFKC + trim). Si es string, devuelve normalizado. */
const normalize = (raw: unknown) => {
  if (typeof raw === "string") return raw.normalize("NFKC").trim();
  return raw;
};

/** Convierte null/"" a undefined para campos opcionales */
const emptyToUndef = (raw: unknown) => {
  const v = normalize(raw);
  if (typeof v !== "string") return v;
  return v === "" ? undefined : v;
};

/* =========================================
   nombre (OBLIGATORIO)
   - 2–160
   - sin HTML, invisibles ni emojis
   - debe contener al menos una letra
   - no puede empezar/terminar con separadores
   - no floods (caracter repetido 5+ veces)
   - colapsa espacios internos
   ========================================= */
const NombreProveedor = z.preprocess(
  normalize,
  z
    .string()
    .min(2, "nombre → Debe tener al menos 2 caracteres")
    .max(160, "nombre → No debe exceder 160 caracteres")
    .refine((v) => !/(.)\1{4,}/.test(v), "nombre → Contenido ambiguo o repetitivo (flood)")
    .refine((v) => /\p{L}/u.test(v), "nombre → Debe contener al menos una letra")
    .refine((v) => !/[<>]/.test(v), "nombre → No se permiten etiquetas HTML (< >)")
    .refine((v) => !INVISIBLES.test(v), "nombre → No se permiten caracteres invisibles/de control")
    .refine((v) => !EMOJI.test(v), "nombre → No se permiten emojis")
    .refine((v) => !/(^[-'’.]|[-'’.]$)/.test(v), "nombre → Guion/apóstrofe/punto al inicio o fin no permitido")
    .transform((v) => v.replace(/\s+/g, " "))
);

/* =========================================
   telefono (OPCIONAL)
   - limpia todo menos dígitos
   - si viene, 10–11 dígitos exactos
   - no todos los dígitos iguales (000000..., 999999..., etc.)
   - mensaje con detalle del tamaño actual si falla
   ========================================= */
const TelefonoOpt = z.preprocess(
  (raw) => {
    const v = emptyToUndef(raw);
    if (typeof v !== "string") return v;
    const digits = v.replace(/\D/g, "");
    return digits === "" ? undefined : digits; // guardamos solo dígitos o undefined
  },
  telefonoSoloDigitos
    .superRefine((v, ctx) => {
      if (!v) return; // undefined OK
      if (v.length < 10 || v.length > 11) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `telefono → Debe contener 10 a 11 dígitos (recibidos: ${v.length})`
        });
      }
      if (/^(\d)\1+$/.test(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "telefono → No puede ser una secuencia del mismo dígito (ej. 0000000000)"
        });
      }
    })
    .optional()
);

/* =========================================
   contacto (OPCIONAL)
   - "" → undefined
   - 2–120
   - permitido: letras, números, espacios y . , ( ) - ' " & /
   - sin HTML, invisibles ni emojis
   - no floods
   - colapsa espacios internos
   ========================================= */
const ContactoOpt = z.preprocess(
  emptyToUndef,
  z
    .string()
    .min(2, "contacto → Debe tener al menos 2 caracteres")
    .max(120, "contacto → No debe exceder 120 caracteres")
    .refine((v) => !/(.)\1{4,}/.test(v), "contacto → Contenido ambiguo o repetitivo (flood)")
    .refine(
      (v) => /^[\p{L}\p{N}\s.,()\-'"&/]+$/u.test(v),
      "contacto → Solo letras, números, espacios y . , ( ) - ' \" & /"
    )
    .refine((v) => !/[<>]/.test(v), "contacto → No se permiten etiquetas HTML (< >)")
    .refine((v) => !INVISIBLES.test(v), "contacto → No se permiten caracteres invisibles/de control")
    .refine((v) => !EMOJI.test(v), "contacto → No se permiten emojis")
    .transform((v) => v.replace(/\s+/g, " "))
    .optional()
);

/* =========================================
   Esquema público
   ========================================= */
export const CreateProveedorSchema = z
  .object({
    nombre: NombreProveedor,
    telefono: TelefonoOpt,
    contacto: ContactoOpt
  })
  .strict();

export type CreateProveedorDTO = z.infer<typeof CreateProveedorSchema>;
