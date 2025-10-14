// src/routes/movimientos.routes.ts
import { Router } from "express";
import { validateBodySimple } from "../middlewares/validate";
import {
  MovimientoEntradaSchema,
  MovimientoSalidaSchema,
} from "../schemas/movimiento.schemas";
import {
  registrarEntrada,
  registrarSalida,
  listarMovimientos,
} from "../models/movimiento.model";

const r = Router();

/** Helpers estándar de respuesta */
const stamp = () => new Date().toISOString();
const ok = (path: string, data: any) =>
  ({ codigo: 0, mensaje: "OK", path, timestamp: stamp(), data });
const err = (codigo: number, path: string, mensaje: string, detalle?: any) =>
  ({ codigo, mensaje, path, timestamp: stamp(), detalle });

/** GET /movimientos (opcional para auditar) */
r.get("/", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const data = await listarMovimientos(limit, offset);
    res.json(ok("/movimientos", data));
  } catch (e) { next(e); }
});

/** POST /movimientos/entrada */
r.post(
  "/entrada",
  validateBodySimple(MovimientoEntradaSchema),
  async (req, res, next) => {
    try {
      const result = await registrarEntrada(req.body);
      return res
        .status(201)
        .json(ok("/movimientos/entrada", result));
    } catch (e: any) {
      // Errores controlados desde el modelo
      if (e?.status === 404) {
        return res
          .status(404)
          .json(err(4, "/movimientos/entrada", e.message));
      }
      if (e?.status === 400) {
        return res
          .status(400)
          .json(err(1, "/movimientos/entrada", e.message));
      }
      next(e);
    }
  }
);

/** POST /movimientos/salida (con cliente_id opcional) */
r.post(
  "/salida",
  validateBodySimple(MovimientoSalidaSchema),
  async (req, res, next) => {
    try {
      const result = await registrarSalida(req.body);
      return res
        .status(201)
        .json(ok("/movimientos/salida", result));
    } catch (e: any) {
      // Regla: si cantidad > stock_actual
      if (e?.code === "STOCK_INSUFICIENTE") {
        return res
          .status(400)
          .json(err(1, "/movimientos/salida", e.message));
      }
      if (e?.status === 404) {
        return res
          .status(404)
          .json(err(4, "/movimientos/salida", e.message));
      }
      if (e?.status === 400) {
        return res
          .status(400)
          .json(err(1, "/movimientos/salida", e.message));
      }
      next(e);
    }
  }
);

export default r;
