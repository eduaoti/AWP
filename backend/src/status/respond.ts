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
  opts?: { httpStatus?: number; detalle?: any }
) {
  const http = opts?.httpStatus ?? CodeHttp[code] ?? 200;
  const body: Payload = {
    codigo: code,
    mensaje: CodeMessage[code] ?? "Resultado",
    data,
    detalle: opts?.detalle,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  };
  return res.status(http).json(body);
}

// Atajos
export const ok = (req: Request, res: Response, data?: any) =>
  sendCode(req, res, AppCode.OK, data);
