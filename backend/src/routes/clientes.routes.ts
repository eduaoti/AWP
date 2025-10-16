// src/routes/clientes.routes.ts
import { Router } from "express";
import { validateBodySimple } from "../middlewares/validate";
import { requireJson } from "../middlewares/require-json";
import { ClienteCrearSchema } from "../schemas/cliente.schemas";
import * as Clientes from "../models/cliente.model";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";

const r = Router();

/** GET /clientes
 *  - Orden por nombre asc (definido en el modelo)
 *  - Paginación defensiva por limit/offset
 *  - ✅ Devuelve data: { items, meta }
 */
r.get("/", async (req, res, next) => {
  try {
    const limitQ = Number(req.query.limit ?? 500);
    const offsetQ = Number(req.query.offset ?? 0);
    const limit = Number.isFinite(limitQ) && limitQ > 0 ? Math.min(limitQ, 1000) : 500;
    const offset = Number.isFinite(offsetQ) && offsetQ >= 0 ? offsetQ : 0;

    const items = await Clientes.listarClientes(limit, offset);

    // Nota: si necesitas total_items/total_pages, habría que exponer un COUNT en el modelo.
    const meta = {
      limit,
      offset,
      returned: Array.isArray(items) ? items.length : 0,
    };

    // ✅ En listar SÍ devolvemos data
    return sendCode(req, res, AppCode.OK, { items, meta }, { message: "OK" });
  } catch (e) {
    return next(e);
  }
});

/** POST /clientes (alta con normalización y anti-duplicados)
 *  - Respuesta minimal (sin data) y HTTP 200
 */
r.post(
  "/",
  requireJson,
  validateBodySimple(ClienteCrearSchema),
  async (req, res, next) => {
    try {
      await Clientes.crearCliente(req.body);
      // ✅ Minimal, sin data, HTTP 200
      return sendCode(req, res, AppCode.OK, undefined, { httpStatus: 200, message: "OK" });
    } catch (e: any) {
      // Conflictos conocidos (duplicados)
      if (
        e?.status === 409 ||
        e?.code === "CLIENTE_DUPLICADO_NOMBRE" ||
        e?.code === "CLIENTE_DUPLICADO_TELEFONO" ||
        e?.code === "23505"
      ) {
        return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
          httpStatus: 200,
          message: e?.message || "Conflicto: cliente duplicado.",
        });
      }

      // Violación de CHECK/validación a nivel DB
      if (e?.code === "23514") {
        return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
          httpStatus: 200,
          message: "Cliente inválido: no cumple restricciones de base de datos.",
        });
      }

      // Error controlado con status/mensaje
      if (e?.status && e?.message) {
        const code =
          e.status === 404 ? AppCode.NOT_FOUND :
          e.status === 409 ? AppCode.DB_CONSTRAINT :
          AppCode.DB_ERROR;

        return sendCode(req, res, code, undefined, {
          httpStatus: 200,
          message: e.message,
        });
      }

      // Fallback → DB_ERROR
      return sendCode(req, res, AppCode.DB_ERROR, undefined, {
        httpStatus: 200,
        message: "Error de base de datos al crear cliente.",
      });
    }
  }
);

export default r;
