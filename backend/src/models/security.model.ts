// src/models/security.model.ts
import { pool } from "../db";

export const SecurityModel = {
  /** Guarda backup codes (hashes) */
  async saveBackupCodes(userId: number, hashes: string[]) {
    if (!hashes.length) return;
    const values = hashes.map((_, i) => `($1,$${i + 2})`).join(",");
    await pool.query(
      `INSERT INTO otp_backup_codes (user_id, code_hash) VALUES ${values}`,
      [userId, ...hashes]
    );
  },

  /** Consume un backup code (si existe y está sin usar) */
  async consumeBackupCode(userId: number, codeHash: string) {
    const sql = `
      UPDATE otp_backup_codes
         SET usado = true
       WHERE user_id=$1 AND code_hash=$2 AND usado=false
       RETURNING id
    `;
    const { rows } = await pool.query(sql, [userId, codeHash]);
    return rows[0];
  },

  /** Crea un token de recuperación de contraseña */
  async createRecoveryToken(
    userId: number,
    tokenHash: string,
    expiraEn: Date
  ) {
    const { rows } = await pool.query(
      `INSERT INTO recovery_tokens (user_id, token_hash, expira_en)
       VALUES ($1,$2,$3) RETURNING id`,
      [userId, tokenHash, expiraEn]
    );
    return rows[0];
  },

  /** Consume un token de recuperación (si es válido y no usado) */
  async useRecoveryToken(tokenHash: string) {
    const now = new Date();
    const { rows } = await pool.query(
      `UPDATE recovery_tokens
          SET usado=true
        WHERE token_hash=$1
          AND usado=false
          AND expira_en > $2
        RETURNING user_id`,
      [tokenHash, now]
    );
    return rows[0]?.user_id as number | undefined;
  },

  /** ⬇️ NUEVO: ¿Ya existe un OTP vigente para este usuario? */
  async hasPendingOtpWindow(userId: number) {
    const { rows } = await pool.query(
      `SELECT 1
         FROM otp_requests
        WHERE user_id=$1
          AND expires_at > NOW()
          AND delivered=true
        LIMIT 1`,
      [userId]
    );
    return !!rows[0];
  },

  /** ⬇️ NUEVO: Abre una ventana OTP (ej. 45 segundos) */
  async openOtpWindow(userId: number, seconds: number) {
    const { rows } = await pool.query(
      `INSERT INTO otp_requests (user_id, expires_at, delivered)
       VALUES ($1, NOW() + ($2 || ' seconds')::interval, true)
       RETURNING id`,
      [userId, seconds]
    );
    return rows[0]?.id;
  },
};
