import { pool } from "../db";

export const SecurityModel = {
  async saveBackupCodes(userId: number, hashes: string[]) {
    if (!hashes.length) return;
    const values = hashes.map((_, i) => `($1,$${i+2})`).join(",");
    await pool.query(
      `INSERT INTO otp_backup_codes (user_id, code_hash) VALUES ${values}`,
      [userId, ...hashes]
    );
  },

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

  async createRecoveryToken(userId: number, tokenHash: string, expiraEn: Date) {
    const { rows } = await pool.query(
      `INSERT INTO recovery_tokens (user_id, token_hash, expira_en)
       VALUES ($1,$2,$3) RETURNING id`,
      [userId, tokenHash, expiraEn]
    );
    return rows[0];
  },

  async useRecoveryToken(tokenHash: string) {
    const now = new Date();
    const { rows } = await pool.query(
      `UPDATE recovery_tokens
       SET usado=true
       WHERE token_hash=$1 AND usado=false AND expira_en > $2
       RETURNING user_id`,
      [tokenHash, now]
    );
    return rows[0]?.user_id as number | undefined;
  }
};
