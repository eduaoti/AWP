// src/controllers/producto.controller.ts
import { Request, Response, NextFunction } from "express";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import * as ProductoService from "../services/domain/producto.service";

/* ===========================================================
   Controladores para productos
   =========================================================== */

export async function crearProducto(req: Request, res: Response, next: NextFunction) {
  try {
    await ProductoService.crearProducto(req.body);
    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 200,
      message: "Producto creado con éxito",
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
        httpStatus: 200,
        message: "La clave o el nombre ya existe",
      });
    }
    next(e);
  }
}

export async function actualizarPorCodigo(req: Request, res: Response, next: NextFunction) {
  try {
    const { codigo } = req.params as { codigo: string };
    const actualizado = await ProductoService.actualizarProducto({ clave: codigo }, req.body);

    if (!actualizado) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 200,
        message: "No encontrado",
      });
    }

    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 200,
      message: "Producto actualizado con éxito",
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
        httpStatus: 200,
        message: "La clave o el nombre ya existe",
      });
    }
    next(e);
  }
}

export async function eliminarPorCodigo(req: Request, res: Response, next: NextFunction) {
  try {
    const { codigo } = req.params as { codigo: string };
    const eliminado = await ProductoService.eliminarProducto({ clave: codigo });

    if (!eliminado) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 200,
        message: "No encontrado",
      });
    }

    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 200,
      message: "Producto eliminado con éxito",
    });
  } catch (e) {
    next(e);
  }
}

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await ProductoService.listarProductos(req.body);
    return sendCode(req, res, AppCode.OK, data, {
      httpStatus: 200,
      message: "Listado generado con éxito",
    });
  } catch (e: any) {
    if (e?.status === 400 && e?.code === "PARAMETRO_INVALIDO") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
        httpStatus: 200,
        message: e.message,
      });
    }
    next(e);
  }
}

export async function actualizar(req: Request, res: Response, next: NextFunction) {
  try {
    const { clave, nombre, ...data } = req.body;
    const actualizado = await ProductoService.actualizarProducto({ clave, nombre }, data);

    if (!actualizado) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 200,
        message: "No encontrado",
      });
    }

    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 200,
      message: "Producto actualizado con éxito",
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
        httpStatus: 200,
        message: "La clave o el nombre ya existe",
      });
    }
    next(e);
  }
}

export async function actualizarStockMinimo(req: Request, res: Response, next: NextFunction) {
  try {
    const { clave, nombre, stock_minimo } = req.body;
    const actualizado = await ProductoService.actualizarStockMinimo({ clave, nombre }, stock_minimo);

    if (!actualizado) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 200,
        message: "No encontrado",
      });
    }

    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 200,
      message: "Stock mínimo actualizado con éxito",
    });
  } catch (e) {
    next(e);
  }
}

export async function eliminar(req: Request, res: Response, next: NextFunction) {
  try {
    const { clave, nombre } = req.body;
    const eliminado = await ProductoService.eliminarProducto({ clave, nombre });

    if (!eliminado) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 200,
        message: "No encontrado",
      });
    }

    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 200,
      message: "Producto eliminado con éxito",
    });
  } catch (e) {
    next(e);
  }
}
