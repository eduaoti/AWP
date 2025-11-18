// backend/src/controllers/estadisticas.controller.ts
import { Request, Response, NextFunction } from "express";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import * as EstadisticasModel from "../models/estadisticas.model";

/* ===========================================================
   Helpers para mapear errores del modelo a AppCode / mensajes
   =========================================================== */

function handleEstadisticasError(
  req: Request,
  res: Response,
  err: any,
  contexto: string
) {
  const code = err?.code as string | undefined;

  // Errores de validación de entrada (rangos, parámetros)
  if (code === "RANGO_FECHAS_INVALIDO" || code === "PARAMETRO_INVALIDO") {
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
        // Convención de reportes: siempre 200
        httpStatus: 200,
        message: err.message || "Parámetros inválidos para el reporte.",
      }
    );
  }

  // Errores de base de datos ya normalizados en el modelo
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
          "Error de base de datos al calcular estadísticas. Intenta de nuevo más tarde.",
      }
    );
  }

  // Fallback genérico
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
        "Ocurrió un error inesperado al procesar la solicitud de estadísticas.",
    }
  );
}

/* ===========================================================
   POST /estadisticas/ventas-producto
   Body JSON: { desde: string, hasta: string }
   =========================================================== */
export async function ventasPorProducto(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.body || typeof req.body !== "object") {
      const e: any = new Error("El cuerpo de la petición debe ser un JSON.");
      e.code = "PARAMETRO_INVALIDO";
      e.detail = { body: req.body };
      throw e;
    }

    const { desde, hasta } = req.body as {
      desde?: string;
      hasta?: string;
    };

    const data = await EstadisticasModel.ventasPorProducto(desde, hasta);

    return sendCode(req, res, AppCode.OK, data, {
      httpStatus: 200,
      message: "Ventas por producto calculadas correctamente.",
    });
  } catch (err) {
    return handleEstadisticasError(req, res, err, "ventasPorProducto");
  }
}

/* ===========================================================
   POST /estadisticas/productos-menor-venta
   Body JSON: { desde: string, hasta: string, limite?: number }
   =========================================================== */
export async function productosMenorVenta(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.body || typeof req.body !== "object") {
      const e: any = new Error("El cuerpo de la petición debe ser un JSON.");
      e.code = "PARAMETRO_INVALIDO";
      e.detail = { body: req.body };
      throw e;
    }

    const { desde, hasta, limite } = req.body as {
      desde?: string;
      hasta?: string;
      limite?: unknown;
    };

    const data = await EstadisticasModel.productosMenorVenta(
      desde,
      hasta,
      limite
    );

    return sendCode(req, res, AppCode.OK, data, {
      httpStatus: 200,
      message:
        "Productos con menor venta obtenidos correctamente en el rango indicado.",
    });
  } catch (err) {
    return handleEstadisticasError(req, res, err, "productosMenorVenta");
  }
}

/* ===========================================================
   POST /estadisticas/productos-extremos
   Body JSON: { desde: string, hasta: string, top?: number }
   =========================================================== */
export async function productosExtremos(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.body || typeof req.body !== "object") {
      const e: any = new Error("El cuerpo de la petición debe ser un JSON.");
      e.code = "PARAMETRO_INVALIDO";
      e.detail = { body: req.body };
      throw e;
    }

    const { desde, hasta, top } = req.body as {
      desde?: string;
      hasta?: string;
      top?: unknown;
    };

    const data = await EstadisticasModel.productosExtremos(desde, hasta, top);

    return sendCode(req, res, AppCode.OK, data, {
      httpStatus: 200,
      message:
        "Productos extremos (más barato y más caro entre los más vendidos) obtenidos correctamente.",
    });
  } catch (err) {
    return handleEstadisticasError(req, res, err, "productosExtremos");
  }
}
