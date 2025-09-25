// src/services/mail.ts
import nodemailer, { Transporter } from "nodemailer";

// Crear transporter único reutilizable
const transport: Transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 1025),
  secure: process.env.SMTP_SECURE === "true",
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      : undefined,
  connectionTimeout: 4000, // ⏱️ timeout corto para no bloquear
  greetingTimeout: 4000
});

/**
 * Envía un correo. Si no hay SMTP configurado o falla,
 * el error debe ser capturado por el caller (que puede encolar).
 */
export async function sendMail(to: string, subject: string, html: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[MAIL] → ${to} | ${subject}`);
  }

  return await transport.sendMail({
    from: process.env.MAIL_FROM || '"AWP" <no-reply@awp.local>',
    to,
    subject,
    html
  });
}
