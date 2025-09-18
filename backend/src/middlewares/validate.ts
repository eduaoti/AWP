import { NextFunction, Request, Response } from "express";
import { ZodError, ZodObject, ZodRawShape } from "zod";

// Valida que el string no sea vacío ni "null"/"undefined"
const notBadString = (v: unknown) =>
  typeof v === "string" &&
  v.trim().length > 0 &&
  v.trim().toLowerCase() !== "null" &&
  v.trim().toLowerCase() !== "undefined";

export const validate =
  (schema: ZodObject<ZodRawShape>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        headers: req.headers,
      });
      return next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: "Validación fallida",
          detalles: err.flatten(),
        });
      }
      return next(err as Error);
    }
  };

export const guards = { notBadString };
