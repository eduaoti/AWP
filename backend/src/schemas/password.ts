import { z } from "zod";

export const strongPassword = z.string()
  .min(8, "Mínimo 8 caracteres")
  .max(128, "Máximo 128 caracteres")
  .refine(v => /[a-z]/.test(v), "Debe incluir minúscula")
  .refine(v => /[A-Z]/.test(v), "Debe incluir mayúscula")
  .refine(v => /[^A-Za-z0-9]/.test(v), "Debe incluir símbolo")
  .refine(v => /\d/.test(v), "Debe incluir dígito");
