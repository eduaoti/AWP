import { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { totp } from "otplib";
import { AppCode } from "../status/codes";
import { sendCode, ok } from "../status/respond";

totp.options = { step: 30, window: parseInt(process.env.OTP_WINDOW || "1") };
const DEMO_SECRET = "SECRET_DEMO_SOLO_PARA_DEV";

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const { rows } = await pool.query(
      "SELECT id,nombre,email,password,rol FROM usuarios WHERE email=$1",
      [email]
    );
    const user = rows[0];
    if (!user) return sendCode(req, res, AppCode.INVALID_CREDENTIALS);

    const okPass = await bcrypt.compare(password, user.password);
    if (!okPass) return sendCode(req, res, AppCode.INVALID_CREDENTIALS);

    const token = jwt.sign(
      { sub: user.id, rol: user.rol },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );

    return ok(req, res, {
      token,
      requiresOtp: true,
      otp_example_code: totp.generate(DEMO_SECRET)
    });
  } catch (e) { next(e); }
};

export const solicitarRecuperacion = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return ok(_req as any, res, {
      info: "Si el correo existe, se enviará una instrucción de recuperación."
    });
  } catch (e) { next(e); }
};

export const verificarOtpLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body as { code: string };
    const valid = totp.check(code, DEMO_SECRET);
    if (!valid) return sendCode(req, res, AppCode.OTP_INVALID);
    return ok(req, res, { ok: true });
  } catch (e) { next(e); }
};
