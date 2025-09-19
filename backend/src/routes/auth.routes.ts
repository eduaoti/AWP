import { Router } from "express";
import {
  login, verificarOtpLogin,
  iniciarSetupOtp, confirmarSetupOtp,
  solicitarRecuperacion, confirmarRecuperacion
} from "../controllers/auth.controller";
import { validateBody } from "../middlewares/validate";
import {
  LoginPasswordSchema, LoginTotpSchema,
  OtpSetupStartSchema, OtpSetupConfirmSchema,
  RecoveryRequestSchema, RecoveryConfirmSchema
} from "../schemas/auth.schemas";
import { requireAuth } from "../middlewares/auth";

const r = Router();

r.post("/login", validateBody(LoginPasswordSchema), login);
r.post("/login/otp", validateBody(LoginTotpSchema), verificarOtpLogin);

// Requieren sesión
r.post("/otp/setup/start", requireAuth, validateBody(OtpSetupStartSchema), iniciarSetupOtp);
r.post("/otp/setup/confirm", requireAuth, validateBody(OtpSetupConfirmSchema), confirmarSetupOtp);

// Recuperación de contraseña
r.post("/recovery/request", validateBody(RecoveryRequestSchema), solicitarRecuperacion);
r.post("/recovery/confirm", validateBody(RecoveryConfirmSchema), confirmarRecuperacion);

export default r;
