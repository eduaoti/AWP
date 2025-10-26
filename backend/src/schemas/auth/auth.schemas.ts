// src/schemas/auth.schemas.ts
import { z } from "zod";
import { emailStrict } from "../shared/common";
import { strongPassword } from "./password";

/** Limpia deviceId: null/"" -> undefined; valida string opcional >= 3 */
const optionalDeviceId = z.preprocess(
  (v) => (v == null || v === "" ? undefined : v),
  z.string().min(3, "deviceId debe tener al menos 3 caracteres").optional()
);

/* ===== Login paso 1 (password) ===== */
export const LoginPasswordSchema = z.object({
  body: z.object({
    email: emailStrict,
    password: strongPassword,
  }).strict(),
}).strict();

/* ===== Login paso 2 (TOTP o backup) ===== */
export const LoginTotpSchema = z.object({
  body: z.object({
    preAuth: z.string().min(10, "preAuth inválido o faltante"),
    code: z.string().min(6, "OTP demasiado corto").max(8, "OTP demasiado largo"),
    deviceId: optionalDeviceId,
  }).strict(),
}).strict();

/* ===== Login paso 2 alterno (offline PIN) ===== */
export const OfflineLoginSchema = z.object({
  body: z.object({
    preAuth: z.string().min(10, "preAuth inválido o faltante"),
    offlineJwt: z.string().min(20, "offlineJwt inválido o faltante"),
    pin: z.string().min(4, "PIN demasiado corto").max(10, "PIN demasiado largo"),
    deviceId: optionalDeviceId,
  }).strict(),
}).strict();

/* ===== Configuración OTP (usa preAuth) ===== */
export const OtpSetupStartSchema = z.object({
  body: z.object({
    preAuth: z.string().min(10, "preAuth inválido o faltante"),
  }).strict(),
}).strict();

export const OtpSetupConfirmSchema = z.object({
  body: z.object({
    preAuth: z.string().min(10, "preAuth inválido o faltante"),
    secret: z.string().min(16, "Secreto OTP inválido"),
    code: z.string().min(6, "OTP demasiado corto").max(8, "OTP demasiado largo"),
    deviceId: optionalDeviceId, // ya no obligatorio; limpia null/"" automáticamente
  }).strict(),
}).strict();

/* ===== Recuperación de contraseña ===== */
export const RecoveryRequestSchema = z.object({
  body: z.object({ email: emailStrict }).strict(),
}).strict();

export const RecoveryConfirmSchema = z.object({
  body: z.object({
    token: z.string().min(20, "Token inválido"),
    newPassword: strongPassword,
  }).strict(),
}).strict();
