import { Request, Response, NextFunction } from "express";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import * as CategoriaService from "../services/domain/categoria.service";

export async function crear(req: Request, res: Response, next: NextFunction) {
  try {
    const categoria = await CategoriaService.crearCategoria(req.body);
    return sendCode(req, res, AppCode.OK, categoria, {
      httpStatus: 200,
      message: "Categoría creada con éxito",
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
        httpStatus: 200,
        message: "El nombre de la categoría ya existe",
      });
    }
    next(e);
  }
}

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await CategoriaService.listarCategorias(req.query.q as string);
    return sendCode(req, res, AppCode.OK, data, {
      httpStatus: 200,
      message: "Listado generado con éxito",
    });
  } catch (e) {
    next(e);
  }
}

export async function actualizar(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const actualizado = await CategoriaService.actualizarCategoria(id, req.body);
    if (!actualizado) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 200,
        message: "No encontrado",
      });
    }
    return sendCode(req, res, AppCode.OK, actualizado, {
      httpStatus: 200,
      message: "Categoría actualizada con éxito",
    });
  } catch (e) {
    next(e);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const eliminado = await CategoriaService.eliminarCategoria(id);
    if (!eliminado) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 200,
        message: "No encontrado",
      });
    }
    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 200,
      message: "Categoría eliminada con éxito",
    });
  } catch (e) {
    next(e);
  }
}
