// src/services/mail.ts
import nodemailer, { Transporter } from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const secure = String(process.env.SMTP_SECURE || "false") === "true"; // true => 465
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.MAIL_FROM || '"AWP" <no-reply@awp.local>';

if (!host || !user || !pass) {
  console.warn("[MAIL] Faltan SMTP_HOST/SMTP_USER/SMTP_PASS. El envío fallará.");
}

export const transport: Transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: user && pass ? { user, pass } : undefined,
  // Para algunos entornos con TLS raro/DNS:
  tls: {
    // Para 465 normalmente no se necesita, pero ayuda en entornos locales
    servername: host,
  },
  connectionTimeout: 7000,
  greetingTimeout: 7000,
});

/** Verifica conexión SMTP al iniciar el server */
export async function verifyTransport() {
  try {
    await transport.verify();
    console.log(`[MAIL] Transport OK: ${host}:${port} secure=${secure}`);
  } catch (err: any) {
    console.error("[MAIL] verify() falló:", err?.code || err?.name, err?.message || err);
  }
}

/** Envía un correo o lanza error (lo captura el caller para encolar) */
export async function sendMail(to: string, subject: string, html: string) {
  const toNorm = String(to).trim();
  if (process.env.NODE_ENV !== "production") {
    console.log(`[MAIL] intent to=${toNorm} | subject=${subject}`);
  }
  try {
    const info = await transport.sendMail({ from, to: toNorm, subject, html });
    if (process.env.NODE_ENV !== "production") {
      console.log(`[MAIL] accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)} response=${info.response}`);
    }
    return info;
  } catch (err: any) {
    // 👇 Log específico para saber por qué se va a DIFERIDO
    console.error("[MAIL] sendMail() ERROR:", err?.code || err?.name, err?.message || err);
    throw err;
  }
}
