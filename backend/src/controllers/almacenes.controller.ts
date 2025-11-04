// controllers/almacenes.controller.ts
import { Request, Response } from "express";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import * as S from "../services/domain/alamacenes.service"; // nombre de archivo según tu árbol
import {
  validarAlmacenCrear,
  validarAlmacenActualizar,
  validarAlmacenEliminar,
} from "../dto/alacen.dto";

/* ===========================================================
   LISTAR ALMACENES (GET con query: limit/offset)
   =========================================================== */
export const list = async (req: Request, res: Response) => {
  const limitQ = Number(req.query.limit ?? 100);
  const offsetQ = Number(req.query.offset ?? 0);

  // Máximo 500 como en Swagger
  const limit = Number.isFinite(limitQ) && limitQ > 0 ? Math.min(limitQ, 500) : 100;
  const offset = Number.isFinite(offsetQ) && offsetQ >= 0 ? offsetQ : 0;

  const { items, meta } = await S.list(limit, offset);

  // Headers de paginación útiles para clientes
  setPaginationHeaders(req, res, meta);

  const data = { items, meta };
  return sendCode(req, res, AppCode.OK, data, {
    httpStatus: 200,
    message: "Almacenes listados correctamente",
  });
};

/* ===========================================================
   LISTAR ALMACENES (POST JSON: page/per_page)
   =========================================================== */
export const listPostJson = async (req: Request, res: Response) => {
  const pageRaw = Number(req.body?.page ?? 1);
  const perPageRaw = Number(req.body?.per_page ?? 20);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const per_page =
    Number.isFinite(perPageRaw) && perPageRaw > 0 ? Math.min(perPageRaw, 100) : 20;

  const limit = per_page;
  const offset = (page - 1) * per_page;

  const { items, meta } = await S.list(limit, offset);

  // Enriquecer meta con estilo clásico de paginación
  const total = meta?.total ?? 0;
  const returned = meta?.returned ?? items.length;
  const hasPrev = offset > 0;
  const hasNext = offset + returned < total;

  const enrichedMeta = {
    ...meta,
    page,
    per_page,
    total_items: total,
    total_pages: Math.max(1, Math.ceil(total / per_page)),
    hasPrev,
    hasNext,
    prevOffset: hasPrev ? Math.max(0, offset - limit) : null,
    nextOffset: hasNext ? offset + limit : null,
  };

  // Headers de paginación
  setPaginationHeaders(req, res, {
    ...meta,
    hasPrev,
    hasNext,
    prevOffset: enrichedMeta.prevOffset,
    nextOffset: enrichedMeta.nextOffset,
  });

  const data = { items, meta: enrichedMeta };
  return sendCode(req, res, AppCode.OK, data, {
    httpStatus: 200,
    message: "Almacenes listados correctamente",
  });
};

/* ===========================================================
   CREAR ALMACÉN
   =========================================================== */
export const create = async (req: Request, res: Response) => {
  const valid = validarAlmacenCrear(req.body);
  if (!valid.ok) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 400,
      message: (valid.errores ?? []).join("; "),
    });
  }

  try {
    const nuevo = await S.create(req.body);
    return sendCode(req, res, AppCode.OK, nuevo, {
      httpStatus: 201,
      message: "Almacén creado con éxito",
    });
  } catch (e: any) {
    if (
      e?.status === 409 ||
      e?.code === "ALMACEN_DUPLICADO_NOMBRE" ||
      e?.code === "ALMACEN_DUPLICADO_TELEFONO" ||
      e?.code === "23505"
    ) {
      return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
        httpStatus: 409,
        message: e?.message || "Conflicto: almacén duplicado.",
      });
    }

    if (e?.code === "23514") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        httpStatus: 400,
        message: "Almacén inválido: no cumple restricciones de base de datos.",
      });
    }

    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 500,
      message: "Error de base de datos al crear almacén.",
    });
  }
};

/* ===========================================================
   OBTENER ALMACÉN POR ID
   =========================================================== */
export const getOne = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 400,
      message: "ID inválido",
    });
  }

  const row = await S.getById(id);
  if (!row) {
    return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
      httpStatus: 404,
      message: "Almacén no encontrado",
    });
  }

  return sendCode(req, res, AppCode.OK, row, {
    httpStatus: 200,
    message: "Almacén obtenido correctamente",
  });
};

/* ===========================================================
   ACTUALIZAR ALMACÉN
   =========================================================== */
export const update = async (req: Request, res: Response) => {
  const valid = validarAlmacenActualizar(req.body);
  if (!valid.ok) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 400,
      message: (valid.errores ?? []).join("; "),
    });
  }

  try {
    const row = await S.update(req.body);
    if (!row) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 404,
        message: "Almacén no encontrado",
      });
    }

    return sendCode(req, res, AppCode.OK, row, {
      httpStatus: 200,
      message: "Almacén actualizado con éxito",
    });
  } catch (e: any) {
    if (e?.status === 404) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 404,
        message: "Almacén no encontrado",
      });
    }
    if (e?.status === 409 || e?.code === "ALMACEN_DUPLICADO_NOMBRE") {
      return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
        httpStatus: 409,
        message: e?.message || "Nombre de almacén duplicado.",
      });
    }
    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 500,
      message: "Error al actualizar almacén.",
    });
  }
};

/* ===========================================================
   ELIMINAR ALMACÉN
   =========================================================== */
export const remove = async (req: Request, res: Response) => {
  const valid = validarAlmacenEliminar(req.body);
  if (!valid.ok) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 400,
      message: (valid.errores ?? []).join("; "),
    });
  }

  try {
    const eliminado = await S.remove(Number(req.body.id));
    if (!eliminado) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 404,
        message: "Almacén no encontrado",
      });
    }

    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 200,
      message: "Almacén eliminado con éxito",
    });
  } catch (e: any) {
    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 500,
      message: "Error al eliminar almacén.",
    });
  }
};

/* ===========================================================
   Helpers
   =========================================================== */
type MetaLike = {
  total?: number;
  limit?: number;
  offset?: number;
  returned?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
  prevOffset?: number | null;
  nextOffset?: number | null;
};

function setPaginationHeaders(req: Request, res: Response, meta: MetaLike = {}) {
  const total = meta.total ?? 0;
  const limit = meta.limit ?? 0;
  const offset = meta.offset ?? 0;

  res.setHeader("X-Total-Count", total);
  res.setHeader("X-Limit", limit);
  res.setHeader("X-Offset", offset);

  // Link header (RFC5988) con prev/next
  const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl || ""}${req.path}`;
  const links: string[] = [];
  if (meta.hasPrev && meta.prevOffset !== null && meta.prevOffset !== undefined) {
    links.push(`<${baseUrl}?limit=${limit}&offset=${meta.prevOffset}>; rel="prev"`);
  }
  if (meta.hasNext && meta.nextOffset !== null && meta.nextOffset !== undefined) {
    links.push(`<${baseUrl}?limit=${limit}&offset=${meta.nextOffset}>; rel="next"`);
  }
  if (links.length) res.setHeader("Link", links.join(", "));
}
