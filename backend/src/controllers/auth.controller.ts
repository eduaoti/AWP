import { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { totp } from "otplib";

totp.options = { step: 30, window: parseInt(process.env.OTP_WINDOW || "1") };
const DEMO_SECRET = "SECRET_DEMO_SOLO_PARA_DEV";

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const { rows } = await pool.query("SELECT id,nombre,email,password,rol FROM usuarios WHERE email=$1", [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Credenciales inv�lidas" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Credenciales inv�lidas" });
    const token = jwt.sign({ sub: user.id, rol: user.rol }, process.env.JWT_SECRET as string, { expiresIn: "15m" });
    res.json({ token, requiresOtp: true, otp_example_code: totp.generate(DEMO_SECRET) });
  } catch (e) { next(e); }
};

export const solicitarRecuperacion = async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json({ ok: true, mensaje: "Si el correo existe, se enviar� una instrucci�n de recuperaci�n." }); }
  catch (e) { next(e); }
};

export const verificarOtpLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body as { code: string };
    const valid = totp.check(code, DEMO_SECRET);
    if (!valid) return res.status(401).json({ error: "OTP inv�lido" });
    res.json({ ok: true });
  } catch (e) { next(e); }
};
