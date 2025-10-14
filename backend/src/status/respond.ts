// src/status/respond.ts
import { Response, Request } from "express";
import { AppCode, CodeHttp, CodeMessage } from "./codes";

type Payload = {
  codigo: number;
  mensaje: string;
  data?: any;
  detalle?: any;     // para debugging/log
  path?: string;
  timestamp?: string;
};

export function sendCode(
  req: Request,
  res: Response,
  code: AppCode,
  data?: any,
  opts?: { httpStatus?: number; detalle?: any; message?: string }
) {
  const http = opts?.httpStatus ?? CodeHttp[code] ?? 200;
  const body: Payload = {
    codigo: code,
    // 👇 si mandas opts.message, se usa; si no, usa el default de CodeMessage
    mensaje: opts?.message ?? (CodeMessage[code] ?? "Resultado"),
    data,
    detalle: opts?.detalle,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  };
  return res.status(http).json(body);
}

// Atajo de éxito con mensaje opcional
export const ok = (req: Request, res: Response, data?: any, message = "OK") =>
  sendCode(req, res, AppCode.OK, data, { message });
