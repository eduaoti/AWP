import { pool } from "../db";
import { sendMail } from "./mail";

export async function enqueueMail(to: string, subject: string, html: string) {
  await pool.query(
    `INSERT INTO email_queue (destinatario, asunto, html) VALUES ($1,$2,$3)`,
    [to, subject, html]
  );
}

export async function processEmailQueueOnce() {
  // toma pocos a la vez para no saturar
  const { rows } = await pool.query(
    `SELECT id, destinatario, asunto, html, intentos
       FROM email_queue
      WHERE sent_at IS NULL
      ORDER BY scheduled_at ASC
      LIMIT 20`
  );

  for (const r of rows) {
    try {
      await sendMail(r.destinatario, r.asunto, r.html);
      await pool.query(`UPDATE email_queue SET sent_at=NOW() WHERE id=$1`, [r.id]);
    } catch (err: any) {
      await pool.query(
        `UPDATE email_queue
            SET intentos=intentos+1, last_error=$2, scheduled_at=NOW() + INTERVAL '60 seconds'
          WHERE id=$1`,
        [r.id, String(err?.message || err)]
      );
    }
  }
}
