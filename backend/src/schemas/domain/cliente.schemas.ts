// src/schemas/cliente.schemas.ts
import { z } from "zod";
import { noFlood, telefonoSoloDigitos } from "../shared/_helpers";

/* =========================================
   Utilidades locales
   ========================================= */
const INVISIBLES = /[\p{Cc}\p{Cf}\u200B-\u200D\u2060]/u;      // control + zero-width
const EMOJI = /\p{Extended_Pictographic}/u;

/** Normaliza y recorta (NFKC + trim). */
const normalize = (raw: unknown) => (typeof raw === "string" ? raw.normalize("NFKC").trim() : raw);

/** Convierte "" a undefined en campos opcionales. */
const emptyToUndef = (raw: unknown) => {
  const v = normalize(raw);
  return typeof v === "string" && v === "" ? undefined : v;
};

/* =========================================
   nombre (OBLIGATORIO)
   - 2–160
   - sin HTML, invisibles ni emojis
   - al menos una letra
   - no floods (5+ repeticiones)
   - no iniciar/terminar con separadores
   - colapsa espacios internos
   ========================================= */
const NombreCliente = z.preprocess(
  normalize,
  z
    .string()
    .min(2, "nombre → Debe tener al menos 2 caracteres")
    .max(160, "nombre → No debe exceder 160 caracteres")
    .refine((v) => /\p{L}/u.test(v), "nombre → Debe contener al menos una letra")
    .refine((v) => !/(.)\1{4,}/.test(v), "nombre → Contenido ambiguo o repetitivo (flood)")
    .refine((v) => !/[<>]/.test(v), "nombre → No se permiten etiquetas HTML (< >)")
    .refine((v) => !INVISIBLES.test(v), "nombre → No se permiten caracteres invisibles/de control")
    .refine((v) => !EMOJI.test(v), "nombre → No se permiten emojis")
    .refine((v) => !/(^[-'’.]|[-'’.]$)/.test(v), "nombre → Guion/apóstrofe/punto al inicio o fin no permitido")
    .transform((v) => v.replace(/\s+/g, " "))
);

/* =========================================
   telefono (OPCIONAL)
   - limpia a dígitos
   - 10–11 dígitos si viene
   - no todos iguales
   - error incluye longitud recibida
   ========================================= */
const TelefonoOpt = z.preprocess(
  (raw) => {
    const v = emptyToUndef(raw);
    if (typeof v !== "string") return v;
    const digits = v.replace(/\D/g, "");
    return digits === "" ? undefined : digits;
  },
  telefonoSoloDigitos
    .superRefine((v, ctx) => {
      if (!v) return;
      if (v.length < 10 || v.length > 11) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `telefono → Debe contener 10 a 11 dígitos (recibidos: ${v.length})`,
        });
      }
      if (/^(\d)\1+$/.test(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "telefono → No puede ser una secuencia del mismo dígito (ej. 0000000000)",
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
      'contacto → Solo letras, números, espacios y . , ( ) - \' " & /'
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
export const ClienteCrearSchema = z
  .object({
    nombre: NombreCliente,
    telefono: TelefonoOpt,
    contacto: ContactoOpt,
  })
  .strict();

export type ClienteCrearDTO = z.infer<typeof ClienteCrearSchema>;

// src/schemas/cliente.schemas.ts (añadir)
export const ClienteActualizarSchema = z.object({
  id: z.coerce.number().int().positive(),
  nombre: NombreCliente,
  telefono: TelefonoOpt,
  contacto: ContactoOpt,
}).strict();

export const ClienteEliminarSchema = z.object({
  id: z.coerce.number().int().positive(),
}).strict();
