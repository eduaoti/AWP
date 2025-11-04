import { NextFunction, Request, Response } from "express";
import {
  ZodError,
  ZodObject,
  ZodTypeAny,
  ZodIssue,
  z
} from "zod";
import { AppCode } from "../../status/codes";
import { sendCode } from "../../status/respond";

/** Quita el nivel superior (body/query/params) del path para reportar el campo real */
const isTopLevel = (k: unknown) => k === "body" || k === "query" || k === "params";

type DetalleValidacion = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
};

/** Lee el valor original del body dado un path tipo "a.b.c" */
function getValueAtPath(obj: any, path: string): unknown {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
}

/** Detecta si un mensaje ya es “específico” (incluye flecha → o menciona validación clara) */
function isSpecificMessage(msg: string, key?: string): boolean {
  if (!msg) return false;
  if (msg.includes("→")) return true;
  if (key && msg.toLowerCase().startsWith(key.toLowerCase())) return true;
  return false;
}

/** Traduce un ZodIssue a un mensaje claro en español (prioriza el message del schema) */
function prettyIssueMessage(issue: ZodIssue): string {
  const i: any = issue;
  const code = i?.code as string | undefined;
  const msgFromSchema = typeof i?.message === "string" && i.message.trim().length > 0 ? i.message.trim() : null;
  const pathArr: string[] = Array.isArray(i?.path) ? i.path : [];
  const key = pathArr.length ? String(pathArr[pathArr.length - 1]) : "";
  const expected = i?.expected as string | undefined;
  const received = i?.received as string | undefined;

  // 1) Siempre prioriza el message definido en el schema
  if (msgFromSchema) return msgFromSchema;

  switch (code) {
    case "invalid_type": {
      // Algunas versiones con z.coerce.number() reportan received = "nan"
      const receivedLower = String(received ?? "").toLowerCase();
      if (receivedLower === "nan") {
        return "Debe ser un número (sin comillas).";
      }

      if (received === "undefined") return "Campo requerido";
      if (received === "null") {
        if (expected === "string")  return "No se permite null; debe ser una cadena.";
        if (expected === "number")  return "No se permite null; debe ser un número.";
        if (expected === "boolean") return "No se permite null; debe ser booleano.";
        if (expected === "object")  return "No se permite null; debe ser un objeto.";
        if (expected === "array")   return "No se permite null; debe ser un arreglo.";
        return "No se permite null.";
      }
      if (expected && received) {
        if (expected === "string" && received === "number")  return "Debe ser una cadena, no un número.";
        if (expected === "number" && received === "string")  return "Debe ser un número (sin comillas).";
        if (expected === "string" && received === "boolean") return "Debe ser una cadena, no booleano.";
        if (expected === "number" && received === "boolean") return "Debe ser un número, no booleano.";
        if (expected === "boolean" && received === "string") return "Debe ser booleano (true/false), no una cadena.";
        return `Tipo de dato inválido (se esperaba ${expected}, se recibió ${received}).`;
      }
      return "Tipo de dato inválido";
    }

    case "too_small": {
      const min = i.minimum;
      if (min != null) {
        if (i.type === "string")  return i.exact ? `Debe tener exactamente ${min} caracteres` : `Debe tener al menos ${min} caracteres`;
        if (i.type === "array")   return i.exact ? `Debe incluir exactamente ${min} elementos` : `Debe incluir al menos ${min} elementos`;
        if (i.type === "number")  return i.inclusive ? `Debe ser mayor o igual a ${min}` : `Debe ser mayor que ${min}`;
      }
      // fallback por campo
      if (key === "clave") return "clave → Longitud insuficiente";
      return "Valor demasiado pequeño";
    }

    case "too_big": {
      const max = i.maximum;
      if (max != null) {
        if (i.type === "string")  return `No debe exceder ${max} caracteres`;
        if (i.type === "array")   return `No debe exceder ${max} elementos`;
        if (i.type === "number")  return i.inclusive ? `No debe ser mayor que ${max}` : `Debe ser menor que ${max}`;
      }
      // fallback por campo
      if (key === "clave" && typeof max === "number") return `clave → Máximo ${max} caracteres`;
      return "Valor demasiado grande";
    }

    case "not_multiple_of":
      return "El número no es un múltiplo permitido";

    case "invalid_string":
    case "invalid_format": {
      const v = i.validation;
      if (v === "email")    return "Formato de email inválido";
      if (v === "url")      return "URL inválida";
      if (v === "uuid")     return "UUID inválido";
      if (v === "regex") {
        // Si no vino message del schema, damos un fallback útil por campo
        if (key === "clave")     return "clave → Solo letras, números y guiones (-)";
        if (key === "unidad")    return "unidad → Formato inválido";
        if (key === "categoria") return "categoria → Formato inválido";
        return "Formato inválido";
      }
      if (v === "datetime") return "Fecha/hora inválida";
      return "Cadena inválida";
    }

    case "invalid_enum_value":
    case "invalid_value": {
      const opts = Array.isArray(i.options) ? i.options.join(", ") : "";
      return opts ? `Valor no permitido. Opciones: ${opts}` : "Valor no permitido";
    }

    case "unrecognized_keys":
    case "invalid_key": {
      const keys = Array.isArray(i.keys) ? i.keys.join(", ") : undefined;
      return keys ? `Campos no permitidos: ${keys}` : "Campos no permitidos";
    }

    case "invalid_union":
      return "Ninguna de las variantes es válida";

    case "invalid_union_discriminator":
      return "Discriminador de unión inválido";

    case "invalid_literal":
      return "Valor literal inválido";

    case "invalid_date":
      return "Fecha inválida";

    case "custom":
      return "Valor inválido";

    default:
      return "Valor inválido";
  }
}

