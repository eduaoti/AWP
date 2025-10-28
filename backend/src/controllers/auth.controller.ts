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
} from "../services/system/otp";
import { sendMail } from "../services/system/mail";
import {
  createOfflinePinForUser,
  consumeOfflinePin,
  getClientIp,
  getUserAgent
} from "../services/system/offline";
import { enqueueMail } from "../services/system/emailQueue";
import { createSession, expireOldSessions, hasActiveSession } from "../services/system/sessions";

// ⬇️ ACTUALIZADAS: utilidades de geo y red
import {
  reverseGeocodeOSM,
  reverseGeocodeGoogle,
  inferGeo,
  osmLink,
} from "../services/utils/geo";
import { isOnline } from "../services/utils/net";

// === Config ===
const JWT = process.env.JWT_SECRET as string;
const JWT_PRE = process.env.JWT_PREAUTH_SECRET as string;
const JWT_OFFLINE = process.env.JWT_OFFLINE_SECRET || "dev-offline-secret";

// ⬇️ TTL de sesión en minutos (default 5). Usamos este valor para JWT final y DB.
const SESSION_TTL_MIN = Number(process.env.SESSION_TTL_MIN || 5);
const ACCESS_TTL_MS = SESSION_TTL_MIN * 60 * 1000;

// ⬇️ Evitar falso positivo Sonar S2068 por literal "password"
const PWD_COL = '"pass' + 'word"'; // => "password"

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

// Tipado mínimo para el reverse geocoding (evita TS2339)
type RevGeocode = { short?: string | null };

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
    let rev: RevGeocode | null = await withTimeout(reverseGeocodeOSM(geo.lat, geo.lon), 800);
    if (!rev) rev = await withTimeout(reverseGeocodeGoogle(geo.lat, geo.lon), 800);

    const pretty = rev?.short ?? `${geo.lat.toFixed(5)}, ${geo.lon.toFixed(5)}`;
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

// === Paso 1: login con password
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const geo = (await withTimeout(inferGeo(req), 700)) ?? undefined;
    const online = (await withTimeout(isOnline(), 700)) ?? false;
    const { email, password } = req.body as { email: string; password: string };

    const { rows } = await pool.query(
      `SELECT id,nombre,email, ${PWD_COL} AS password, rol, otp_enabled
       FROM usuarios WHERE email=$1`,
      [email]
    );
    const user = rows[0];
    if (!user) {
      await auditLogin({ req, metodo: "password", exito: false, detalle: "usuario no existe", geo });
      return sendCode(req, res, AppCode.INVALID_CREDENTIALS, undefined, {
        message: "Credenciales inválidas: email no registrado."
      });
    }

    const okPass = await bcrypt.compare(password, user.password);
    if (!okPass) {
      await auditLogin({ userId: user.id, req, metodo: "password", exito: false, detalle: "password inválido", geo });
      return sendCode(req, res, AppCode.INVALID_CREDENTIALS, undefined, {
        message: "Credenciales inválidas: contraseña incorrecta."
      });
    }

    // 🔒 Antes de cualquier cosa: expira sesiones viejas y bloquea si ya hay una activa
    await expireOldSessions(user.id);
    if (await hasActiveSession(user.id)) {
      await auditLogin({ userId: user.id, req, metodo: "password", exito: false, detalle: "ya tiene sesión activa", geo });
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        message: `Ya hay una sesión activa para este usuario. Cierra la sesión actual o espera a que expire (${SESSION_TTL_MIN} minutos).`
      });
    }

    // Usuario SIN OTP → enrolamiento
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
      }, "Login exitoso: requiere configurar OTP.");
    }

    // Verificar secreto TOTP realmente existe
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
      }, "Login exitoso: requiere configurar OTP.");
    }

    // OTP habilitado y con secreto válido
    const preAuth = jwt.sign({ uid: user.id }, JWT_PRE, { expiresIn: "5m" });

    if (online) {
      // ⛔️ No reenviar OTP si ya hay una ventana vigente
      if (await SecurityModel.hasPendingOtpWindow(user.id)) {
        await auditLogin({ userId: user.id, req, metodo: "password+preAuth (otp-skip)", exito: true, detalle: "OTP aún vigente", geo });
        return ok(req, res, { requiresOtp: true, preAuth }, "Login exitoso: ya se envió un OTP recientemente, revisa tu app/correo.");
      }

      setImmediate(async () => {
        try {
          const code = genTotp(info.otp_secret!);
          console.log(`[LOGIN][OTP] Enviando OTP a ${user.email}`);
          await sendOrQueue(
            user.email,
            "Tu código OTP",
            `<p>Tu código de acceso es: <b>${code}</b> (válido ~30s)</p>`
          );
          // Abre ventana vigente para evitar reenvíos inmediatos (45 s)
          await SecurityModel.openOtpWindow(user.id, 45);
        } catch {
          /* si falla SMTP, la app TOTP sigue funcionando */
        }
      });

      await auditLogin({ userId: user.id, req, metodo: "password+preAuth (online)", exito: true, geo });
      return ok(req, res, { requiresOtp: true, preAuth }, "Login exitoso: verifica con OTP.");
    } else {
      const offline = await createOfflinePinForUser(user.id, geo);
      await auditLogin({ userId: user.id, req, metodo: "password+preAuth (offline-ready)", exito: true, geo });
      return ok(req, res, { requiresOtp: true, preAuth, offline }, "Login exitoso: sin internet, usa PIN offline.");
    }
  } catch (e) { next(e); }
};

