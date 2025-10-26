// src/services/otp.ts
import { authenticator } from "otplib";
import crypto from "crypto";
import QRCode from "qrcode";

authenticator.options = {
  step: Number(process.env.OTP_STEP || 30),
  window: Number(process.env.OTP_WINDOW || 1)
};

// Genera secreto BASE32 (estándar para Google Authenticator)
export function genSecretBase32(): string {
  return authenticator.generateSecret(); // base32
}

export function genTotp(secretBase32: string): string {
  return authenticator.generate(secretBase32);
}

export function verifyTotp(secretBase32: string, token: string): boolean {
  return authenticator.verify({ token, secret: secretBase32 });
}

// otpauth:// URI para apps (para QR)
export function keyUri(emailOrAccount: string, issuer = "AWP", secretBase32: string) {
  return authenticator.keyuri(emailOrAccount, issuer, secretBase32);
}

// QR en dataURL (PNG base64) a partir de la URI
export async function qrDataUrl(otpauthUri: string) {
  return QRCode.toDataURL(otpauthUri, { margin: 1, scale: 4 });
}

// Utilidades backup codes
export function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
export function genBackupCodes(n = 8) {
  const plains: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < n; i++) {
    const code = crypto.randomBytes(4).toString("hex"); // 8 chars
    plains.push(code);
    hashes.push(sha256(code));
  }
  return { plains, hashes };
}
