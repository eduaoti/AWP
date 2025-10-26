// src/services/emailQueue.ts  (solo paleta azul, profesional, SIN "Bajo stock")
import { pool } from "../../db";
import { sendMail } from "./mail";
import { UsuarioModel } from "../../models/usuario.model";

const EMAIL_QUEUE_LIMIT = Number(process.env.EMAIL_QUEUE_LIMIT ?? 20);
const EMAIL_QUEUE_MAX_ATTEMPTS = Number(process.env.EMAIL_QUEUE_MAX_ATTEMPTS ?? 5);
const EMAIL_QUEUE_RETRY_SECONDS = Number(process.env.EMAIL_QUEUE_RETRY_SECONDS ?? 60);

const BRAND_NAME = process.env.INVENTORY_BRAND_NAME ?? "Inventario";
const BRAND_URL = process.env.INVENTORY_BRAND_URL ?? "";
const DASHBOARD_URL = process.env.INVENTORY_DASHBOARD_URL ?? "";

/** Intenta enviar ya; si falla, encola. */
export async function sendNowOrEnqueue(to: string, subject: string, html: string) {
  try { await sendMail(to.trim(), subject, html); }
  catch { await enqueueMail(to, subject, html); }
}

export async function enqueueMail(to: string, subject: string, html: string) {
  await pool.query(
    `INSERT INTO email_queue (destinatario, asunto, html) VALUES ($1,$2,$3)`,
    [to.trim(), subject, html]
  );
}

type EmailQueueRow = { id:number; destinatario:string; asunto:string; html:string; intentos:number; };

