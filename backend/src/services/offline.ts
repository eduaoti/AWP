// src/services/offline.ts
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { pool } from "../db";
import { sha256 } from "./otp";
import { Request } from "express";

const OFFLINE_TTL = Number(process.env.OFFLINE_PIN_TTL_SECONDS || 60);
const OFFLINE_LEN = Math.max(4, Math.min(10, Number(process.env.OFFLINE_PIN_LENGTH || 6)));
const JWT_OFFLINE = process.env.JWT_OFFLINE_SECRET || "dev-offline-secret";

function randomNumericPin(len: number) {
  // PIN numérico sin sesgos
  let out = "";
  while (out.length < len) {
    const b = crypto.randomBytes(1)[0] % 10;
    out += String(b);
  }
  return out;
}

export async function createOfflinePinForUser(
  userId: number,
  geo?: { lat?: number; lon?: number; accuracy_m?: number }
) {
  const pin = randomNumericPin(OFFLINE_LEN);
  const pinHash = sha256(pin);
  const jti = crypto.randomUUID();
  const expira = new Date(Date.now() + OFFLINE_TTL * 1000);

  // JWT corto que viaja en el cliente: solo para atar el PIN a un jti/uid/exp
  const offlineJwt = jwt.sign(
    { uid: userId, jti, typ: "offline-pin" },
    JWT_OFFLINE,
    { expiresIn: `${OFFLINE_TTL}s` }
  );

  await pool.query(
    `INSERT INTO offline_login_tokens
      (user_id, jti, pin_hash, expira_en, latitud, longitud, accuracy_m)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, jti, pinHash, expira, geo?.lat ?? null, geo?.lon ?? null, geo?.accuracy_m ?? null]
  );

  return { pin, offlineJwt, expiresAt: expira.toISOString() };
}

export async function consumeOfflinePin(
  userId: number,
  jti: string,
  pin: string,
  geoUse?: { lat?: number; lon?: number; accuracy_m?: number }
) {
  const { rows } = await pool.query(
    `UPDATE offline_login_tokens
       SET usado = true, usado_en = NOW(),
           latitud = COALESCE(latitud,$4),  -- si no hubo geo al generar, guarda al usar
           longitud = COALESCE(longitud,$5),
           accuracy_m = COALESCE(accuracy_m,$6)
     WHERE user_id=$1 AND jti=$2
       AND usado=false
       AND expira_en > NOW()
       AND pin_hash=$3
     RETURNING id`,
    [userId, jti, sha256(pin), geoUse?.lat ?? null, geoUse?.lon ?? null, geoUse?.accuracy_m ?? null]
  );
  return rows[0]?.id ? true : false;
}

// Helpers para IP y UA
export function getClientIp(req: Request) {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.socket.remoteAddress || "";
}
export function getUserAgent(req: Request) {
  return req.headers["user-agent"] || "";
}
