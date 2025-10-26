import { Request, Response, NextFunction } from "express";
import { AppCode } from "../../status/codes";
import { sendCode } from "../../status/respond";

/** Métodos que típicamente traen cuerpo */
const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Rutas que pueden no requerir JSON estricto (ajusta si necesitas) */
const EXCEPTIONS_PREFIX = [
  "/docs",       // swagger ui
  "/health",
];

function isExcepted(path: string) {
  return EXCEPTIONS_PREFIX.some(p => path.startsWith(p));
}

/** Requiere application/json para métodos con body */
export function requireJson(req: Request, res: Response, next: NextFunction) {
  if (!METHODS_WITH_BODY.has(req.method)) return next();
  if (isExcepted(req.path)) return next();

  const ct = String(req.headers["content-type"] || "").toLowerCase();
  if (!ct.includes("application/json")) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, null, {
      httpStatus: 415,
      message: "Content-Type debe ser application/json",
    });
  }
  next();
}