export async function processEmailQueueOnce() {
  const { rows } = await pool.query<EmailQueueRow>(
    `SELECT id, destinatario, asunto, html, intentos
       FROM email_queue
      WHERE sent_at IS NULL
      ORDER BY scheduled_at ASC
      LIMIT $1`, [EMAIL_QUEUE_LIMIT]
  );

  for (const r of rows) {
    if (r.intentos >= EMAIL_QUEUE_MAX_ATTEMPTS) continue;
    try {
      await sendMail(r.destinatario, r.asunto, r.html);
      await pool.query(`UPDATE email_queue SET sent_at=NOW() WHERE id=$1`, [r.id]);
    } catch (err: any) {
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

/* ======= HTML (solo azul) ======= */
/*
  Paleta:
  - Azul marino principal:   #0B1F3A
  - Azul secundario:         #133A63
  - Azules claros UI:        #E8EEF7 (header tabla/chips), #E6EAF2 (borde), #F5F7FB (fondo), #F9FBFF (zebra)
  - Texto primario:          #0B1F3A
  - Texto secundario:        #5B6B7F
*/

export function buildLowStockHtml(items: Array<any>): string {
  // 👉 enteros
  const nf = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const rows = items.map((p, i) => {
    const clave = escapeHtml(p?.clave ?? "");
    const nombre = escapeHtml(p?.nombre ?? "");
    const sa = Math.max(0, Number(p?.stock_actual ?? 0) | 0);
    const sm = Math.max(0, Number(p?.stock_minimo ?? 0) | 0);
    const falt = Math.max(0, sm - sa);
    const zebra = i % 2 === 0 ? "#FFFFFF" : "#F9FBFF";
    return `<tr style="background:${zebra}">
      <td style="padding:10px 12px;border-bottom:1px solid #E6EAF2;font-weight:600;color:#0B1F3A;">${clave}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E6EAF2;color:#0B1F3A;">${nombre}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E6EAF2;text-align:right;color:#0B1F3A;">${nf.format(sa)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E6EAF2;text-align:right;color:#0B1F3A;">${nf.format(sm)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E6EAF2;text-align:right;">
        <span style="display:inline-block;background:#E8EEF7;color:#0B1F3A;border:1px solid #D8E1EF;border-radius:999px;padding:2px 10px;font-weight:600;">
          ${nf.format(falt)}
        </span>
      </td>
    </tr>`;
  }).join("");

  const cta = DASHBOARD_URL ? buttonLink("Abrir panel", DASHBOARD_URL) : "";

  return wrapCard({
    title: "Avisos de inventario por debajo del mínimo",
    intro: `Se detectaron <strong>${items.length}</strong> producto(s) con nivel de inventario por debajo del mínimo establecido.`,
    body: `
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #E6EAF2;border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:#E8EEF7;color:#0B1F3A;">
            <th align="left"  style="padding:10px 12px;border-bottom:1px solid #E6EAF2;">Clave</th>
            <th align="left"  style="padding:10px 12px;border-bottom:1px solid #E6EAF2;">Nombre</th>
            <th align="right" style="padding:10px 12px;border-bottom:1px solid #E6EAF2;">Stock actual</th>
            <th align="right" style="padding:10px 12px;border-bottom:1px solid #E6EAF2;">Stock mínimo</th>
            <th align="right" style="padding:10px 12px;border-bottom:1px solid #E6EAF2;">Faltante</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${cta}
    `,
    footerNote: "Este es un aviso automático.",
  });
}

export function buildSingleProductHtml(clave: string, nombre: string, sa: number, sm: number, falt: number) {
  // 👉 enteros
  const nf = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const cta = DASHBOARD_URL ? buttonLink("Reponer ahora", DASHBOARD_URL) : "";
  return wrapCard({
    title: "Inventario por debajo del mínimo",
    intro: "Un producto requiere reposición: su nivel actual está por debajo del mínimo establecido.",
    body: `
      ${kv("Clave", escapeHtml(clave))}
      ${kv("Nombre", escapeHtml(nombre))}
      ${kv("Stock actual", nf.format(Math.max(0, sa|0)), "right")}
      ${kv("Stock mínimo", nf.format(Math.max(0, sm|0)), "right")}
      ${kv(
        "Faltante",
        `<span style='background:#E8EEF7;color:#0B1F3A;border:1px solid #D8E1EF;border-radius:999px;padding:2px 10px;font-weight:600;'>${nf.format(Math.max(0,(sm|0)-(sa|0)))}</span>`,
        "right"
      )}
      ${cta}
    `,
    footerNote: "Este aviso se repetirá hasta que el inventario se normalice.",
  });
}

export function buildResolvedHtml(clave: string, nombre: string, sa: number, sm: number) {
  // 👉 enteros
  const nf = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const cta = DASHBOARD_URL ? buttonLink("Ver detalle", DASHBOARD_URL) : "";
  return wrapCard({
    title: "Inventario normalizado",
    intro: "El producto recuperó el nivel mínimo de inventario.",
    body: `
      ${kv("Clave", escapeHtml(clave))}
      ${kv("Nombre", escapeHtml(nombre))}
      ${kv("Stock actual", nf.format(Math.max(0, sa|0)), "right")}
      ${kv("Stock mínimo", nf.format(Math.max(0, sm|0)), "right")}
      ${cta}
    `,
    footerNote: "Se detendrán los recordatorios para este producto.",
  });
}

/* — util — */
function wrapCard(opts:{title:string;intro?:string;body:string;footerNote?:string}) {
  const headTitle = escapeHtml(BRAND_NAME);
  const title = escapeHtml(opts.title);
  const intro = opts.intro ? `<p style="margin:0 0 14px 0;color:#5B6B7F;">${opts.intro}</p>` : "";
  const footer = opts.footerNote ? `<p style="margin-top:16px;color:#5B6B7F;font-size:13px;">${escapeHtml(opts.footerNote)}</p>` : "";
  const brand = BRAND_URL ? `<a href="${escapeAttr(BRAND_URL)}" style="text-decoration:none;color:#FFFFFF">${headTitle}</a>` : headTitle;

  return `
  <div style="background:#F5F7FB;padding:22px 0;">
    <div style="max-width:680px;margin:0 auto;background:#FFFFFF;border:1px solid #E6EAF2;border-radius:12px;overflow:hidden;">
      <div style="background:#688FDA;color:#FFFFFF;padding:16px 20px;font-weight:700;font-size:14px;letter-spacing:.3px;">
        ${brand} · Notificación
      </div>
      <div style="padding:20px 22px;font-family: system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; color:#0B1F3A;">
        <h2 style="margin:0 0 6px 0;font-size:18px;font-weight:700;color:#0B1F3A;">${title}</h2>
        ${intro}
        ${opts.body}
        ${footer}
      </div>
    </div>
  </div>`;
}

function buttonLink(label: string, href: string) {
  return `
    <div style="margin-top:16px;">
      <a href="${escapeAttr(href)}"
         style="display:inline-block;background:#688FDA;color:#FFFFFF;text-decoration:none;border-radius:6px;padding:10px 16px;font-weight:600;border:1px solid #0B1F3A;">
        ${escapeHtml(label)}
      </a>
    </div>`;
}
function kv(label:string, value:string, align:"left"|"right"="left") {
  return `
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 8px 0;">
    <tr>
      <td style="padding:6px 0;color:#5B6B7F;width:40%">${label}</td>
      <td style="padding:6px 0;text-align:${align};color:#0B1F3A;font-weight:600">${value}</td>
    </tr>
  </table>`;
}
function escapeHtml(s:string){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escapeAttr(s:string){return escapeHtml(s).replace(/"/g,"&quot;");}

export async function enqueueLowStockAlertToChief(items: Array<any>) {
  const to = await UsuarioModel.findInventoryChiefEmail();
  if (!to) return { to:null, enqueued:false, count:items.length };
  const html = buildLowStockHtml(items);
  // 👉 asunto sin "Bajo stock"
  await enqueueMail(to, `Avisos de inventario por debajo del mínimo (${items.length})`, html);
  return { to, enqueued:true, count:items.length };
}
