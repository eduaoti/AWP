import { Request, Response, NextFunction } from "express";
import { AppCode } from "../../status/codes";
import { sendCode } from "../../status/respond";

/* ===========================================================
   Métodos que pueden tener cuerpo (body)
   =========================================================== */
const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/* ===========================================================
   Rutas que quedan exentas de validación estricta
   =========================================================== */
const EXCEPTIONS_PREFIX = ["/docs", "/health"];

/** Verifica si la ruta es una excepción */
function isExcepted(path: string): boolean {
  return EXCEPTIONS_PREFIX.some((p) => path.startsWith(p));
}

/* ===========================================================
   Middleware: Requiere Content-Type: application/json
   solo para métodos que llevan body (no GET/HEAD/OPTIONS)
   =========================================================== */
export function requireJson(req: Request, res: Response, next: NextFunction) {
  // ✅ Permitir GET, HEAD y OPTIONS sin validación
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // ✅ Excepciones manuales
  if (isExcepted(req.path)) {
    return next();
  }

  // ✅ Solo validar métodos con cuerpo
  if (METHODS_WITH_BODY.has(req.method)) {
    const ct = String(req.headers["content-type"] || "").toLowerCase();

    if (!ct.includes("application/json")) {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, {
        httpStatus: 415,
        message: "Content-Type debe ser application/json",
      });
    }
  }

  next();
}
