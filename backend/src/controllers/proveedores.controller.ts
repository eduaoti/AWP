// src/controllers/proveedores.controller.ts
import { Request, Response } from "express";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import * as S from "../services/domain/proveedores.service";
import {
  validarProveedorCrear,
  validarProveedorActualizar,
} from "../dto/proveedor.dto";

/* ===========================================================
   LISTAR PROVEEDORES
   GET /proveedores
   Query: ?limit & ?offset
   =========================================================== */
export const list = async (req: Request, res: Response) => {
  const limitQ = Number(req.query.limit ?? 100);
  const offsetQ = Number(req.query.offset ?? 0);

  const limit =
    Number.isFinite(limitQ) && limitQ > 0 ? Math.min(limitQ, 500) : 100;
  const offset = Number.isFinite(offsetQ) && offsetQ >= 0 ? offsetQ : 0;

  const raw = await S.list(limit, offset);

  // Aseguramos estructura { items, meta }
  const data =
    raw && typeof raw === "object" && "items" in (raw as any) && "meta" in (raw as any)
      ? raw
      : Array.isArray(raw)
      ? {
          items: raw,
          meta: { limit, offset, count: raw.length },
        }
      : {
          items: [],
          meta: { limit, offset, count: 0 },
        };

  return sendCode(req, res, AppCode.OK, data, {
    message: "Proveedores listados con éxito",
    httpStatus: 200,
  });
};

/* ===========================================================
   CREAR PROVEEDOR
   POST /proveedores
   Body: { nombre, telefono?, contacto? }
   =========================================================== */
export const create = async (req: Request, res: Response) => {
  // 🔍 Validación previa con DTO (Zod)
  const valid = validarProveedorCrear(req.body);
  if (!valid.ok) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 400,
      message: valid.errores.join("; "),
    });
  }

  try {
    await S.create(valid.value);
    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 201,
      message: "Proveedor creado con éxito",
    });
  } catch (e: any) {
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
        msg =
          "Nombre de proveedor ya registrado (case-insensitive + colapso de espacios).";
      } else if (constraint === "uniq_proveedores_tel_digits") {
        msg =
          "Teléfono ya registrado (se comparan solo dígitos; evita 477-555-1234 / (477)5551234).";
      }

      return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
        httpStatus: 409,
        message: msg,
      });
    }

    if (e?.code === "23514") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        httpStatus: 400,
        message:
          "Proveedor inválido: no cumple restricciones de base de datos.",
      });
    }

    if (e?.status && e?.message) {
      const code =
        e.status === 404
          ? AppCode.NOT_FOUND
          : e.status === 409
          ? AppCode.DB_CONSTRAINT
          : AppCode.DB_ERROR;

      return sendCode(req, res, code, undefined, {
        httpStatus: e.status,
        message: e.message,
      });
    }

    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 500,
      message: "Error de base de datos al crear proveedor.",
    });
  }
};

/* ===========================================================
   OBTENER PROVEEDOR POR ID
   GET /proveedores/:id
   =========================================================== */
export const getById = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 400,
      message: "El id debe ser un número positivo.",
    });
  }

  const proveedor = await S.getById(id);
  if (!proveedor) {
    return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
      httpStatus: 404,
      message: "Proveedor no encontrado.",
    });
  }

  return sendCode(req, res, AppCode.OK, proveedor, {
    httpStatus: 200,
    message: "Proveedor obtenido con éxito",
  });
};

/* ===========================================================
   ACTUALIZAR PROVEEDOR
   PUT /proveedores/:id
   Body: { nombre, telefono?, contacto? }
   =========================================================== */
export const update = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 400,
      message: "El id debe ser un número positivo.",
    });
  }

  const valid = validarProveedorActualizar({ ...req.body, id });
  if (!valid.ok) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 400,
      message: valid.errores.join("; "),
    });
  }

  try {
    const proveedor = await S.update(valid.value);
    return sendCode(req, res, AppCode.OK, proveedor, {
      httpStatus: 200,
      message: "Proveedor actualizado con éxito",
    });
  } catch (e: any) {
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
        msg =
          "Nombre de proveedor ya registrado (case-insensitive + colapso de espacios).";
      } else if (constraint === "uniq_proveedores_tel_digits") {
        msg =
          "Teléfono ya registrado (se comparan solo dígitos; evita 477-555-1234 / (477)5551234).";
      }

      return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
        httpStatus: 409,
        message: msg,
      });
    }

    if (e?.status && e?.message) {
      const code =
        e.status === 404
          ? AppCode.NOT_FOUND
          : e.status === 409
          ? AppCode.DB_CONSTRAINT
          : AppCode.DB_ERROR;

      return sendCode(req, res, code, undefined, {
        httpStatus: e.status,
        message: e.message,
      });
    }

    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 500,
      message: "Error de base de datos al actualizar proveedor.",
    });
  }
};

/* ===========================================================
   ELIMINAR PROVEEDOR
   DELETE /proveedores/:id
   =========================================================== */
export const remove = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 400,
      message: "El id debe ser un número positivo.",
    });
  }

  try {
    await S.remove(id);
    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 200,
      message: "Proveedor eliminado con éxito",
    });
  } catch (e: any) {
    if (e?.status && e?.message) {
      const code =
        e.status === 404
          ? AppCode.NOT_FOUND
          : e.status === 409
          ? AppCode.DB_CONSTRAINT
          : AppCode.DB_ERROR;

      return sendCode(req, res, code, undefined, {
        httpStatus: e.status,
        message: e.message,
      });
    }

    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 500,
      message: "Error de base de datos al eliminar proveedor.",
    });
  }
};
