// src/controllers/auth.controller.ts
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
import {
  createOfflinePinForUser,
  consumeOfflinePin,
  getClientIp,
  getUserAgent
} from "../services/offline";
import { enqueueMail } from "../services/emailQueue";
import { createSession } from "../services/sessions";
import {
  reverseGeocodeOSM,
  reverseGeocodeGoogle,
  inferGeo,
  osmLink
} from "../services/geo";
import { isOnline } from "../services/net"; // 👈 NUEVO

// === Config ===
const JWT = process.env.JWT_SECRET as string;
const JWT_PRE = process.env.JWT_PREAUTH_SECRET as string;
const JWT_OFFLINE = process.env.JWT_OFFLINE_SECRET || "dev-offline-secret";
const ACCESS_TTL_MS = Number(process.env.JWT_EXPIRES_MIN || 60) * 60 * 1000;

// === Helpers de timeout para no bloquear ===
async function withTimeout<T>(p: Promise<T>, ms = 800): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  ]) as any;
}

/** Enviar correo o encolarlo si falla SMTP */
async function sendOrQueue(email: string, subject: string, html: string) {
  try {
    await sendMail(email, subject, html);
  } catch {
    await enqueueMail(email, `${subject} [DIFERIDO]`, html);
  }
}

/** Notificación con modo (online/offline) + ubicación legible (OSM → Google fallback) */
type LoginMode = "online" | "offline";
async function notifyLogin(params: {
  to: string;
  mode: LoginMode;
  ip?: string;
  userAgent?: string;
  geo?: { lat?: number; lon?: number; accuracy_m?: number };
  subject?: string;
}) {
  const { to, mode, ip, userAgent, geo } = params;
  const subject = params.subject ?? "Inicio de sesión";

  let whereLine = "Ubicación: (no disponible)";
  let mapHref: string | null = null;

  if (geo?.lat != null && geo?.lon != null) {
    // Reverse geocoding con límites de tiempo para no bloquear
    let rev = await withTimeout(reverseGeocodeOSM(geo.lat, geo.lon), 800);
    if (!rev) rev = await withTimeout(reverseGeocodeGoogle(geo.lat, geo.lon), 800);

    const pretty = rev?.short || `${geo.lat.toFixed(5)}, ${geo.lon.toFixed(5)}`;
    const acc = geo.accuracy_m ? ` (~±${Math.round(geo.accuracy_m)}m)` : "";
    whereLine = `Ubicación: ${pretty}${acc}`;
    mapHref = osmLink(geo.lat, geo.lon);
  }

  const modeLine = mode === "offline"
    ? "cuando <b>no había conexión</b> (modo PIN offline)"
    : "correctamente";

  const html =
    `<p>Se inició sesión ${modeLine}.</p>
     <p><b>IP:</b> ${ip ?? ""}<br/><b>Agente:</b> ${userAgent ?? ""}</p>
     <p>${whereLine}${mapHref ? ` — <a href="${mapHref}" target="_blank" rel="noopener">Ver en mapa</a>` : ""}</p>`;

  await sendOrQueue(to, subject, html);
}

