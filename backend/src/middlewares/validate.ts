// src/middlewares/validate.ts
import { NextFunction, Request, Response } from "express";
import {
  ZodError,
  ZodObject,
  ZodTypeAny,
  ZodIssueCode,
  z
} from "zod";
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

/** Helpers para detectar si el schema espera body/query/params en la raíz */
function isZodObject(x: unknown): x is ZodObject<any> {
  return !!x && x instanceof z.ZodObject;
}
function hasRootKey(schema: ZodTypeAny, key: "body" | "query" | "params"): boolean {
  // Solo ZodObject tiene shape
  if (!isZodObject(schema)) return false;
  const shape = schema.shape;
  return Object.prototype.hasOwnProperty.call(shape, key);
}

/** Valida y sobrescribe req.body con los valores parseados/transformados */
export const validateBody =
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = (schema as any).safeParse({ body: req.body });
    if (parsed.success) {
      if (parsed.data?.body !== undefined) req.body = parsed.data.body;
      return next();
    }
    return handleErr(parsed.error, req, res, next);
  };

/** Valida y sobrescribe req.query con los valores parseados/transformados */
export const validateQuery =
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = (schema as any).safeParse({ query: req.query });
    if (parsed.success) {
      if (parsed.data?.query !== undefined) req.query = parsed.data.query as any;
      return next();
    }
    return handleErr(parsed.error, req, res, next);
  };

/** Valida y sobrescribe req.params con los valores parseados/transformados */
export const validateParams =
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = (schema as any).safeParse({ params: req.params });
    if (parsed.success) {
      if (parsed.data?.params !== undefined) req.params = parsed.data.params as any;
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
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = (schema as any).safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (parsed.success) {
      if (parsed.data?.body !== undefined)   req.body = parsed.data.body;
      if (parsed.data?.query !== undefined)  req.query = parsed.data.query as any;
      if (parsed.data?.params !== undefined) req.params = parsed.data.params as any;
      return next();
    }
    return handleErr(parsed.error, req, res, next);
  };

/**
 * Validador “inteligente”:
 * - Si el schema raíz contiene .shape.body, valida body.
 * - Si contiene .shape.query, valida query.
 * - Si contiene .shape.params, valida params.
 * - Si no contiene ninguno (o no es ZodObject), intenta validar req.body por defecto.
 *
 * Permite usar:  `validate(miSchema)`
 */
export const validate =
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const expectBody = hasRootKey(schema, "body");
    const expectQuery = hasRootKey(schema, "query");
    const expectParams = hasRootKey(schema, "params");

    // Construye input según lo que el schema declara
    const input: any = {};
    if (expectBody) input.body = req.body;
    if (expectQuery) input.query = req.query;
    if (expectParams) input.params = req.params;

    // Si no hay llaves en raíz (p. ej. schema simple de body), por conveniencia intentamos validar body
    const parsed = (expectBody || expectQuery || expectParams)
      ? (schema as any).safeParse(input)
      : (schema as any).safeParse({ body: req.body });

    if (parsed.success) {
      // Sobrescribe solo lo presente en el esquema
      if (parsed.data?.body !== undefined)   req.body = parsed.data.body;
      if (parsed.data?.query !== undefined)  req.query = parsed.data.query as any;
      if (parsed.data?.params !== undefined) req.params = parsed.data.params as any;
      return next();
    }
    return handleErr(parsed.error, req, res, next);
  };
