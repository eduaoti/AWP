// src/routes/auth.routes.ts
import { Router } from "express";
import jwt from "jsonwebtoken";

import {
  login,
  verificarOtpLogin,
  verificarOtpOffline,
  iniciarSetupOtp,
  confirmarSetupOtp,
  solicitarRecuperacion,
  confirmarRecuperacion,
} from "../controllers/auth.controller";

import { validateBody } from "../middlewares/validation/validate";
import {
  LoginPasswordSchema,
  LoginTotpSchema,
  OfflineLoginSchema,
  OtpSetupStartSchema,
  OtpSetupConfirmSchema,
  RecoveryRequestSchema,
  RecoveryConfirmSchema,
} from "../schemas/auth/auth.schemas";

import { requireAuth } from "../middlewares/security/auth";
import { requireAuthEvenIfExpired } from "../middlewares/security/authRefresh";

import { z } from "zod";
import {
  listMySessions,
  revokeSession,
  revokeAllSessions,
} from "../services/system/sessions";

const r = Router();

// Debe ser el mismo secreto que usas en el middleware requireAuth
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SESSION_TTL_MIN = Number(process.env.SESSION_TTL_MIN || 30);

/* ===========================================================
   LOGIN
   =========================================================== */
r.post("/login", validateBody(LoginPasswordSchema), login);
r.post("/login/otp", validateBody(LoginTotpSchema), verificarOtpLogin);
r.post("/login/offline", validateBody(OfflineLoginSchema), verificarOtpOffline);

/* ===========================================================
   CONFIGURACIÓN OTP
   =========================================================== */
r.post(
  "/otp/setup/start",
  validateBody(OtpSetupStartSchema),
  iniciarSetupOtp
);

r.post(
  "/otp/setup/confirm",
  validateBody(OtpSetupConfirmSchema),
  confirmarSetupOtp
);

/* ===========================================================
   RECUPERACIÓN DE CONTRASEÑA
   =========================================================== */
r.post(
  "/recovery/request",
  validateBody(RecoveryRequestSchema),
  solicitarRecuperacion
);

r.post(
  "/recovery/confirm",
  validateBody(RecoveryConfirmSchema),
  confirmarRecuperacion
);

/* ===========================================================
   SESIONES
   =========================================================== */

// Obtener mis sesiones activas
r.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const uid = (req as any).user?.sub as number;
    const rows = await listMySessions(uid);

    res.json({
      codigo: 0,
      mensaje: "OK",
      data: rows,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

// Cerrar sesión actual
r.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const jti = (req as any).user?.jti as string | undefined;
    if (jti) await revokeSession(jti);

    res.json({
      codigo: 0,
      mensaje: "OK",
      data: { revoked: !!jti },
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

// Revocar una sesión específica por jti
const RevokeSchema = z
  .object({
    body: z.object({ jti: z.string().uuid() }).strict(),
  })
  .strict();

r.post(
  "/sessions/revoke",
  requireAuth,
  validateBody(RevokeSchema),
  async (req, res, next) => {
    try {
      const { jti } = req.body as { jti: string };
      await revokeSession(jti);

      res.json({
        codigo: 0,
        mensaje: "OK",
        data: { jti },
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      next(e);
    }
  }
);

// Cerrar todas mis sesiones activas
r.post("/logout-all", requireAuth, async (req, res, next) => {
  try {
    const uid = (req as any).user?.sub as number;
    await revokeAllSessions(uid);

    res.json({
      codigo: 0,
      mensaje: "OK",
      data: { all: true },
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    next(e);
  }
});

/* ===========================================================
   REFRESH TOKEN (IMPORTANTÍSIMO)
   Este endpoint ahora acepta tokens EXPIRED
   =========================================================== */
r.post("/refresh", requireAuthEvenIfExpired, (req, res) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({
      codigo: 401,
      mensaje: "No autenticado",
      data: null,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }

  // Creamos un nuevo token usando los mismos claims
  const payload = {
    sub: user.sub,
    rol: user.rol,
    email: user.email,
    jti: user.jti, // puedes cambiarlo si quieres nuevo jti
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${SESSION_TTL_MIN}m`,
  });

  return res.json({
    codigo: 0,
    mensaje: "Token renovado",
    data: { token },
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

export default r;
