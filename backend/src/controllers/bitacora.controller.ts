// src/controllers/bitacora.controller.ts
import { Request, Response, NextFunction } from "express";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import * as BitacoraService from "../services/domain/bitacora.service";
import { ZodError, ZodIssue } from "zod";

export async function listaAccesos(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rows = await BitacoraService.accesos(req.query);
    return sendCode(req, res, AppCode.OK, rows);
  } catch (e) {
    if (e instanceof ZodError) {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, {
        httpStatus: 400,
        message: "Parámetros de consulta inválidos",
        detalle: e.issues.map((i: ZodIssue) => i.message),
      });
    }
    return next(e);
  }
}

export async function listaMovimientos(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rows = await BitacoraService.movimientos(req.query);
    return sendCode(req, res, AppCode.OK, rows);
  } catch (e) {
    if (e instanceof ZodError) {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, {
        httpStatus: 400,
        message: "Parámetros de consulta inválidos",
        detalle: e.issues.map((i: ZodIssue) => i.message),
      });
    }
    return next(e);
  }
}

export async function listaSistema(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rows = await BitacoraService.sistema(req.query);
    return sendCode(req, res, AppCode.OK, rows);
  } catch (e) {
    if (e instanceof ZodError) {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, {
        httpStatus: 400,
        message: "Parámetros de consulta inválidos",
        detalle: e.issues.map((i: ZodIssue) => i.message),
      });
    }
    return next(e);
  }
}
