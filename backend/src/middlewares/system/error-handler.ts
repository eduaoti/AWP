import { NextFunction, Request, Response } from "express";
import { AppCode, CodeHttp, CodeMessage } from "../../status/codes";

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error("Unhandled error:", err);

  // Si el error trae un appCode, respétalo
  const appCode: AppCode = err?.appCode ?? AppCode.INTERNAL_ERROR;
  const http = err?.status ?? err?.httpStatus ?? CodeHttp[appCode] ?? 500;

  return res.status(http).json({
    codigo: appCode,
    mensaje: err?.message ?? CodeMessage[appCode],
    detalle: process.env.NODE_ENV === "production" ? undefined : err?.detalle ?? err,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
}

// Utilidad para lanzar errores tipados
export const throwAppError = (appCode: AppCode, message?: string, detalle?: any) => {
  const e: any = new Error(message);
  e.appCode = appCode;
  e.httpStatus = CodeHttp[appCode];
  e.detalle = detalle;
  throw e;
};
