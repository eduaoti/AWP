import { Router } from "express";
import { z } from "zod";
import { validateBodySimple, validateQuery } from "../middlewares/validate";
import { requireJson } from "../middlewares/require-json";
import { MovimientoSchema } from "../schemas/movimiento.schemas";
import { registrarMovimiento, listarMovimientos } from "../models/movimiento.model";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";

const r = Router();

/* ===========================================================
   🔎 Validación de query para listado
   =========================================================== */
const MovimientosListQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(1000).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

/** GET /movimientos (listar con data) */
r.get("/", validateQuery(MovimientosListQuery), async (req, res, next) => {
  try {
    const { limit, offset } = req.query as unknown as { limit: number; offset: number };
    const raw = await listarMovimientos(limit, offset);

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
    return next(e);
  }
});

/* ===========================================================
   ✅ POST /movimientos  (UNIFICADO con flag 'entrada')
   Body:
   {
     "entrada": true | 1 | false | 0,
     "producto_clave": "SKU-123",
     "cantidad": 5,
     "documento"?: "...",
     "responsable"?: "...",
     "fecha"?: "2025-10-24T10:00:00Z",
     "proveedor_id"?: 1,   // solo si entrada=true
     "cliente_id"?: 20     // requerido si entrada=false
   }
   =========================================================== */
r.post(
  "/",
  requireJson,
  validateBodySimple(MovimientoSchema),
  async (req, res, next) => {
    try {
      await registrarMovimiento(req.body);
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
      return next(e);
    }
  }
);

export default r;
