// src/routes/proveedores.routes.ts
import { Router } from "express";
import { validateBodySimple } from "../middlewares/validate";
import { requireJson } from "../middlewares/require-json";
import { CreateProveedorSchema } from "../schemas/proveedor.schemas";
import { crearProveedor, listarProveedores } from "../models/proveedor.model";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";

const r = Router();

/** GET /proveedores  (listar con data + meta) */
r.get("/", async (req, res, next) => {
  try {
    const limitQ = Number(req.query.limit ?? 100);
    const offsetQ = Number(req.query.offset ?? 0);

    const limit = Number.isFinite(limitQ) && limitQ > 0 ? Math.min(limitQ, 500) : 100;
    const offset = Number.isFinite(offsetQ) && offsetQ >= 0 ? offsetQ : 0;

    const raw = await listarProveedores(limit, offset);

    // Soporta retorno como array o como {items, meta}
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
      message: "Proveedores listados con éxito",
      httpStatus: 200,
    });
  } catch (e) {
    next(e);
  }
});

/** POST /proveedores  (alta con validaciones y manejo de duplicados) */
r.post("/", requireJson, validateBodySimple(CreateProveedorSchema), async (req, res, next) => {
  try {
    await crearProveedor(req.body);
    // Creado → 201, respuesta minimalista (sin data)
    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 201,
      message: "Proveedor creado con éxito",
    });
  } catch (e: any) {
    // Choques de unicidad (precheck o índice único en DB)
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
      if (constraint === "uniq_proveedores_nombre_norm") msg = "Nombre de proveedor ya registrado.";
      else if (constraint === "uniq_proveedores_tel_digits") msg = "Teléfono ya registrado.";

      return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
        httpStatus: 409,
        message: msg,
      });
    }

    // Violaciones de CHECK/otras validaciones a nivel DB
    if (e?.code === "23514") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        httpStatus: 400,
        message: "Proveedor inválido: no cumple restricciones de base de datos.",
      });
    }

    // Error controlado con status en el modelo
    if (e?.status && e?.message) {
      const code =
        e.status === 404 ? AppCode.NOT_FOUND :
        e.status === 409 ? AppCode.DB_CONSTRAINT :
        AppCode.DB_ERROR;

      return sendCode(req, res, code, undefined, {
        httpStatus: e.status,
        message: e.message,
      });
    }

    // Fallback
    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 500,
      message: "Error de base de datos al crear proveedor.",
    });
  }
});

export default r;
