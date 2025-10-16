// src/services/emailQueue.ts
import { pool } from "../db";
import { sendMail } from "./mail";
import { UsuarioModel } from "../models/usuario.model";

// ===== Config por ambiente =====
const EMAIL_QUEUE_LIMIT = Number(process.env.EMAIL_QUEUE_LIMIT ?? 20);
const EMAIL_QUEUE_MAX_ATTEMPTS = Number(process.env.EMAIL_QUEUE_MAX_ATTEMPTS ?? 5);
const EMAIL_QUEUE_RETRY_SECONDS = Number(process.env.EMAIL_QUEUE_RETRY_SECONDS ?? 60);

export async function enqueueMail(to: string, subject: string, html: string) {
  await pool.query(
    `INSERT INTO email_queue (destinatario, asunto, html) VALUES ($1,$2,$3)`,
    [to.trim(), subject, html]
  );
}

type EmailQueueRow = {
  id: number;
  destinatario: string;
  asunto: string;
  html: string;
  intentos: number;
};

export async function processEmailQueueOnce() {
  // Toma pocos a la vez para no saturar
  const { rows } = await pool.query<EmailQueueRow>(
    `SELECT id, destinatario, asunto, html, intentos
       FROM email_queue
      WHERE sent_at IS NULL
      ORDER BY scheduled_at ASC
      LIMIT $1`,
    [EMAIL_QUEUE_LIMIT]
  );

  for (const r of rows) {
    // Si excede intentos máximos, no reintentar (queda encolado como "atascado")
    if (r.intentos >= EMAIL_QUEUE_MAX_ATTEMPTS) {
      // Puedes moverlos a una tabla de dead-letter si quieres en el futuro
      continue;
    }

    try {
      await sendMail(r.destinatario, r.asunto, r.html);
      await pool.query(`UPDATE email_queue SET sent_at=NOW() WHERE id=$1`, [r.id]);
    } catch (err: any) {
      // Reprograma con backoff lineal simple
      const delay = EMAIL_QUEUE_RETRY_SECONDS * (r.intentos + 1);
      await pool.query(
        `UPDATE email_queue
            SET intentos = intentos + 1,
                last_error = $2,
                scheduled_at = NOW() + make_interval(secs => $3)
          WHERE id = $1`,
        [r.id, String(err?.message || err), delay]
      );
    }
  }
}

/* ===========================================================
   🚨 Helper: Encolar alerta de bajo stock al jefe de inventario
   - items: array de productos con stock_actual < stock_minimo
   - retorna info útil para logging/diagnóstico
   =========================================================== */
export async function enqueueLowStockAlertToChief(items: Array<any>): Promise<{
  to: string | null;
  enqueued: boolean;
  count: number;
}> {
  const to = await UsuarioModel.findInventoryChiefEmail();
  if (!to) {
    return { to: null, enqueued: false, count: items.length };
  }

  const html = buildLowStockHtml(items);
  await enqueueMail(to, `Alertas de bajo stock (${items.length})`, html);

  return { to, enqueued: true, count: items.length };
}
/* ===========================================================
   🧱 Generador de HTML para las alertas de bajo stock
   =========================================================== */
function buildLowStockHtml(items: Array<any>): string {
  // Formateador numérico consistente (2 decimales, es-MX)
  const nf = new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const rows = items
    .map((p) => {
      const clave = escapeHtml(p?.clave ?? "");
      const nombre = escapeHtml(p?.nombre ?? "");
      const stockActualNum = Number(p?.stock_actual ?? 0);
      const stockMinNum = Number(p?.stock_minimo ?? 0);
      const faltanteNum = Math.max(0, stockMinNum - stockActualNum);

      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${clave}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${nombre}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${nf.format(stockActualNum)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${nf.format(stockMinNum)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;"><strong>${nf.format(faltanteNum)}</strong></td>
      </tr>`;
    })
    .join("");

  return `
<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif; color:#111;">
  <h2 style="margin:0 0 8px 0;">Alertas de bajo stock</h2>
  <p style="margin:0 0 12px 0;">Se detectaron ${items.length} producto(s) con <strong> stok menor al que debaria </strong>.</p>
  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb;">
    <thead>
      <tr style="background:#f8fafc;">
        <th align="left" style="padding:8px;border-bottom:1px solid #e5e7eb;">Clave</th>
        <th align="left" style="padding:8px;border-bottom:1px solid #e5e7eb;">Nombre</th>
        <th align="right" style="padding:8px;border-bottom:1px solid #e5e7eb;">Stock actual</th>
        <th align="right" style="padding:8px;border-bottom:1px solid #e5e7eb;">Stock mínimo</th>
        <th align="right" style="padding:8px;border-bottom:1px solid #e5e7eb;">Faltante</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p style="margin-top:16px;color:#555">Este es un aviso automático.</p>
</div>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
