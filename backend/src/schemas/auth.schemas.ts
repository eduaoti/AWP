import { z } from "zod";
import { emailNorm } from "./common";
import { strongPassword } from "./password";

export const LoginPasswordSchema = z.object({
  body: z.object({
    email: emailNorm,
    password: strongPassword
  }).strict()
}).strict();

export const LoginTotpSchema = z.object({
  body: z.object({
    preAuth: z.string().min(10),
    code: z.string().min(6).max(8),
    deviceId: z.string().min(3).optional()
  }).strict()
}).strict();

export const OtpSetupStartSchema = z.object({
  body: z.object({}).strict() // sin body; usa token
}).strict();

export const OtpSetupConfirmSchema = z.object({
  body: z.object({
    secret: z.string().min(16), // base32
    code: z.string().min(6).max(8)
  }).strict()
}).strict();

export const RecoveryRequestSchema = z.object({
  body: z.object({ email: emailNorm }).strict()
}).strict();

export const RecoveryConfirmSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    newPassword: strongPassword
  }).strict()
}).strict();