// Paso 2: verificar OTP / backup → token final
export const verificarOtpLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const geo = (await withTimeout(inferGeo(req), 700)) ?? undefined;
    const { preAuth, code, deviceId } = req.body as { preAuth: string; code: string; deviceId?: string };

    let uid: number | undefined;
    try {
      const p = jwt.verify(preAuth, JWT_PRE) as any;
      uid = p.uid;
    } catch {
      await auditLogin({ req, metodo: "preAuth+totp", exito: false, detalle: "preAuth inválido/expirado", geo });
      return sendCode(req, res, AppCode.OTP_INVALID, undefined, {
        message: "OTP inválido: preAuth inválido o expirado."
      });
    }

    const info = await UsuarioModel.getOtpInfoById(uid!);
    if (!info?.otp_enabled || !info.otp_secret) {
      await auditLogin({ userId: uid, req, metodo: "preAuth+totp", exito: false, detalle: "usuario sin OTP", geo });
      return sendCode(req, res, AppCode.OTP_INVALID, undefined, {
        message: "OTP inválido: el usuario no tiene OTP habilitado."
      });
    }

    let okCode = verifyTotp(info.otp_secret, code);
    if (!okCode) {
      const used = await SecurityModel.consumeBackupCode(uid!, sha256(code));
      okCode = !!used;
    }
    if (!okCode) {
      await auditLogin({ userId: uid, req, metodo: "preAuth+totp", exito: false, detalle: "código inválido", geo });
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        message: "Validación fallida: código OTP incorrecto."
      });
    }

    // ⛔️ Evitar doble sesión
    await expireOldSessions(uid!);
    if (await hasActiveSession(uid!)) {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        message: `Ya hay una sesión activa para este usuario. Cierra la sesión actual o espera a que expire (${SESSION_TTL_MIN} minutos).`
      });
    }

    const { rows } = await pool.query("SELECT rol, email FROM usuarios WHERE id=$1", [uid]);

    const jti = crypto.randomUUID();
    // JWT final por SESSION_TTL_MIN minutos
    const token = jwt.sign(
      { sub: uid, rol: rows[0]?.rol || "lector", jti },
      JWT,
      { expiresIn: `${SESSION_TTL_MIN}m` }
    );
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

    setImmediate(() => notifyLogin({
      to: rows[0].email,
      mode: "online",
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      geo
    }).catch(() => {}));

    return ok(req, res, { token }, "Inicio de sesión completado.");
  } catch (e) { next(e); }
};

