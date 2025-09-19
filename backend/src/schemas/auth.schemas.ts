// src/schemas/auth.schemas.ts
import { z } from 'zod';

export const LoginPasswordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const LoginTotpSchema = z.object({
  userId: z.string().min(1),
  code: z.string().min(6).max(8),
  deviceId: z.string().min(3)
});

export const TotpVerifySchema = z.object({
  userId: z.string().min(1),
  code: z.string().min(6).max(8)
});
