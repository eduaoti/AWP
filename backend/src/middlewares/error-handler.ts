import { NextFunction, Request, Response } from "express";

export function errorHandler(err: any, _: Request, res: Response, __: NextFunction) {
  console.error("Unhandled error:", err);
  const status = err?.status || 500;
  return res.status(status).json({
    error: status === 500 ? "Error interno del servidor" : err?.message || "Error",
  });
}
