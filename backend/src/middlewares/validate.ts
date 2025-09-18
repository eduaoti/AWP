import { NextFunction, Request, Response } from "express";
import { ZodError, ZodType } from "zod";

export const validate =
  (schema: ZodType<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      // El esquema ya define si espera req.body, req.query, etc.
      schema.parse({ body: req.body });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: "Validación fallida",
          detalles: err.flatten(),
        });
      }
      next(err);
    }
  };
