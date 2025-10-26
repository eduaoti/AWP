// src/controllers/estadisticas.controller.ts
import { Request, Response } from "express";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import * as EstadisticasService from "../services/domain/estadisticas.service";
import {
  validarVentasPorProducto,
  validarProductosMenorVenta,
  validarProductosExtremos,
} from "../dto/estadisticas.dto";

/* ===========================================================
   Helpers de error
   =========================================================== */
function handledAppError(req: Request, res: Response, e: any) {
  if (e?.status === 400 && ["RANGO_FECHAS_INVALIDO", "PARAMETRO_INVALIDO"].includes(e?.code)) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 200,
      message: e.message || "Validación fallida",
    });
  }
  if (e?.status === 500 && (e?.code === "DB_ERROR" || e?.code === "INTERNAL")) {
    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 200,
      message: "Error de base de datos",
    });
  }
  return sendCode(req, res, AppCode.DB_ERROR, undefined, {
    httpStatus: 200,
    message: "Error interno del servidor",
  });
}

/* ===========================================================
   CONTROLADORES
   =========================================================== */
export async function ventasPorProducto(req: Request, res: Response) {
  const valid = validarVentasPorProducto(req.body);
  if (!valid.ok) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 200,
      message: valid.errores.join("; "),
    });
  }

  try {
    const { desde, hasta } = valid.data;
    const data = await EstadisticasService.ventasPorProducto(desde, hasta);
    return sendCode(req, res, AppCode.OK, data, {
      httpStatus: 200,
      message: "Ventas por producto generadas con éxito",
    });
  } catch (e: any) {
    return handledAppError(req, res, e);
  }
}

export async function productosMenorVenta(req: Request, res: Response) {
  const valid = validarProductosMenorVenta(req.body);
  if (!valid.ok) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 200,
      message: valid.errores.join("; "),
    });
  }

  try {
    const { desde, hasta, limite } = valid.data;
    const data = await EstadisticasService.productosMenorVenta(desde, hasta, limite ?? 10);
    return sendCode(req, res, AppCode.OK, data, {
      httpStatus: 200,
      message: "Productos de menor venta generados con éxito",
    });
  } catch (e: any) {
    return handledAppError(req, res, e);
  }
}

export async function productosExtremos(req: Request, res: Response) {
  const valid = validarProductosExtremos(req.body);
  if (!valid.ok) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 200,
      message: valid.errores.join("; "),
    });
  }

  try {
    const { desde, hasta, top } = valid.data;
    const data = await EstadisticasService.productosExtremos(desde, hasta, top ?? 10);
    return sendCode(req, res, AppCode.OK, data, {
      httpStatus: 200,
      message: "Productos extremos generados con éxito",
    });
  } catch (e: any) {
    return handledAppError(req, res, e);
  }
}
