import { z } from "zod";

export const notBadString = z.string()
  .trim()
  .min(1, "Campo requerido")
  .max(255, "Demasiado largo")
  .refine(v => !["null","undefined"].includes(v.toLowerCase()), "Valor inválido")
  .refine(v => !/[<>]/.test(v), "No se permiten etiquetas HTML");

export const emailNorm = z.string()
  .email("Email inválido")
  .max(254)
  .transform(v => v.trim().toLowerCase());

export const nombrePersona = z.string()
  .trim()
  .min(2, "Nombre muy corto")
  .max(80, "Nombre muy largo")
  // Letras, espacios, apóstrofe, guion, acentos (ajusta a tu realidad)
  .regex(/^[A-Za-zÀ-ÿ' -]+$/, "Solo letras y separadores válidos");
