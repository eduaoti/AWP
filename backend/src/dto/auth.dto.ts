// src/dto/auth.dto.ts
import { z } from "zod";
import {
  LoginPasswordSchema,
  LoginTotpSchema,
  OfflineLoginSchema,
  OtpSetupStartSchema,
  OtpSetupConfirmSchema,
  RecoveryRequestSchema,
  RecoveryConfirmSchema,
} from "../schemas/auth/auth.schemas";

/* ===========================================================
   🧱 Tipos derivados (una sola fuente de verdad)
   =========================================================== */
export type LoginPasswordDTO = z.infer<typeof LoginPasswordSchema>["body"];
export type LoginTotpDTO = z.infer<typeof LoginTotpSchema>["body"];
export type OfflineLoginDTO = z.infer<typeof OfflineLoginSchema>["body"];
export type OtpSetupStartDTO = z.infer<typeof OtpSetupStartSchema>["body"];
export type OtpSetupConfirmDTO = z.infer<typeof OtpSetupConfirmSchema>["body"];
export type RecoveryRequestDTO = z.infer<typeof RecoveryRequestSchema>["body"];
export type RecoveryConfirmDTO = z.infer<typeof RecoveryConfirmSchema>["body"];

/* ===========================================================
   ✅ Helper genérico para validaciones Zod (sin error de tipo)
   =========================================================== */
function validateSchema<
  Schema extends z.ZodTypeAny,
  DTO = z.infer<Schema> extends { body: infer B } ? B : never
>(schema: Schema, body: unknown): { ok: true; data: DTO } | { ok: false; errores: string[] } {
  const parsed = schema.safeParse({ body });
  if (parsed.success) {
    // Aquí aseguramos que parsed.data SI tiene .body
    return { ok: true, data: (parsed.data as any).body as DTO };
  }
  return { ok: false, errores: parsed.error.issues.map(i => i.message) };
}

/* ===========================================================
   🔒 Validadores específicos (cada uno con su tipo exacto)
   =========================================================== */
export const validarLoginPassword = (body: unknown) =>
  validateSchema(LoginPasswordSchema, body);

export const validarLoginTotp = (body: unknown) =>
  validateSchema(LoginTotpSchema, body);

export const validarOfflineLogin = (body: unknown) =>
  validateSchema(OfflineLoginSchema, body);

export const validarOtpSetupStart = (body: unknown) =>
  validateSchema(OtpSetupStartSchema, body);

export const validarOtpSetupConfirm = (body: unknown) =>
  validateSchema(OtpSetupConfirmSchema, body);

export const validarRecoveryRequest = (body: unknown) =>
  validateSchema(RecoveryRequestSchema, body);

export const validarRecoveryConfirm = (body: unknown) =>
  validateSchema(RecoveryConfirmSchema, body);
