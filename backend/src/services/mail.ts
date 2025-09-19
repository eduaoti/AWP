import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 1025),
  secure: process.env.SMTP_SECURE === "true",
  auth: (process.env.SMTP_USER && process.env.SMTP_PASS) ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined
});

export async function sendMail(to: string, subject: string, html: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[MAIL]", to, subject);
  }
  await transport.sendMail({
    from: process.env.MAIL_FROM || '"AWP" <no-reply@awp.local>',
    to, subject, html
  });
}
