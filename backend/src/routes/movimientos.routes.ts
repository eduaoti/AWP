// src/routes/movimientos.routes.ts
import { Router } from "express";
import { validateBodySimple } from "../middlewares/validate";
import { MovimientoEntradaSchema, MovimientoSalidaSchema } from "../schemas/movimiento.schemas";
import { registrarEntrada, registrarSalida, listarMovimientos } from "../models/movimiento.model";

const r = Router();

/** GET /movimientos (opcional para auditar) */
r.get("/", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const data = await listarMovimientos(limit, offset);
    res.json(data);
  } catch (e) { next(e); }
});

/** POST /movimientos/entrada */
r.post("/entrada", validateBodySimple(MovimientoEntradaSchema), async (req, res, next) => {
  try {
    const result = await registrarEntrada(req.body);
    res.status(201).json(result);
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ mensaje: e.message, code: e.code });
    next(e);
  }
});

/** POST /movimientos/salida */
r.post("/salida", validateBodySimple(MovimientoSalidaSchema), async (req, res, next) => {
  try {
    const result = await registrarSalida(req.body);
    res.status(201).json(result);
  } catch (e: any) {
    // Regla: si cantidad > stock_actual
    if (e?.code === "STOCK_INSUFICIENTE") {
      return res.status(400).json({ mensaje: e.message, code: e.code });
    }
    if (e?.status) return res.status(e.status).json({ mensaje: e.message, code: e.code });
    next(e);
  }
});

export default r;
