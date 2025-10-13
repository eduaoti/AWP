// src/middlewares/errors.ts
import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function jsonParseGuard(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Errores del body-parser (JSON inválido)
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ codigo: 100, mensaje: "JSON inválido." });
  }
  return res.status(500).json({ codigo: 500, mensaje: "Error interno." });
}

export function zodErrorToStd(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    // Aplanamos y mandamos un mensaje corto en español
    const fieldMsgs = err.issues.map(i => i.message);
    const msg = fieldMsgs.join(" | ") || "Validación fallida.";
    return res.status(400).json({ codigo: 2, mensaje: msg });
  }
  return res.status(500).json({ codigo: 500, mensaje: "Error interno." });
}