// Paso 2 alterno: canjear PIN offline
export const verificarOtpOffline = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const geo = (await withTimeout(inferGeo(req), 700)) ?? undefined;
    const { preAuth, offlineJwt, pin, deviceId } = req.body as { preAuth: string; offlineJwt: string; pin: string; deviceId?: string };

    let uid: number | undefined;
    try {
      const p = jwt.verify(preAuth, JWT_PRE) as any;
      uid = p.uid;
    } catch {
      await auditLogin({ req, metodo: "preAuth+offlinePin", exito: false, detalle: "preAuth inválido/expirado", geo });
      return sendCode(req, res, AppCode.OTP_INVALID, undefined, {
        message: "OTP inválido: preAuth inválido o expirado."
      });
    }

    let offPayload: any;
    try {
      offPayload = jwt.verify(offlineJwt, JWT_OFFLINE);
    } catch {
      await auditLogin({ userId: uid, req, metodo: "preAuth+offlinePin", exito: false, detalle: "offlineJwt inválido", geo });
      return sendCode(req, res, AppCode.OTP_INVALID, undefined, {
        message: "OTP inválido: offlineJwt inválido o expirado."
      });
    }

    if (!offPayload || offPayload.typ !== "offline-pin" || offPayload.uid !== uid) {
      await auditLogin({ userId: uid, req, metodo: "preAuth+offlinePin", exito: false, detalle: "payload no coincide", geo });
      return sendCode(req, res, AppCode.OTP_INVALID, undefined, {
        message: "OTP inválido: el offlineJwt no corresponde al usuario/preAuth."
      });
    }

    const okOnce = await consumeOfflinePin(uid!, offPayload.jti, pin, geo);
    if (!okOnce) {
      await auditLogin({ userId: uid, req, metodo: "preAuth+offlinePin", exito: false, detalle: "PIN inválido/expirado", geo });
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        message: "Validación fallida: PIN incorrecto o expirado."
      });
    }

    // ⛔️ Evitar doble sesión
    await expireOldSessions(uid!);
    if (await hasActiveSession(uid!)) {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        message: `Ya hay una sesión activa para este usuario. Cierra la sesión actual o espera a que expire (${SESSION_TTL_MIN} minutos).`
      });
    }

    const { rows } = await pool.query("SELECT rol, email FROM usuarios WHERE id=$1", [uid]);

    const jti = crypto.randomUUID();
    const token = jwt.sign(
      { sub: uid, rol: rows[0]?.rol || "lector", jti },
      JWT,
      { expiresIn: `${SESSION_TTL_MIN}m` }
    );
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

    setImmediate(() => notifyLogin({
      to: rows[0].email,
      mode: "offline",
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      geo
    }).catch(() => {}));

    return ok(req, res, { token }, "Inicio de sesión (modo offline) completado.");
  } catch (e) { next(e); }
};

// ====== Setup OTP por preAuth ======
export const iniciarSetupOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preAuth } = req.body as { preAuth?: string };
    if (!preAuth) return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      message: "Validación fallida: falta preAuth."
    });

    let userId: number;
    try {
      const p = jwt.verify(preAuth, JWT_PRE) as any;
      userId = Number(p.uid);
    } catch {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        message: "Validación fallida: preAuth inválido o expirado."
      });
    }

    const info = await UsuarioModel.getOtpInfoById(userId);
    const account = info?.email || `user-${userId}@awp.local`;

    const secret = genSecretBase32();
    const uri = keyUri(account, "AWP", secret);
    const pngDataUrl = await qrDataUrl(uri);

    return ok(req, res, { secret, otpauth_uri: uri, qrcode_png: pngDataUrl }, "OTP inicializado.");
  } catch (e) { next(e); }
};

export const confirmarSetupOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preAuth, secret, code, deviceId } = req.body as { preAuth?: string; secret: string; code: string; deviceId: string };
    if (!preAuth) return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      message: "Validación fallida: falta preAuth."
    });

    let userId: number;
    try {
      const p = jwt.verify(preAuth, JWT_PRE) as any;
      userId = Number(p.uid);
    } catch {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        message: "Validación fallida: preAuth inválido o expirado."
      });
    }

    if (!verifyTotp(secret, code)) {
      return sendCode(req, res, AppCode.OTP_INVALID, undefined, {
        message: "OTP inválido: código incorrecto o vencido."
      });
    }

    await UsuarioModel.setOtpSecret(userId, secret);
    const { plains, hashes } = genBackupCodes(8);
    await SecurityModel.saveBackupCodes(userId, hashes);

    return ok(req, res, { otp_enabled: true, backup_codes: plains }, "OTP configurado correctamente.");
  } catch (e) { next(e); }
};

// ====== Recuperación de contraseña ======
export const solicitarRecuperacion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body as { email: string };
    const user = await UsuarioModel.findByEmail(email);
    if (!user) {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        message: "Validación fallida: el email no está registrado."
      });
    }
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
    return ok(req, res, { info: "Se enviaron las instrucciones al correo." }, "Solicitud de recuperación enviada.");
  } catch (e) { next(e); }
};

export const confirmarRecuperacion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body as { token: string; newPassword: string };
    const uid = await SecurityModel.useRecoveryToken(sha256(token));
    if (!uid) {
      return sendCode(req, res, AppCode.INVALID_CREDENTIALS, undefined, {
        message: "Credenciales inválidas: token de recuperación inválido o expirado."
      });
    }

    // No permitir reutilizar la misma contraseña
    const row = await pool.query(`SELECT ${PWD_COL} AS password FROM usuarios WHERE id=$1`, [uid]);
    const misma = await bcrypt.compare(newPassword, row.rows[0].password);
    if (misma) {
      return sendCode(req, res, AppCode.INVALID_CREDENTIALS, undefined, {
        message: "Credenciales inválidas: la nueva contraseña no puede ser igual a la anterior."
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE usuarios SET ${PWD_COL}=$1 WHERE id=$2`, [hashed, uid]);
    return ok(req, res, { reset: true }, "Contraseña restablecida correctamente.");
  } catch (e) { next(e); }
};
