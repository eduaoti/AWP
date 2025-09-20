import { NextFunction, Request, Response } from "express";
import { ZodError, ZodObject } from "zod";
import { AppCode } from "../status/codes";
import { sendCode } from "../status/respond";

/** Quita el nivel superior (body/query/params) del path para reportar el campo real */
const isTopLevel = (k: unknown) => k === "body" || k === "query" || k === "params";

/** Construye { formErrors, fieldErrors } a partir de ZodError. Compatible con Zod 3.x */
function formatZodError(err: ZodError) {
  const formErrors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of err.issues) {
    const p = issue.path;

    if (!p || p.length === 0) {
      // Errores sin campo específico (refine a nivel de objeto, etc.)
      formErrors.push(issue.message);
      continue;
    }

    // body.password  -> "password"
    // body.dir.ciudad -> "dir.ciudad"
    const key = isTopLevel(p[0]) ? (p.slice(1).join(".") || String(p[0])) : p.join(".");
    (fieldErrors[key] ??= []).push(issue.message);
  }

  return { formErrors, fieldErrors };
}

/** Manejo de errores de validación: envía respuesta estándar con AppCode.VALIDATION_FAILED */
function handleErr(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    const detalle = formatZodError(err);
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, { detalle });
  }
  return next(err);
}

/** Valida y sobrescribe req.body con los valores parseados/transformados */
export const validateBody =
  (schema: ZodObject<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({ body: req.body });
    if (parsed.success) {
      req.body = parsed.data.body; // conserva transforms (e.g. email lowercased)
      return next();
    }
    return handleErr(parsed.error, req, res, next);
  };

/** Valida y sobrescribe req.query con los valores parseados/transformados */
export const validateQuery =
  (schema: ZodObject<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({ query: req.query });
    if (parsed.success) {
      req.query = parsed.data.query as any;
      return next();
    }
    return handleErr(parsed.error, req, res, next);
  };

/** Valida y sobrescribe req.params con los valores parseados/transformados */
export const validateParams =
  (schema: ZodObject<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({ params: req.params });
    if (parsed.success) {
      req.params = parsed.data.params as any;
      return next();
    }
    return handleErr(parsed.error, req, res, next);
  };

/**
 * (Opcional) Validador combinado por si tienes schemas que incluyen varias secciones:
 *   z.object({ body: z.object(...), query: z.object(...), params: z.object(...) })
 *
 * Úsalo solo si defines un schema con varias llaves a la vez.
 */
export const validateCombined =
  (schema: ZodObject<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (parsed.success) {
      if (parsed.data.body)   req.body = parsed.data.body;
      if (parsed.data.query)  req.query = parsed.data.query as any;
      if (parsed.data.params) req.params = parsed.data.params as any;
      return next();
    }
    return handleErr(parsed.error, req, res, next);
  };
