// src/schemas/auth.schemas.ts
import { z } from "zod";
import { emailStrict } from "./common";
import { strongPassword } from "./password";

/* ===== Login paso 1 (password) ===== */
export const LoginPasswordSchema = z.object({
  body: z.object({
    email: emailStrict,
    password: strongPassword
  }).strict()
}).strict();

/* ===== Login paso 2 (TOTP o backup) ===== */
export const LoginTotpSchema = z.object({
  body: z.object({
    preAuth: z.string().min(10),
    code: z.string().min(6).max(8),
    deviceId: z.string().min(3).optional()
  }).strict()
}).strict();

/* ===== Login paso 2 alterno (offline PIN) ===== */
export const OfflineLoginSchema = z.object({
  body: z.object({
    preAuth: z.string().min(10),
    offlineJwt: z.string().min(20),
    pin: z.string().min(4).max(10),
    deviceId: z.string().min(3).optional()
  }).strict()
}).strict();

/* ===== Configuración OTP ===== */
export const OtpSetupStartSchema = z.object({
  body: z.object({}).strict() // sin body; usa token
}).strict();

export const OtpSetupConfirmSchema = z.object({
  body: z.object({
    secret: z.string().min(16), // base32
    code: z.string().min(6).max(8)
  }).strict()
}).strict();

/* ===== Recuperación de contraseña ===== */
export const RecoveryRequestSchema = z.object({
  body: z.object({ email: emailStrict }).strict()
}).strict();

export const RecoveryConfirmSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    newPassword: strongPassword
  }).strict()
}).strict();
