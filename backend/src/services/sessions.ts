// src/services/sessions.ts
import { pool } from "../db";

type Geo = { lat?: number; lon?: number; accuracy_m?: number };

/** Marca como expiradas las sesiones vencidas de un usuario */
export async function expireOldSessions(userId: number) {
  await pool.query(
    `UPDATE user_sessions
       SET status='expired', revoked=true, revoked_at=NOW()
     WHERE user_id=$1
       AND status='active'
       AND revoked=false
       AND expires_at <= NOW()`,
    [userId]
  );
}

/** ¿Existe ya una sesión activa vigente para este usuario? */
export async function hasActiveSession(userId: number) {
  const { rows } = await pool.query(
    `SELECT 1
       FROM user_sessions
      WHERE user_id=$1
        AND status='active'
        AND revoked=false
        AND expires_at > NOW()
      LIMIT 1`,
    [userId]
  );
  return !!rows[0];
}

/** Cierra (logout) una sesión activa por jti */
export async function closeSessionByJti(userId: number, jti: string) {
  await pool.query(
    `UPDATE user_sessions
        SET status='closed', revoked=true, revoked_at=NOW()
      WHERE user_id=$1 AND jti=$2 AND status='active'`,
    [userId, jti]
  );
}

/** Crea una nueva sesión; bloquea si ya hay una activa */
export async function createSession(params: {
  userId: number;
  jti: string;
  expiresAt: Date;
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  geo?: Geo;
}) {
  const { userId, jti, expiresAt, ip, userAgent, deviceId, geo } = params;

  // 1) Expira sesiones viejas automáticamente
  await expireOldSessions(userId);

  // 2) Bloquea multisesión
  const { rows: act } = await pool.query(
    `SELECT id FROM user_sessions
      WHERE user_id=$1 AND status='active' AND revoked=false AND expires_at>NOW()
      LIMIT 1`,
    [userId]
  );
  if (act[0]) {
    // Lanza error tipado si prefieres manejarlo arriba
    const err: any = new Error("Ya hay una sesión activa");
    err.appCode = 1;        // usa tu AppCode.VALIDATION_FAILED si lo integras
    err.httpStatus = 400;
    err.message =
      "Ya tienes una sesión activa; ciérrala o espera a que expire (5 minutos).";
    throw err;
  }

  // 3) Inserta la nueva sesión como 'active'
  await pool.query(
    `INSERT INTO user_sessions
       (user_id, jti, issued_at, expires_at, revoked, status,
        device_id, ip, user_agent, latitud, longitud, accuracy_m, last_seen)
     VALUES
       ($1,$2,NOW(),$3,false,'active',
        $4,$5,$6,$7,$8,$9,NOW())`,
    [
      userId,
      jti,
      expiresAt,
      deviceId ?? null,
      ip ?? null,
      userAgent ?? null,
      geo?.lat ?? null,
      geo?.lon ?? null,
      geo?.accuracy_m ?? null,
    ]
  );
}

/** Marca “actividad” de una sesión (solo si sigue activa y no revocada) */
export async function touchSession(jti: string) {
  await pool.query(
    `UPDATE user_sessions
        SET last_seen = NOW()
      WHERE jti=$1
        AND revoked=false
        AND status='active'
        AND expires_at > NOW()`,
    [jti]
  );
}

/** Revoca por jti → estado = closed */
export async function revokeSession(jti: string) {
  await pool.query(
    `UPDATE user_sessions
        SET revoked=true, revoked_at=NOW(), status='closed'
      WHERE jti=$1 AND revoked=false`,
    [jti]
  );
}

/** Revoca todas las sesiones vigentes del usuario → estado = closed */
export async function revokeAllSessions(userId: number) {
  await pool.query(
    `UPDATE user_sessions
        SET revoked=true, revoked_at=NOW(), status='closed'
      WHERE user_id=$1 AND revoked=false AND status='active'`,
    [userId]
  );
}

/** Lista las últimas sesiones del usuario (incluye status) */
export async function listMySessions(userId: number) {
  const { rows } = await pool.query(
    `SELECT id, jti, issued_at, expires_at, revoked, revoked_at,
            device_id, ip, user_agent, latitud, longitud, accuracy_m, last_seen,
            status
       FROM user_sessions
      WHERE user_id=$1
      ORDER BY issued_at DESC
      LIMIT 50`,
    [userId]
  );
  return rows;
}
