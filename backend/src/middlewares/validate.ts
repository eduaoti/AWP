// src/middlewares/validate.ts
import { NextFunction, Request, Response } from "express";
import {
  ZodError,
  ZodObject,
  ZodTypeAny,
  ZodIssue,
  z
} from "zod";
import { AppCode } from "../status/codes";
import { sendCode } from "../status/respond";

/** Quita el nivel superior (body/query/params) del path para reportar el campo real */
const isTopLevel = (k: unknown) => k === "body" || k === "query" || k === "params";

type DetalleValidacion = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
};

/** Traduce un ZodIssue a un mensaje claro en español (compatible con varias versiones de Zod) */
function prettyIssueMessage(issue: ZodIssue): string {
  const code = (issue as any)?.code as string; // forzamos string para evitar TS2678 entre versiones

  switch (code) {
    /* ===== Tipos ===== */
    case "invalid_type": {
      const anyIssue = issue as any;
      if (anyIssue.received === "undefined") return "Campo requerido";
      if (anyIssue.expected && anyIssue.received) {
        return `Tipo de dato inválido (se esperaba ${anyIssue.expected}, se recibió ${anyIssue.received})`;
      }
      return "Tipo de dato inválido";
    }

    /* ===== Longitudes y límites ===== */
    case "too_small": {
      const i: any = issue;
      if (i.minimum != null) {
        if (i.type === "string") {
          return i.exact
            ? `Debe tener exactamente ${i.minimum} caracteres`
            : `Debe tener al menos ${i.minimum} caracteres`;
        }
        if (i.type === "array") {
          return i.exact
            ? `Debe incluir exactamente ${i.minimum} elementos`
            : `Debe incluir al menos ${i.minimum} elementos`;
        }
        if (i.type === "number") {
          return i.inclusive
            ? `Debe ser mayor o igual a ${i.minimum}`
            : `Debe ser mayor que ${i.minimum}`;
        }
      }
      return "Valor demasiado pequeño";
    }
    case "too_big": {
      const i: any = issue;
      if (i.maximum != null) {
        if (i.type === "string") {
          return i.exact
            ? `No debe exceder ${i.maximum} caracteres`
            : `No debe exceder ${i.maximum} caracteres`;
        }
        if (i.type === "array") {
          return i.exact
            ? `No debe exceder ${i.maximum} elementos`
            : `No debe exceder ${i.maximum} elementos`;
        }
        if (i.type === "number") {
          return i.inclusive
            ? `No debe ser mayor que ${i.maximum}`
            : `Debe ser menor que ${i.maximum}`;
        }
      }
      return "Valor demasiado grande";
    }
    case "not_multiple_of":
      return "El número no es un múltiplo permitido";

    /* ===== Cadenas / formato ===== */
    // zod v3 usa "invalid_string", algunas variantes antiguas/derivadas reportan "invalid_format"
    case "invalid_string":
    case "invalid_format": {
      const i: any = issue;
      const v = i.validation; // email|url|uuid|regex|datetime...
      if (v === "email") return "Formato de email inválido";
      if (v === "url") return "URL inválida";
      if (v === "uuid") return "UUID inválido";
      if (v === "regex") return "Formato inválido";
      if (v === "datetime") return "Fecha/hora inválida";
      return "Cadena inválida";
    }

    /* ===== Enum / valor inválido ===== */
    // v3: invalid_enum_value; variantes: invalid_value
    case "invalid_enum_value":
    case "invalid_value": {
      const i: any = issue;
      const opts = Array.isArray(i.options) ? i.options.join(", ") : "";
      return opts ? `Valor no permitido. Opciones: ${opts}` : "Valor no permitido";
    }

    /* ===== Claves no reconocidas ===== */
    // v3: unrecognized_keys; variantes: invalid_key
    case "unrecognized_keys":
    case "invalid_key": {
      const i: any = issue;
      const keys = Array.isArray(i.keys) ? i.keys.join(", ") : undefined;
      return keys ? `Campos no permitidos: ${keys}` : "Campos no permitidos";
    }

    /* ===== Uniones / literales / fechas (según versión) ===== */
    case "invalid_union":
      return "Ninguna de las variantes es válida";
    case "invalid_union_discriminator":
      return "Discriminador de unión inválido";
    case "invalid_literal":
      return "Valor literal inválido";
    case "invalid_date":
      return "Fecha inválida";

    /* ===== Reglas personalizadas ===== */
    case "custom":
      return issue.message || "Valor inválido";

    /* ===== Fallback ===== */
    default:
      return (issue as any)?.message || "Valor inválido";
  }
}

/** Construye { formErrors, fieldErrors } a partir de ZodError. Compatible con Zod 3.x */
function formatZodError(err: ZodError): DetalleValidacion {
  const formErrors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of err.issues) {
    const p = issue.path;

    if (!p || p.length === 0) {
      // Errores sin campo específico (refine a nivel de objeto, etc.)
      formErrors.push(prettyIssueMessage(issue));
      continue;
    }

    // body.password  -> "password"
    // body.dir.ciudad -> "dir.ciudad"
    const key = isTopLevel(p[0]) ? (p.slice(1).join(".") || String(p[0])) : p.join(".");
    (fieldErrors[key] ??= []).push(prettyIssueMessage(issue));
  }

  return { formErrors, fieldErrors };
}

/** Genera un mensaje plano y específico tipo:
 * "Validación fallida: nombre → Campo requerido; email → Formato de email inválido"
 */
function summarizeDetalle(det: DetalleValidacion): string {
  const parts: string[] = [];

  for (const [k, arr] of Object.entries(det.fieldErrors)) {
    if (!arr || !arr.length) continue;
    parts.push(`${k} → ${arr.join("; ")}`);
  }

  for (const msg of det.formErrors) {
    parts.push(msg);
  }

  if (!parts.length) return "Validación fallida.";
  return "Validación fallida: " + parts.join(" | ");
}

/** Manejo de errores de validación: envía respuesta estándar con AppCode.VALIDATION_FAILED y mensaje específico */
function handleErr(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    const detalle = formatZodError(err);
    const message = summarizeDetalle(detalle);
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, { detalle, message });
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
  const shape = (schema as any).shape;
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
/** NUEVO: valida el body “plano” (req.body) tal cual, sin envolver en { body: ... } */
export const validateBodySimple =
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = (schema as any).safeParse(req.body);
    if (parsed.success) {
      // Sobrescribimos el body con la versión ya parseada/coercida
      req.body = parsed.data as any;
      return next();
    }
    return handleErr(parsed.error, req, res, next);
  };
