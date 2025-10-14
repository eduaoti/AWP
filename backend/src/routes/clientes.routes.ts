import { Router } from "express";
import { validateBodySimple } from "../middlewares/validate";
import { ClienteCrearSchema } from "../schemas/cliente.schemas";
import * as Clientes from "../models/cliente.model";
import { ok, sendCode } from "../status/respond";
import { AppCode } from "../status/codes";

const r = Router();

/** GET /clientes (orden por nombre asc, con paginación opcional) */
r.get("/", async (req, res, next) => {
  try {
    const limitQ = Number(req.query.limit ?? 500);
    const offsetQ = Number(req.query.offset ?? 0);
    const limit = Number.isFinite(limitQ) && limitQ > 0 ? Math.min(limitQ, 1000) : 500;
    const offset = Number.isFinite(offsetQ) && offsetQ >= 0 ? offsetQ : 0;

    const data = await Clientes.listarClientes(limit, offset);
    return ok(req, res, data);
  } catch (e) {
    next(e);
  }
});

/** POST /clientes (alta con normalización y anti-duplicados) */
r.post("/", validateBodySimple(ClienteCrearSchema), async (req, res, next) => {
  try {
    const data = await Clientes.crearCliente(req.body);
    return sendCode(req, res, AppCode.OK, data, { httpStatus: 201, message: "Creado" });
  } catch (e: any) {
    // Conflictos conocidos
    if (e?.status === 409 || e?.code === "CLIENTE_DUPLICADO_NOMBRE" || e?.code === "CLIENTE_DUPLICADO_TELEFONO" || e?.code === "23505") {
      return res.status(409).json({
        codigo: 409,
        mensaje: e?.message || "Conflicto: cliente duplicado.",
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }
    // Violación de CHECK/validación a nivel DB
    if (e?.code === "23514") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        message: "Cliente inválido: no cumple restricciones de base de datos.",
        detalle: { constraint: e?.constraint }
      });
    }
    // Error controlado con status/mensaje
    if (e?.status && e?.message) {
      const code =
        e.status === 404 ? AppCode.NOT_FOUND :
        e.status === 409 ? AppCode.DB_CONSTRAINT :
        AppCode.DB_ERROR;
      return sendCode(req, res, code, undefined, {
        message: e.message,
        httpStatus: e.status,
        detalle: e.detail
      });
    }
    // Fallback → DB_ERROR 61
    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      message: "Error de base de datos al crear cliente."
    });
  }
});

export default r;
