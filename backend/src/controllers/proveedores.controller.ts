// src/controllers/proveedores.controller.ts
import { Request, Response } from "express";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import * as S from "../services/domain/proveedores.service";
import { validarProveedorCrear } from "../dto/proveedor.dto";

/* ===========================================================
   LISTAR PROVEEDORES
   =========================================================== */
export const list = async (req: Request, res: Response) => {
  const limitQ = Number(req.query.limit ?? 100);
  const offsetQ = Number(req.query.offset ?? 0);

  const limit = Number.isFinite(limitQ) && limitQ > 0 ? Math.min(limitQ, 500) : 100;
  const offset = Number.isFinite(offsetQ) && offsetQ >= 0 ? offsetQ : 0;

  const raw = await S.list(limit, offset);

  const data =
    raw && typeof raw === "object" && "items" in (raw as any) && "meta" in (raw as any)
      ? raw
      : Array.isArray(raw)
      ? { items: raw, meta: { limit, offset, count: raw.length } }
      : { items: [], meta: { limit, offset, count: 0 } };

  return sendCode(req, res, AppCode.OK, data, {
    message: "Proveedores listados con éxito",
    httpStatus: 200,
  });
};

/* ===========================================================
   CREAR PROVEEDOR
   =========================================================== */
export const create = async (req: Request, res: Response) => {
  // 🔍 Validación previa con DTO
  const valid = validarProveedorCrear(req.body);
  if (!valid.ok) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 400,
      message: valid.errores.join("; "),
    });
  }

  try {
    await S.create(req.body);
    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 201,
      message: "Proveedor creado con éxito",
    });
  } catch (e: any) {
    // ⚠️ Conflictos de unicidad
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
      if (constraint === "uniq_proveedores_nombre_norm") {
        msg = "Nombre de proveedor ya registrado (case-insensitive + colapso de espacios).";
      } else if (constraint === "uniq_proveedores_tel_digits") {
        msg = "Teléfono ya registrado (se comparan solo dígitos; evita 477-555-1234 / (477)5551234).";
      }

      return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
        httpStatus: 409,
        message: msg,
      });
    }

    // ⚠️ Violaciones de CHECK u otras restricciones
    if (e?.code === "23514") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        httpStatus: 400,
        message: "Proveedor inválido: no cumple restricciones de base de datos.",
      });
    }

    // ⚠️ Errores controlados
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

    // ⚠️ Error genérico
    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 500,
      message: "Error de base de datos al crear proveedor.",
    });
  }
};
