// src/routes/proveedores.routes.ts
import { Router } from "express";
import { validateBodySimple } from "../middlewares/validate";
import { CreateProveedorSchema } from "../schemas/proveedor.schemas";
import { crearProveedor, listarProveedores } from "../models/proveedor.model";
import { ok, sendCode } from "../status/respond";
import { AppCode } from "../status/codes";

const r = Router();

/** GET /proveedores  (paginado básico y defensivo) */
r.get("/", async (req, res, next) => {
  try {
    const limitQ = Number(req.query.limit ?? 100);
    const offsetQ = Number(req.query.offset ?? 0);
    const limit = Number.isFinite(limitQ) && limitQ > 0 ? Math.min(limitQ, 500) : 100;
    const offset = Number.isFinite(offsetQ) && offsetQ >= 0 ? offsetQ : 0;

    const data = await listarProveedores(limit, offset);
    return ok(req, res, data);
  } catch (e) {
    next(e);
  }
});

/** POST /proveedores  (alta con validaciones y manejo de duplicados) */
r.post("/", validateBodySimple(CreateProveedorSchema), async (req, res, next) => {
  try {
    const prov = await crearProveedor(req.body);
    return sendCode(req, res, AppCode.OK, prov, { httpStatus: 201, message: "OK" });
  } catch (e: any) {
    // Choques de unicidad (del precheck del modelo o del índice único en DB)
    const constraint: string | undefined = e?.constraint;
    const isUnique =
      e?.code === "23505" ||
      e?.code === "DUPLICATE" ||
      (typeof constraint === "string" &&
        (constraint === "uniq_proveedores_nombre_norm" ||
         constraint === "uniq_proveedores_tel_digits" ||
         constraint.includes("uniq_proveedores_")));

    if (isUnique) {
      let msg = e?.message || "El proveedor ya existe (mismo nombre/teléfono).";
      // Mensajes más claros según constraint
      if (constraint === "uniq_proveedores_nombre_norm") {
        msg = "Nombre de proveedor ya registrado (case-insensitive + colapso de espacios).";
      } else if (constraint === "uniq_proveedores_tel_digits") {
        msg = "Teléfono ya registrado (se comparan solo dígitos; evita 477-555-1234 / (477)5551234).";
      }
      return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
        message: msg,
        detalle: { constraint }
      });
    }

    // Violaciones de CHECK/otras validaciones a nivel DB
    if (e?.code === "23514") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        message: "Proveedor inválido: no cumple restricciones de base de datos.",
        detalle: { constraint: e?.constraint }
      });
    }

    // Error controlado con status en el modelo
    if (e?.status && e?.message) {
      const code =
        e.status === 404 ? AppCode.NOT_FOUND :
        e.status === 409 ? AppCode.DB_CONSTRAINT :
        AppCode.DB_ERROR;

      return sendCode(req, res, code, undefined, {
        message: e.message,
        httpStatus: e.status,
        detalle: e.detail ?? e
      });
    }

    // Fallback con detalle para diagnosticar
    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      message: "Error de base de datos al crear proveedor.",
      detalle: { raw: String(e), ...(e || {}) }
    });
  }
});

export default r;
