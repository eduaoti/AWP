// backend/src/controllers/reportes.controller.ts
import { Request, Response, NextFunction } from "express";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import * as ReportesModel from "../models/reportes.model";

/* ===========================================================
   Helper para manejar errores de reportes
   =========================================================== */
function handleReportesError(
  req: Request,
  res: Response,
  err: any,
  contexto: string
) {
  const code = err?.code as string | undefined;

  if (
    code === "RANGO_FECHAS_INVALIDO" ||
    code === "PARAMETRO_INVALIDO"
  ) {
    return sendCode(
      req,
      res,
      AppCode.VALIDATION_FAILED,
      {
        error: {
          code,
          detail: err.detail ?? null,
          contexto,
        },
      },
      {
        httpStatus: 200,
        message: err.message || "Parámetros inválidos para el reporte.",
      }
    );
  }

  if (code === "PRODUCTO_NO_ENCONTRADO") {
    return sendCode(
      req,
      res,
      AppCode.NOT_FOUND,
      {
        error: {
          code,
          detail: err.detail ?? null,
          contexto,
        },
      },
      {
        httpStatus: 200,
        message: err.message || "Producto no encontrado.",
      }
    );
  }

  if (code === "DB_ERROR") {
    return sendCode(
      req,
      res,
      AppCode.DB_ERROR,
      {
        error: {
          code,
          detail: err.detail ?? null,
          contexto,
        },
      },
      {
        httpStatus: 200,
        message:
          err.message ||
          "Error de base de datos al obtener el reporte. Intenta de nuevo.",
      }
    );
  }

  return sendCode(
    req,
    res,
    AppCode.DB_ERROR,
    {
      error: {
        code: code ?? "UNKNOWN",
        detail: err?.detail ?? null,
        contexto,
      },
    },
    {
      httpStatus: 200,
      message:
        err?.message ||
        "Ocurrió un error inesperado al procesar el reporte de movimientos.",
    }
  );
}

/* ===========================================================
   GET /reportes/movimientos-producto
   Query:
     - producto_clave (obligatorio)
     - desde (ISO-Z)
     - hasta (ISO-Z)
     - limit (opcional)
     - offset (opcional)
   =========================================================== */
export async function movimientosProducto(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { producto_clave, desde, hasta, limit, offset } = req.query;

    const data = await ReportesModel.movimientosProducto({
      producto_clave,
      desde: typeof desde === "string" ? desde : undefined,
      hasta: typeof hasta === "string" ? hasta : undefined,
      limit,
      offset,
    });

    return sendCode(req, res, AppCode.OK, data, {
      httpStatus: 200,
      message:
        "Reporte de movimientos por producto obtenido correctamente en el rango indicado.",
    });
  } catch (err) {
    return handleReportesError(req, res, err, "movimientosProducto");
  }
}
