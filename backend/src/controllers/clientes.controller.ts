// src/controllers/clientes.controller.ts
import { Request, Response } from "express";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import * as S from "../services/domain/clientes.service";
import {
  validarClienteCrear,
  validarClienteActualizar,
  validarClienteEliminar,
} from "../dto/cliente.dto";

/* ===========================================================
   LISTAR CLIENTES
   =========================================================== */
export const list = async (req: Request, res: Response) => {
  const limitQ = Number(req.query.limit ?? 500);
  const offsetQ = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(limitQ) && limitQ > 0 ? Math.min(limitQ, 1000) : 500;
  const offset = Number.isFinite(offsetQ) && offsetQ >= 0 ? offsetQ : 0;

  const items = await S.list(limit, offset);
  const meta = { limit, offset, returned: Array.isArray(items) ? items.length : 0 };

  return sendCode(req, res, AppCode.OK, { items, meta }, {
    httpStatus: 200,
    message: "Clientes listados con éxito",
  });
};

/* ===========================================================
   CREAR CLIENTE
   =========================================================== */
export const create = async (req: Request, res: Response) => {
  // 🔎 Validación con DTO (Zod)
  const valid = validarClienteCrear(req.body);
  if (!valid.ok) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 200,
      message: valid.errores.join("; "),
    });
  }

  try {
    await S.create(req.body);
    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 200,
      message: "Cliente creado con éxito",
    });
  } catch (e: any) {
    // Mapeo de errores
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

    if (e?.code === "23514") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        httpStatus: 200,
        message: "Cliente inválido: no cumple restricciones de base de datos.",
      });
    }

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

    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 200,
      message: "Error de base de datos al crear cliente.",
    });
  }
};

/* ===========================================================
   OBTENER CLIENTE POR ID
   =========================================================== */
export const getOne = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 200,
      message: "ID inválido",
    });
  }

  const row = await S.getById(id);
  if (!row) {
    return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
      httpStatus: 200,
      message: "Cliente no encontrado",
    });
  }

  return sendCode(req, res, AppCode.OK, row, {
    httpStatus: 200,
    message: "Cliente obtenido correctamente",
  });
};

/* ===========================================================
   ACTUALIZAR CLIENTE
   =========================================================== */
export const update = async (req: Request, res: Response) => {
  const valid = validarClienteActualizar(req.body);
  if (!valid.ok) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 200,
      message: valid.errores.join("; "),
    });
  }

  try {
    const row = await S.update(req.body);
    return sendCode(req, res, AppCode.OK, row, {
      httpStatus: 200,
      message: "Cliente actualizado con éxito",
    });
  } catch (e: any) {
    if (e?.status === 404) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 200,
        message: "Cliente no encontrado",
      });
    }
    if (e?.status === 409 || e?.code === "CLIENTE_DUPLICADO_NOMBRE") {
      return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
        httpStatus: 200,
        message: e?.message || "Nombre de cliente duplicado.",
      });
    }
    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 200,
      message: "Error al actualizar cliente.",
    });
  }
};

/* ===========================================================
   ELIMINAR CLIENTE
   =========================================================== */
export const remove = async (req: Request, res: Response) => {
  const valid = validarClienteEliminar(req.body);
  if (!valid.ok) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 200,
      message: valid.errores.join("; "),
    });
  }

  try {
    await S.remove(Number(req.body.id));
    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 200,
      message: "Cliente eliminado con éxito",
    });
  } catch (e: any) {
    if (e?.status === 404) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 200,
        message: "Cliente no encontrado",
      });
    }
    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 200,
      message: "Error al eliminar cliente.",
    });
  }
};
