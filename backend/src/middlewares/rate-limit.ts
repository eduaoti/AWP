// src/middlewares/rate-limit.ts
import rateLimit from "express-rate-limit";
import { AppCode } from "../status/codes";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Deja el body con la forma estándar
  message: {
    codigo: AppCode.RATE_LIMITED,
    mensaje: "Demasiados intentos, inténtalo más tarde"
  }
});
