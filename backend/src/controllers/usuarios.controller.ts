// src/controllers/usuarios.controller.ts
import { Request, Response } from "express";
import { AppCode } from "../status/codes";
import { sendCode, ok } from "../status/respond";
import * as U from "../services/domain/usuarios.service";

export const createUser = async (req: Request, res: Response) => {
  try {
    const user = await U.crearUsuario(req.body);
    return sendCode(req, res, AppCode.OK, user, { httpStatus: 201 });
  } catch (e: any) {
    if (e?.status === 409 || e?.code === "USER_ALREADY_EXISTS") {
      return sendCode(req, res, AppCode.USER_ALREADY_EXISTS, undefined, {
        httpStatus: 409,
        message: e.message || "El email ya está registrado",
      });
    }
    return sendCode(req, res, AppCode.INTERNAL_ERROR, undefined, {
      httpStatus: 500,
      message: "Error al crear usuario",
    });
  }
};

export const listUsers = async (_req: Request, res: Response) => {
  const usuarios = await U.listarUsuarios();
  return ok(_req, res, usuarios);
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const user = await U.actualizarUsuario(req.body);
    return ok(req, res, user);
  } catch (e: any) {
    if (e?.status === 404) {
      return sendCode(req, res, AppCode.USER_NOT_FOUND, undefined, { httpStatus: 404, message: e.message });
    }
    return sendCode(req, res, AppCode.INTERNAL_ERROR, undefined, {
      httpStatus: 500,
      message: "Error al actualizar usuario",
    });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = await U.eliminarUsuario(Number(req.body.id));
    return ok(req, res, { id, mensaje: "Usuario eliminado" });
  } catch (e: any) {
    if (e?.status === 404) {
      return sendCode(req, res, AppCode.USER_NOT_FOUND, undefined, { httpStatus: 404, message: e.message });
    }
    return sendCode(req, res, AppCode.INTERNAL_ERROR, undefined, {
      httpStatus: 500,
      message: "Error al eliminar usuario",
    });
  }
};
