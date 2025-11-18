// src/services/system/mail.ts
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.MAIL_FROM || "AWP <onboarding@resend.dev>";

if (!apiKey) {
  console.warn("[MAIL] Falta RESEND_API_KEY — no se podrán enviar correos.");
}

const resend = new Resend(apiKey);

/**
 * Opcional, por compatibilidad con tu código viejo.
 * Antes verificabas el transporte SMTP; ahora solo logueamos.
 */
export async function verifyTransport() {
  if (!apiKey) {
    console.warn("[MAIL] RESEND_API_KEY no configurada; los correos fallarán.");
    return;
  }
    console.log("[MAIL] Usando Resend API para envío de correos.");
}

/**
 * Función central de envío de correos.
 * TODAS las demás capas (OTP, recuperación, low-stock, etc.)
 * ya llaman a sendMail o sendNowOrEnqueue, así que no hay
 * que tocar nada más.
 */
export async function sendMail(to: string, subject: string, html: string) {
  const toNorm = String(to).trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY no configurada");
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[MAIL] Sending via Resend → to=${toNorm} | subject="${subject}"`);
  }

  try {
    const result = await resend.emails.send({
      from,
      to: toNorm,
      subject,
      html,
    });

    if (result.error) {
      console.error("[MAIL] Resend error:", result.error);
      throw new Error(result.error.message);
    }

    return result;
  } catch (err: any) {
    console.error("[MAIL] sendMail() ERROR:", err?.message || err);
    throw err;
  }
}
