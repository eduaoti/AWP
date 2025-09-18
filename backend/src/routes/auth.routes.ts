import { Router } from "express";
import { login, solicitarRecuperacion, verificarOtpLogin } from "../controllers/auth.controller";
const r = Router();

r.post("/login", login);
r.post("/recuperar-usuario", solicitarRecuperacion);
r.post("/login/otp", verificarOtpLogin);

export default r;
