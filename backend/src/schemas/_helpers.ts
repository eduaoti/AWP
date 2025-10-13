// src/schemas/_helpers.ts
import { z } from "zod";

export const nonEmptyTrimmed = (min: number, max: number, campo: string) =>
  z.string()
    .transform(v => (typeof v === "string" ? v.trim() : v))
    .refine(v => v.length > 0, { message: `${campo} → Campo requerido` })
    .refine(v => v.length >= min, { message: `${campo} → Debe tener al menos ${min} caracteres` })
    .refine(v => v.length <= max, { message: `${campo} → No debe exceder ${max} caracteres` });

// Evita floods “aaaaaaaaaaaaaa” o “1111111111”
export const noFlood = (campo: string) =>
  z.string().refine(v => !/(.)\1{4,}/.test(v), { message: `${campo} → Contenido ambiguo o repetitivo` });

// Evita -0 exactamente
export const nonNegativeNoMinusZero = (campo: string) =>
  z.coerce.number().refine(n => (n >= 0 && !Object.is(n, -0)), { message: `${campo} → Debe ser ≥ 0` });

// Solo letras (con acentos), espacios, puntos y guiones
export const alphaUnidad = z.string()
  .transform(v => (typeof v === "string" ? v.trim() : v))
  .refine(v => v.length > 0, { message: "unidad → Campo requerido" })
  .refine(v => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.\-\s]{2,20}$/.test(v), {
    message: "unidad → Solo letras/espacios (2–20)"
  });

// Categoría similar, pero más larga
export const alphaCategoria = z.string()
  .transform(v => (typeof v === "string" ? v.trim() : v))
  .refine(v => v.length > 0, { message: "categoria → Campo requerido" })
  .refine(v => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.\-\s]{2,60}$/.test(v), {
    message: "categoria → Solo letras/espacios (2–60)"
  });

// Teléfono: exactamente 10–11 dígitos (sin símbolos)
export const telefonoSoloDigitos = z.string()
  .transform(v => (v ?? "").replace(/\D/g, "")) // quita todo lo que no es dígito
  .refine(v => v.length === 0 || (v.length >= 10 && v.length <= 11), {
    message: "telefono → Debe contener 10 a 11 dígitos"
  });
