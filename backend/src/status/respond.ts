import { Response, Request } from "express";
import { AppCode } from "./codes";

type Extra = {
  httpStatus?: number;
  detalle?: any;
  message?: string;
};

type ApiMinimal = {
  codigo: number;
  mensaje: string;
  // 'data' es opcional: solo se incluye cuando se envía explícitamente
  data?: any;
};

function defaultMessage(code: AppCode): string {
  switch (code) {
    case AppCode.OK: return "OK";
    case AppCode.NOT_FOUND: return "No encontrado";
    case AppCode.VALIDATION_FAILED: return "Validación fallida";
    case AppCode.DB_CONSTRAINT: return "Restricción de base de datos";
    case AppCode.DB_ERROR: return "Error de base de datos";
    default: return "Resultado";
  }
}

export function sendCode(
  _req: Request,
  res: Response,
  code: AppCode,
  data?: any,
  opts: Extra = {}
) {
  const http = opts.httpStatus ?? 200;

  const body: ApiMinimal = {
    codigo: code,
    mensaje: opts.message ?? defaultMessage(code),
  };

  // 👉 Solo adjunta 'data' si fue provista (incluye null explícito si así lo deseas)
  if (data !== undefined) {
    body.data = data;
  }

  // Si quisieras exponer 'detalle' en algunos casos, podrías añadirlo aquí.
  // En tu requerimiento lo dejamos fuera para mantener respuesta minimal.

  return res.status(http).json(body);
}

// Atajo de éxito; ahora también respeta 'data' si la envías
export const ok = (
  _req: Request,
  res: Response,
  data?: any,
  message = "OK"
) => sendCode(_req, res, AppCode.OK, data, { message });
