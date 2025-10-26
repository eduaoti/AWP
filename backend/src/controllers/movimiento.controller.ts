// src/controllers/movimiento.controller.ts
import { Request, Response, NextFunction } from "express";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import * as MovimientoService from "../services/domain/movimiento.service";

/* ===========================================================
   Controladores para movimientos
   =========================================================== */

/** GET /movimientos */
export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const { limit, offset } = req.query as unknown as { limit: number; offset: number };
    const raw = await MovimientoService.listarMovimientos(limit, offset);

    const data =
      raw && typeof raw === "object" && "items" in (raw as any) && "meta" in (raw as any)
        ? raw
        : Array.isArray(raw)
        ? { items: raw, meta: { limit, offset, count: raw.length } }
        : { items: [], meta: { limit, offset, count: 0 } };

    return sendCode(req, res, AppCode.OK, data, {
      message: "Movimientos listados con éxito",
      httpStatus: 200,
    });
  } catch (e) {
    next(e);
  }
}

/** POST /movimientos */
export async function registrar(req: Request, res: Response, next: NextFunction) {
  try {
    await MovimientoService.registrarMovimiento(req.body);

    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 201,
      message: "Movimiento registrado con éxito",
    });
  } catch (e: any) {
    if (e?.code === "STOCK_INSUFICIENTE") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        httpStatus: 200,
        message: e.message || "Stock insuficiente",
      });
    }
    if (e?.status === 404) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 200,
        message: e.message || "No encontrado",
      });
    }
    if (e?.status === 400) {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        httpStatus: 200,
        message: e.message || "Validación fallida",
      });
    }

    next(e);
  }
}