/** Construye { formErrors, fieldErrors } a partir de ZodError. Compatible con Zod 3.x */
function formatZodError(err: ZodError): DetalleValidacion {
  const formErrors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const p = issue.path;
    const msg = prettyIssueMessage(issue);
    if (!p || p.length === 0) { formErrors.push(msg); continue; }
    const key = isTopLevel(p[0]) ? (p.slice(1).join(".") || String(p[0])) : p.join(".");
    (fieldErrors[key] ??= []).push(msg);
  }
  return { formErrors, fieldErrors };
}

/** Selecciona un ÚNICO mensaje compacto para responder (solo {codigo,mensaje}) */
function pickSingleMessage(det: DetalleValidacion, req: Request): string {
  // 1) Prioriza campos con null explícito
  for (const [k] of Object.entries(det.fieldErrors)) {
    const val = getValueAtPath(req.body, k);
    if (val === null) {
      return `El campo '${k}' no puede ser nulo.`;
    }
  }
  // 2) Prioriza "Campo requerido"
  for (const [k, arr] of Object.entries(det.fieldErrors)) {
    const hit = arr.find(m => /Campo requerido/i.test(m));
    if (hit) {
      // si el mensaje ya es específico, devuélvelo tal cual
      return isSpecificMessage(hit, k) ? hit : `El campo '${k}' es obligatorio.`;
    }
  }
  // 3) Si hay algún otro mensaje de campo, devuelve el primero
  for (const [k, arr] of Object.entries(det.fieldErrors)) {
    if (arr.length) {
      const first = arr[0];
      // evita duplicar "El campo 'k':" si el mensaje ya es específico
      return isSpecificMessage(first, k) ? first : `El campo '${k}': ${first}`;
    }
  }
  // 4) Si no hay fieldErrors, usa el primer formError (si existe)
  if (det.formErrors.length) return det.formErrors[0];
  // 5) Fallback
  return "Validación fallida.";
}

/** Manejo de errores de validación: responder 200 con {codigo, mensaje} */
function handleErr(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    const detalle = formatZodError(err);
    const mensaje = pickSingleMessage(detalle, req);
    // ⬇️ Forzamos HTTP 200 y SIN data
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 200,
      message: mensaje
    });
  }
  return next(err);
}

/** Helpers para detectar si el schema espera body/query/params en la raíz */
function isZodObject(x: unknown): x is ZodObject<any> {
  return !!x && x instanceof z.ZodObject;
}
function hasRootKey(schema: ZodTypeAny, key: "body" | "query" | "params"): boolean {
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
/** Valida y sobrescribe req.query con los valores parseados/transformados */
export const validateQuery =
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      // 🧩 Si viene anidado como req.query.query (por axios o React Router)
      const rawQuery: any =
        typeof req.query.query === "object" && Object.keys(req.query.query).length
          ? req.query.query
          : req.query;

      const parsed = (schema as any).safeParse(rawQuery);

      if (parsed.success) {
        req.query = parsed.data as any;
        return next();
      }

      // ❌ Si hay errores, reúsamos el manejador estándar
      return handleErr(parsed.error, req, res, next);
    } catch (err) {
      return handleErr(err, req, res, next);
    }
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

/** Validador combinado */
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

/** Validador “inteligente” */
export const validate =
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const expectBody = hasRootKey(schema, "body");
    const expectQuery = hasRootKey(schema, "query");
    const expectParams = hasRootKey(schema, "params");
    const input: any = {};
    if (expectBody) input.body = req.body;
    if (expectQuery) input.query = req.query;
    if (expectParams) input.params = req.params;

    const parsed = (expectBody || expectQuery || expectParams)
      ? (schema as any).safeParse(input)
      : (schema as any).safeParse({ body: req.body });

    if (parsed.success) {
      if (parsed.data?.body !== undefined)   req.body = parsed.data.body;
      if (parsed.data?.query !== undefined)  req.query = parsed.data.query as any;
      if (parsed.data?.params !== undefined) req.params = parsed.data.params as any;
      return next();
    }
    return handleErr(parsed.error, req, res, next);
  };

/** Valida el body “plano” (req.body) */
export const validateBodySimple =
  <T extends ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = (schema as any).safeParse(req.body);
    if (parsed.success) {
      req.body = parsed.data as any;
      return next();
    }
    return handleErr(parsed.error, req, res, next);
  };
