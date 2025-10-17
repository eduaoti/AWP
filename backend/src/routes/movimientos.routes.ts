// src/routes/movimientos.routes.ts
import { Router } from "express";
import { validateBodySimple } from "../middlewares/validate";
import { requireJson } from "../middlewares/require-json";
import {
  MovimientoEntradaSchema,
  MovimientoSalidaSchema,
} from "../schemas/movimiento.schemas";
import {
  registrarEntrada,
  registrarSalida,
  listarMovimientos,
} from "../models/movimiento.model";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";

const r = Router();

/** GET /movimientos (listar con data) */
r.get("/", async (req, res, next) => {
  try {
    const limitQ = Number(req.query.limit ?? 50);
    const offsetQ = Number(req.query.offset ?? 0);

    const limit =
      Number.isFinite(limitQ) && limitQ > 0 ? Math.min(limitQ, 1000) : 50;
    const offset =
      Number.isFinite(offsetQ) && offsetQ >= 0 ? offsetQ : 0;

    const raw = await listarMovimientos(limit, offset);

    // Soporta tanto retorno plano (array) como objetos {items, meta}
    const data =
      raw && typeof raw === "object" && "items" in (raw as any) && "meta" in (raw as any)
        ? raw
        : Array.isArray(raw)
        ? {
            items: raw,
            meta: {
              limit,
              offset,
              count: raw.length,
            },
          }
        : {
            items: [],
            meta: { limit, offset, count: 0 },
          };

    return sendCode(req, res, AppCode.OK, data, {
      message: "Movimientos listados con éxito",
      httpStatus: 200,
    });
  } catch (e) {
    return next(e);
  }
});

/** POST /movimientos/entrada */
r.post(
  "/entrada",
  requireJson,
  validateBodySimple(MovimientoEntradaSchema),
  async (req, res, next) => {
    try {
      await registrarEntrada(req.body);
      // 201 creado, respuesta minimal (sin data)
      return sendCode(req, res, AppCode.OK, undefined, {
        httpStatus: 201,
        message: "Entrada registrada con éxito",
      });
    } catch (e: any) {
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
      return next(e);
    }
  }
);

/** POST /movimientos/salida (con cliente_id requerido) */
r.post(
  "/salida",
  requireJson,
  validateBodySimple(MovimientoSalidaSchema),
  async (req, res, next) => {
    try {
      await registrarSalida(req.body);
      // 201 creado, respuesta minimal (sin data)
      return sendCode(req, res, AppCode.OK, undefined, {
        httpStatus: 201,
        message: "Salida registrada con éxito",
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
      return next(e);
    }
  }
);

export default r;
