// src/routes/auth.routes.ts
import { Router } from "express";
import {
  login,
  verificarOtpLogin,
  verificarOtpOffline,
  iniciarSetupOtp,
  confirmarSetupOtp,
  solicitarRecuperacion,
  confirmarRecuperacion
} from "../controllers/auth.controller";
import { validateBody } from "../middlewares/validate";
import {
  LoginPasswordSchema,
  LoginTotpSchema,
  OfflineLoginSchema,
  OtpSetupStartSchema,
  OtpSetupConfirmSchema,
  RecoveryRequestSchema,
  RecoveryConfirmSchema
} from "../schemas/auth.schemas";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";
import {
  listMySessions,
  revokeSession,
  revokeAllSessions
} from "../services/sessions";

const r = Router();

/* ==== Login ==== */
r.post("/login", validateBody(LoginPasswordSchema), login);
r.post("/login/otp", validateBody(LoginTotpSchema), verificarOtpLogin);
r.post("/login/offline", validateBody(OfflineLoginSchema), verificarOtpOffline);

/* ==== Configuración OTP (usa preAuth en el body, NO access token) ==== */
r.post("/otp/setup/start", validateBody(OtpSetupStartSchema), iniciarSetupOtp);
r.post("/otp/setup/confirm", validateBody(OtpSetupConfirmSchema), confirmarSetupOtp);

/* ==== Recuperación de contraseña ==== */
r.post("/recovery/request", validateBody(RecoveryRequestSchema), solicitarRecuperacion);
r.post("/recovery/confirm", validateBody(RecoveryConfirmSchema), confirmarRecuperacion);

/* ==== Gestión de sesiones ==== */
// Listar mis sesiones
r.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const uid = (req as any).user?.sub as number;
    const rows = await listMySessions(uid);
    res.json({
      codigo: 0,
      mensaje: "OK",
      data: rows,
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  } catch (e) { next(e); }
});

// Cerrar sesión actual (usa jti del token)
r.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const jti = (req as any).user?.jti as string | undefined;
    if (jti) await revokeSession(jti);
    res.json({
      codigo: 0,
      mensaje: "OK",
      data: { revoked: !!jti },
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  } catch (e) { next(e); }
});

// Revocar una sesión específica por jti
const RevokeSchema = z.object({
  body: z.object({ jti: z.string().uuid() }).strict()
}).strict();

r.post("/sessions/revoke", requireAuth, validateBody(RevokeSchema), async (req, res, next) => {
  try {
    const { jti } = req.body as { jti: string };
    await revokeSession(jti);
    res.json({
      codigo: 0,
      mensaje: "OK",
      data: { jti },
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  } catch (e) { next(e); }
});

// Cerrar todas mis sesiones
r.post("/logout-all", requireAuth, async (req, res, next) => {
  try {
    const uid = (req as any).user?.sub as number;
    await revokeAllSessions(uid);
    res.json({
      codigo: 0,
      mensaje: "OK",
      data: { all: true },
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  } catch (e) { next(e); }
});

export default r;
