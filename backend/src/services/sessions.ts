import { pool } from "../db";

export async function createSession(params: {
  userId: number;
  jti: string;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
  deviceId?: string | null;
  geo?: { lat?: number; lon?: number; accuracy_m?: number };
}) {
  const { userId, jti, expiresAt, ip, userAgent, deviceId, geo } = params;
  await pool.query(
    `INSERT INTO user_sessions
      (user_id, jti, expires_at, ip, user_agent, device_id, latitud, longitud, accuracy_m, issued_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
    [
      userId, jti, expiresAt,
      ip ?? null, userAgent ?? null,
      deviceId ?? null,
      geo?.lat ?? null, geo?.lon ?? null, geo?.accuracy_m ?? null
    ]
  );
}

export async function touchSession(jti: string) {
  await pool.query(
    `UPDATE user_sessions SET last_seen = NOW()
      WHERE jti=$1 AND revoked=false`,
    [jti]
  );
}

export async function revokeSession(jti: string) {
  await pool.query(
    `UPDATE user_sessions
        SET revoked=true, revoked_at=NOW()
      WHERE jti=$1 AND revoked=false`,
    [jti]
  );
}

export async function revokeAllSessions(userId: number) {
  await pool.query(
    `UPDATE user_sessions
        SET revoked=true, revoked_at=NOW()
      WHERE user_id=$1 AND revoked=false`,
    [userId]
  );
}

export async function listMySessions(userId: number) {
  const { rows } = await pool.query(
    `SELECT id, jti, issued_at, expires_at, revoked, revoked_at,
            device_id, ip, user_agent, latitud, longitud, accuracy_m, last_seen
       FROM user_sessions
      WHERE user_id=$1
      ORDER BY issued_at DESC
      LIMIT 50`,
    [userId]
  );
  return rows;
}