/** Auditoría */
async function auditLogin(params: {
  userId?: number;
  req: Request;
  metodo: string;
  exito: boolean;
  detalle?: string | null;
  geo?: { lat?: number; lon?: number; accuracy_m?: number };
}) {
  const { userId, req, metodo, exito, detalle, geo } = params;
  try {
    await pool.query(
      `INSERT INTO login_audit (user_id, ip, user_agent, metodo, exito, detalle, latitud, longitud, accuracy_m)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        userId ?? null,
        getClientIp(req),
        getUserAgent(req),
        metodo,
        exito,
        detalle ?? null,
        geo?.lat ?? null,
        geo?.lon ?? null,
        geo?.accuracy_m ?? null
      ]
    );
  } catch (e) {
    console.warn("[AUDIT] fallo al registrar auditoría:", e);
  }
}

// === Paso 1: login con password (SOLO email y password) ===
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Geo inferida (con tope para no bloquear)
    const geo = (await withTimeout(inferGeo(req), 700)) ?? undefined;

    // 🔎 Conectividad rápida (≤ ~0.5–0.7s)
    const online = (await withTimeout(isOnline(), 700)) ?? false;

    const { email, password } = req.body as { email: string; password: string };

    const { rows } = await pool.query(
      "SELECT id,nombre,email,password,rol,otp_enabled FROM usuarios WHERE email=$1", [email]
    );
    const user = rows[0];
    if (!user) {
      await auditLogin({ req, metodo: "password", exito: false, detalle: "usuario no existe", geo });
      return sendCode(req, res, AppCode.INVALID_CREDENTIALS);
    }

    const okPass = await bcrypt.compare(password, user.password);
    if (!okPass) {
      await auditLogin({ userId: user.id, req, metodo: "password", exito: false, detalle: "password inválido", geo });
      return sendCode(req, res, AppCode.INVALID_CREDENTIALS);
    }

    // Usuario SIN OTP → requiere enrolamiento
    if (!user.otp_enabled) {
      const preAuth = jwt.sign({ uid: user.id }, JWT_PRE, { expiresIn: "10m" });

      await auditLogin({
        userId: user.id,
        req,
        metodo: "password+preAuth (needs-enrollment)",
        exito: true,
        geo
      });

      return ok(req, res, {
        requiresOtp: true,
        needsEnrollment: true,
        preAuth
      });
    }

    // Verificar que realmente exista secreto TOTP
    const info = await UsuarioModel.getOtpInfoById(user.id);
    if (!info?.otp_secret) {
      const preAuth = jwt.sign({ uid: user.id }, JWT_PRE, { expiresIn: "10m" });
      await auditLogin({
        userId: user.id,
        req,
        metodo: "password+preAuth (otp-missing-secret)",
        exito: true,
        geo
      });
      return ok(req, res, {
        requiresOtp: true,
        needsEnrollment: true,
        preAuth
      });
    }

    // === OTP habilitado y con secreto válido ===
    const preAuth = jwt.sign({ uid: user.id }, JWT_PRE, { expiresIn: "5m" });

    if (online) {
      // ✅ ONLINE → NO incluir offline. Enviar OTP en background (no bloquea respuesta)
      setImmediate(async () => {
        try {
          const code = genTotp(info.otp_secret!);
          await sendOrQueue(
            user.email,
            "Tu código OTP",
            `<p>Tu código de acceso es: <b>${code}</b> (válido ~30s)</p>`
          );
        } catch {
          // Si falla SMTP, el usuario igual puede usar su app TOTP
        }
      });

      await auditLogin({
        userId: user.id,
        req,
        metodo: "password+preAuth (online)",
        exito: true,
        geo
      });

      return ok(req, res, { requiresOtp: true, preAuth });
    } else {
      // 🚫 OFFLINE → generar credenciales offline
      const offline = await createOfflinePinForUser(user.id, geo);

      await auditLogin({
        userId: user.id,
        req,
        metodo: "password+preAuth (offline-ready)",
        exito: true,
        geo
      });

      return ok(req, res, { requiresOtp: true, preAuth, offline });
    }
  } catch (e) { next(e); }
};

// Paso 2: verificar OTP / backup → token final
export const verificarOtpLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Geo con timeout
    const geo = (await withTimeout(inferGeo(req), 700)) ?? undefined;

    const { preAuth, code, deviceId } = req.body as { preAuth: string; code: string; deviceId?: string };

    let uid: number | undefined;
    try {
      const p = jwt.verify(preAuth, JWT_PRE) as any;
      uid = p.uid;
    } catch {
      await auditLogin({ req, metodo: "preAuth+totp", exito: false, detalle: "preAuth inválido/expirado", geo });
      return sendCode(req, res, AppCode.OTP_INVALID);
    }

    const info = await UsuarioModel.getOtpInfoById(uid!);
    if (!info?.otp_enabled || !info.otp_secret) {
      await auditLogin({ userId: uid, req, metodo: "preAuth+totp", exito: false, detalle: "usuario sin OTP", geo });
      return sendCode(req, res, AppCode.OTP_INVALID);
    }

    let okCode = verifyTotp(info.otp_secret, code);
    if (!okCode) {
      const used = await SecurityModel.consumeBackupCode(uid!, sha256(code));
      okCode = !!used;
    }
    if (!okCode) {
      await auditLogin({ userId: uid, req, metodo: "preAuth+totp", exito: false, detalle: "código inválido", geo });
      return sendCode(req, res, AppCode.OTP_INVALID);
    }

    const { rows } = await pool.query("SELECT rol, email FROM usuarios WHERE id=$1", [uid]);

    const jti = crypto.randomUUID();
    const token = jwt.sign({ sub: uid, rol: rows[0]?.rol || "lector", jti }, JWT, { expiresIn: "1h" });
    const expiresAt = new Date(Date.now() + ACCESS_TTL_MS);

    await createSession({
      userId: uid!,
      jti,
      expiresAt,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      deviceId: deviceId || null,
      geo
    });

    await auditLogin({ userId: uid, req, metodo: "password+totp", exito: true, detalle: deviceId || null, geo });

    // Notificación sin bloquear la respuesta
    setImmediate(() => notifyLogin({
      to: rows[0].email,
      mode: "online",
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      geo
    }).catch(() => {}));

    return ok(req, res, { token });
  } catch (e) { next(e); }
};

// Paso 2 alterno: canjear PIN offline
export const verificarOtpOffline = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Geo con timeout
    const geo = (await withTimeout(inferGeo(req), 700)) ?? undefined;

    const { preAuth, offlineJwt, pin, deviceId } = req.body as { preAuth: string; offlineJwt: string; pin: string; deviceId?: string };

    let uid: number | undefined;
    try {
      const p = jwt.verify(preAuth, JWT_PRE) as any;
      uid = p.uid;
    } catch {
      await auditLogin({ req, metodo: "preAuth+offlinePin", exito: false, detalle: "preAuth inválido/expirado", geo });
      return sendCode(req, res, AppCode.OTP_INVALID);
    }

    let offPayload: any;
    try {
      offPayload = jwt.verify(offlineJwt, JWT_OFFLINE);
    } catch {
      await auditLogin({ userId: uid, req, metodo: "preAuth+offlinePin", exito: false, detalle: "offlineJwt inválido", geo });
      return sendCode(req, res, AppCode.OTP_INVALID);
    }

    if (!offPayload || offPayload.typ !== "offline-pin" || offPayload.uid !== uid) {
      await auditLogin({ userId: uid, req, metodo: "preAuth+offlinePin", exito: false, detalle: "payload no coincide", geo });
      return sendCode(req, res, AppCode.OTP_INVALID);
    }

    const okOnce = await consumeOfflinePin(uid!, offPayload.jti, pin, geo);
    if (!okOnce) {
      await auditLogin({ userId: uid, req, metodo: "preAuth+offlinePin", exito: false, detalle: "PIN inválido/expirado", geo });
      return sendCode(req, res, AppCode.OTP_INVALID);
    }

    const { rows } = await pool.query("SELECT rol, email FROM usuarios WHERE id=$1", [uid]);

    const jti = crypto.randomUUID();
    const token = jwt.sign({ sub: uid, rol: rows[0]?.rol || "lector", jti }, JWT, { expiresIn: "1h" });
    const expiresAt = new Date(Date.now() + ACCESS_TTL_MS);

    await createSession({
      userId: uid!,
      jti,
      expiresAt,
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      deviceId: deviceId || null,
      geo
    });

    await auditLogin({ userId: uid, req, metodo: "preAuth+offlinePin", exito: true, detalle: deviceId || null, geo });

    // Notificación sin bloquear la respuesta
    setImmediate(() => notifyLogin({
      to: rows[0].email,
      mode: "offline",
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      geo
    }).catch(() => {}));

    return ok(req, res, { token });
  } catch (e) { next(e); }
};

// ====== Setup OTP por preAuth (no requiere access token) ======
export const iniciarSetupOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preAuth } = req.body as { preAuth?: string };
    if (!preAuth) return sendCode(req, res, AppCode.UNAUTHORIZED);

    let userId: number;
    try {
      const p = jwt.verify(preAuth, JWT_PRE) as any;
      userId = Number(p.uid);
    } catch {
      return sendCode(req, res, AppCode.UNAUTHORIZED);
    }

    const info = await UsuarioModel.getOtpInfoById(userId);
    const account = info?.email || `user-${userId}@awp.local`;

    const secret = genSecretBase32();
    const uri = keyUri(account, "AWP", secret);
    const pngDataUrl = await qrDataUrl(uri);

    return ok(req, res, { secret, otpauth_uri: uri, qrcode_png: pngDataUrl });
  } catch (e) { next(e); }
};

export const confirmarSetupOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preAuth, secret, code } = req.body as { preAuth?: string; secret: string; code: string };
    if (!preAuth) return sendCode(req, res, AppCode.UNAUTHORIZED);

    let userId: number;
    try {
      const p = jwt.verify(preAuth, JWT_PRE) as any;
      userId = Number(p.uid);
    } catch {
      return sendCode(req, res, AppCode.UNAUTHORIZED);
    }

    if (!verifyTotp(secret, code)) return sendCode(req, res, AppCode.OTP_INVALID);

    await UsuarioModel.setOtpSecret(userId, secret);
    const { plains, hashes } = genBackupCodes(8);
    await SecurityModel.saveBackupCodes(userId, hashes);

    return ok(req, res, { otp_enabled: true, backup_codes: plains });
  } catch (e) { next(e); }
};

// ====== Recuperación de contraseña (igual) ======
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
      await sendOrQueue(
        user.email,
        "Recupera tu contraseña",
        `<p>Solicitaste recuperar tu contraseña.</p>
         <p>Enlace (expira en ${mins} min): <a href="${link}">${link}</a></p>`
      );
    }
    return ok(req, res, { info: "Si el correo existe, enviaremos instrucciones." });
  } catch (e) { next(e); }
};

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
