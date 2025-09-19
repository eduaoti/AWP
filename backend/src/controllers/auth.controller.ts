import { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AppCode } from "../status/codes";
import { ok, sendCode } from "../status/respond";
import { UsuarioModel } from "../models/usuario.model";
import { SecurityModel } from "../models/security.model";
import {
  genSecretBase32, keyUri, qrDataUrl,
  verifyTotp, genTotp, genBackupCodes, sha256
} from "../services/otp";
import { sendMail } from "../services/mail";

const JWT = process.env.JWT_SECRET as string;
const JWT_PRE = process.env.JWT_PREAUTH_SECRET as string;

// Paso 1: login con password
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const { rows } = await pool.query(
      "SELECT id,nombre,email,password,rol,otp_enabled FROM usuarios WHERE email=$1", [email]
    );
    const user = rows[0];
    if (!user) return sendCode(req, res, AppCode.INVALID_CREDENTIALS);

    const okPass = await bcrypt.compare(password, user.password);
    if (!okPass) return sendCode(req, res, AppCode.INVALID_CREDENTIALS);

    if (!user.otp_enabled) {
      const token = jwt.sign({ sub: user.id, rol: user.rol }, JWT, { expiresIn: "1h" });
      return ok(req, res, { token, requiresOtp: false });
    }

    // Usuario con OTP -> emitimos preAuth corto
    const preAuth = jwt.sign({ uid: user.id }, JWT_PRE, { expiresIn: "5m" });

    // (Opcional) enviar el TOTP por correo como “online fallback”
    try {
      const info = await UsuarioModel.getOtpInfoById(user.id);
      if (info?.otp_secret) {
        const code = genTotp(info.otp_secret);
        await sendMail(user.email, "Tu código OTP",
          `<p>Tu código de acceso es: <b>${code}</b> (válido ~30s)</p>`);
      }
    } catch (e) { console.warn("MAIL error:", e); }

    return ok(req, res, { requiresOtp: true, preAuth });
  } catch (e) { next(e); }
};

// Paso 2: verificar OTP o backup y emitir token final
export const verificarOtpLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preAuth, code } = req.body as { preAuth: string; code: string };

    let uid: number | undefined;
    try {
      const p = jwt.verify(preAuth, JWT_PRE) as any;
      uid = p.uid;
    } catch {
      return sendCode(req, res, AppCode.OTP_INVALID);
    }

    const info = await UsuarioModel.getOtpInfoById(uid!);
    if (!info?.otp_enabled || !info.otp_secret) {
      return sendCode(req, res, AppCode.OTP_INVALID);
    }

    // 1) TOTP
    let okCode = verifyTotp(info.otp_secret, code);

    // 2) Backup code (consumo único)
    if (!okCode) {
      const used = await SecurityModel.consumeBackupCode(uid!, sha256(code));
      okCode = !!used;
    }

    if (!okCode) return sendCode(req, res, AppCode.OTP_INVALID);

    const { rows } = await pool.query("SELECT rol FROM usuarios WHERE id=$1", [uid]);
    const token = jwt.sign({ sub: uid, rol: rows[0]?.rol || "lector" }, JWT, { expiresIn: "1h" });
    return ok(req, res, { token });
  } catch (e) { next(e); }
};

// Iniciar setup: generar secreto base32 y QR (PNG dataURL + URI)
export const iniciarSetupOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.sub as number | undefined;
    const email = (req as any).user?.email as string | undefined; // si lo incluyes en token; si no, búscalo
    if (!userId) return sendCode(req, res, AppCode.UNAUTHORIZED);

    // si no tienes email en token:
    let account = email;
    if (!account) {
      const info = await UsuarioModel.getOtpInfoById(userId);
      account = info?.email || `user-${userId}@awp.local`;
    }

    const secret = genSecretBase32();
    const uri = keyUri(account!, "AWP", secret);
    const pngDataUrl = await qrDataUrl(uri);

    // (Opcional) podrías guardarlo “temporal” y confirmar luego; aquí lo regresamos y confirmamos con /confirm
    return ok(req, res, { secret, otpauth_uri: uri, qrcode_png: pngDataUrl });
  } catch (e) { next(e); }
};

// Confirmar setup con el código que muestra Google Authenticator
export const confirmarSetupOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.sub as number | undefined;
    if (!userId) return sendCode(req, res, AppCode.UNAUTHORIZED);

    const { secret, code } = req.body as { secret: string; code: string };
    if (!verifyTotp(secret, code)) return sendCode(req, res, AppCode.OTP_INVALID);

    await UsuarioModel.setOtpSecret(userId, secret);
    const { plains, hashes } = genBackupCodes(8);
    await SecurityModel.saveBackupCodes(userId, hashes);

    return ok(req, res, { otp_enabled: true, backup_codes: plains });
  } catch (e) { next(e); }
};

// Recuperación: solicitar
export const solicitarRecuperacion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body as { email: string };
    const user = await UsuarioModel.findByEmail(email);
    if (user) {
      const raw = crypto.randomBytes(24).toString("hex");
      const hash = sha256(raw);
      const mins = Number(process.env.RECOVERY_TOKEN_MINUTES || 15);
      const expira = new Date(Date.now() + mins * 60_000);
      await SecurityModel.createRecoveryToken(user.id, hash, expira);
      const link = `${process.env.APP_URL}/reset?token=${raw}`;
      await sendMail(user.email, "Recupera tu contraseña",
        `<p>Link (expira en ${mins} min): <a href="${link}">${link}</a></p>`);
    }
    return ok(req, res, { info: "Si el correo existe, enviaremos instrucciones." });
  } catch (e) { next(e); }
};

// Recuperación: confirmar
export const confirmarRecuperacion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body as { token: string; newPassword: string };
    const uid = await SecurityModel.useRecoveryToken(sha256(token));
    if (!uid) return sendCode(req, res, AppCode.INVALID_CREDENTIALS);
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE usuarios SET password=$1 WHERE id=$2", [hashed, uid]);
    return ok(req, res, { reset: true });
  } catch (e) { next(e); }
};
