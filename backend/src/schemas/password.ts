// src/schemas/password.ts
import { z } from "zod";

export const strongPassword = z.string()
  .min(8, "Mínimo 8 caracteres")
  .max(128, "Máximo 128 caracteres")
  .refine(v => /[a-z]/.test(v), "Debe incluir minúscula")
  .refine(v => /[A-Z]/.test(v), "Debe incluir mayúscula")
  .refine(v => /\d/.test(v), "Debe incluir dígito")
  .refine(v => /[^A-Za-z0-9]/.test(v), "Debe incluir símbolo")
  .refine(v => !/(.)\1{3,}/.test(v), "No repitas el mismo carácter 4+ veces seguidas")
  .refine(v => !/(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf|zxcv)/i.test(v), "Evita secuencias triviales (1234, qwer, asdf, etc.)");
