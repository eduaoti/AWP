import { z } from "zod";
import { telefonoSoloDigitos } from "../shared/_helpers";

const INVISIBLES = /[\p{Cc}\p{Cf}\u200B-\u200D\u2060]/u;
const EMOJI = /\p{Extended_Pictographic}/u;

const normalize = (raw: unknown) => (typeof raw === "string" ? raw.normalize("NFKC").trim() : raw);
const emptyToUndef = (raw: unknown) => {
  const v = normalize(raw);
  return typeof v === "string" && v === "" ? undefined : v;
};

const NombreAlmacen = z.preprocess(
  normalize,
  z
    .string()
    .min(2, "nombre → Debe tener al menos 2 caracteres")
    .max(160, "nombre → No debe exceder 160 caracteres")
    .refine((v) => /\p{L}/u.test(v), "nombre → Debe contener al menos una letra")
    .refine((v) => !/(.)\1{4,}/.test(v), "nombre → Contenido ambiguo o repetitivo")
    .refine((v) => !/[<>]/.test(v), "nombre → No se permiten etiquetas HTML")
    .refine((v) => !INVISIBLES.test(v), "nombre → No se permiten caracteres invisibles")
    .refine((v) => !EMOJI.test(v), "nombre → No se permiten emojis")
    .transform((v) => v.replace(/\s+/g, " "))
);

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
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `telefono → Debe contener 10 a 11 dígitos (recibidos: ${v.length})` });
      }
      if (/^(\d)\1+$/.test(v)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "telefono → No puede ser una secuencia del mismo dígito" });
      }
    })
    .optional()
);

const ContactoOpt = z.preprocess(
  emptyToUndef,
  z
    .string()
    .min(2, "contacto → Debe tener al menos 2 caracteres")
    .max(120, "contacto → No debe exceder 120 caracteres")
    .refine((v) => /^[\p{L}\p{N}\s.,()\-'"&/]+$/u.test(v), "contacto → Solo letras, números, espacios y . , ( ) - ' \" & /")
    .refine((v) => !/[<>]/.test(v), "contacto → No se permiten etiquetas HTML")
    .refine((v) => !INVISIBLES.test(v), "contacto → No se permiten caracteres invisibles")
    .refine((v) => !EMOJI.test(v), "contacto → No se permiten emojis")
    .transform((v) => v.replace(/\s+/g, " "))
    .optional()
);

/* ===========================================================
   Esquemas Zod
   =========================================================== */
export const AlmacenCrearSchema = z.object({
  nombre: NombreAlmacen,
  telefono: TelefonoOpt,
  contacto: ContactoOpt,
}).strict();

export const AlmacenActualizarSchema = z.object({
  id: z.coerce.number().int().positive(),
  nombre: NombreAlmacen,
  telefono: TelefonoOpt,
  contacto: ContactoOpt,
}).strict();

export const AlmacenEliminarSchema = z.object({
  id: z.coerce.number().int().positive(),
}).strict();

/* ===========================================================
   Tipos TypeScript derivados de los esquemas
   =========================================================== */
export type AlmacenCrearDTO = z.infer<typeof AlmacenCrearSchema>;
export type AlmacenActualizarDTO = z.infer<typeof AlmacenActualizarSchema>;
export type AlmacenEliminarDTO = z.infer<typeof AlmacenEliminarSchema>;
