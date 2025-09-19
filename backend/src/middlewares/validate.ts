import { NextFunction, Request, Response } from "express";
import { ZodError, ZodType } from "zod";
import { AppCode } from "../status/codes";
import { sendCode } from "../status/respond";

function handleErr(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, { detalle: err.flatten() });
  }
  next(err);
}

export const validateBody = (schema: ZodType<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try { schema.parse({ body: req.body }); next(); }
    catch (err) { handleErr(err, req, res, next); }
  };

export const validateQuery = (schema: ZodType<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try { schema.parse({ query: req.query }); next(); }
    catch (err) { handleErr(err, req, res, next); }
  };

export const validateParams = (schema: ZodType<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try { schema.parse({ params: req.params }); next(); }
    catch (err) { handleErr(err, req, res, next); }
  };
