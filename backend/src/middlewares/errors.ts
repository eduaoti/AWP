// src/middlewares/errors.ts
import { NextFunction, Request, Response } from "express";
import { ZodError, ZodIssue } from "zod";
import { AppCode } from "../status/codes";

/* ======================= Helpers JSON syntax / raw body ======================= */

function posToLineCol(text: string, pos: number) {
  let line = 1, col = 1;
  for (let i = 0; i < text.length && i < pos; i++) {
    const ch = text[i];
    if (ch === "\n") { line++; col = 1; }
    else { col++; }
  }
  return { line, col };
}

function hasBOM(raw: string) { return raw.length > 0 && raw.charCodeAt(0) === 0xFEFF; }
function containsTabs(raw: string) { return raw.includes("\t"); }
function containsComments(raw: string) { return /(^|[\s{,\[])(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)/.test(raw); }
function containsControlChars(raw: string) { return /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(raw); }

/** Campos esperados en POST /productos (para sugerir tipo esperado cuando falta valor) */
const PRODUCTOS_CREATE_EXPECTED: Record<string, "string" | "number"> = {
  clave: "string",
  nombre: "string",
  unidad: "string",
  descripcion: "string",
  categoria: "string",
  precio: "number",
  stock_minimo: "number",
  stock_actual: "number",
};

function findNearestKeyBefore(raw: string, pos: number) {
  const upTo = raw.slice(0, pos);
  const m = /"([^"\\]+)"\s*:\s*$/.exec(upTo);
  return m ? m[1] : undefined;
}

function nextNonWsChar(raw: string, pos: number) {
  let i = pos;
  while (i < raw.length && /\s/.test(raw[i])) i++;
  return { ch: raw[i], idx: i };
}

function isBareWordStart(ch?: string) { return !!ch && /[A-Za-z_\p{L}]/u.test(ch); }
function isDigitLike(ch?: string) { return !!ch && /[0-9\-]/.test(ch); }

/** Heurísticas cuando el parser no da "position N" */
function findHeuristicPositionAndKey(raw: string): { pos: number, key?: string } | null {
  {
    const re = /"([^"\\]+)"\s*:\s*,/g;
    const m = re.exec(raw);
    if (m) {
      const commaIndex = m.index + m[0].lastIndexOf(",");
      return { pos: commaIndex, key: m[1] };
    }
  }
  {
    const re = /"([^"\\]+)"\s*:\s*(?=[}\]])/g;
    const m = re.exec(raw);
    if (m) {
      const closingIdx = raw.slice(m.index + m[0].length).search(/[}\]]/);
      const pos = closingIdx >= 0 ? m.index + m[0].length + closingIdx : m.index + m[0].length;
      return { pos, key: m[1] };
    }
  }
  {
    const re = /"([^"\\]+)"\s*:\s*(?=\s*"[^"\\]+"\s*:)/g;
    const m = re.exec(raw);
    if (m) {
      const following = raw.slice(m.index + m[0].length);
      const nextKeyIdx = following.search(/"[^"\\]+"\s*:/);
      const pos = nextKeyIdx >= 0 ? m.index + m[0].length + nextKeyIdx : m.index + m[0].length;
      return { pos, key: m[1] };
    }
  }
  {
    const re = /,\s*[}\]]/g;
    const m = re.exec(raw);
    if (m) return { pos: m.index, key: undefined };
  }
  return null;
}

function guessExpectedType(req: Request, field?: string): "string" | "number" | undefined {
  if (!field) return undefined;
  if (req.method === "POST" && req.path === "/productos") return PRODUCTOS_CREATE_EXPECTED[field];
  return undefined;
}

function inferHint(raw: string, pos: number, req: Request, forcedKey?: string) {
  const { ch } = nextNonWsChar(raw, pos);
  const key = forcedKey || findNearestKeyBefore(raw, pos);
  const expected = guessExpectedType(req, key);

  if (containsComments(raw)) return "Se detectaron comentarios. El JSON no admite // ni /* */.";
  if (containsTabs(raw)) return "Se detectaron tabs. Usa espacios; evita '\\t'.";
  if (hasBOM(raw)) return "Se detectó BOM al inicio del JSON. Elimínalo.";
  if (raw.includes("'")) return "Usa comillas dobles (\") para cadenas; no se permiten comillas simples (').";
  if (containsControlChars(raw)) return "Hay caracteres de control no permitidos.";

  if (key) {
    if (ch === "," || ch === "}" || ch === "]" || ch === undefined) {
      if (expected === "string") return `Falta valor para "${key}". Es obligatorio agregar un dato entre comillas dobles.`;
      if (expected === "number") return `Falta valor para "${key}". Debes agregar un número válido (sin comillas).`;
      return `Falta valor para "${key}". Agrega un valor válido.`;
    }
    if (isBareWordStart(ch)) {
      if (expected === "string") return `El valor de "${key}" debe ir entre comillas dobles.`;
      if (expected === "number") return `El valor de "${key}" debe ser numérico (ej. 120.5), no texto.`;
      return `El valor de "${key}" parece no estar entre comillas.`;
    }
    if (isDigitLike(ch) && expected === "string") {
      return `El campo "${key}" espera una cadena; coloca el valor entre comillas dobles.`;
    }
  }

  return "Revisa comillas, comas y llaves cercanas a la posición indicada.";
}

/* ============ Recolecta TODAS las incidencias frecuentes en un JSON mal formado ============ */
function collectJsonSyntaxIssues(raw: string, req: Request): string[] {
  const issues: string[] = [];
  const pushOnce = (msg: string) => { if (!issues.includes(msg)) issues.push(msg); };

  // Globales
  if (raw.includes("'")) pushOnce("Usa comillas dobles (\") para cadenas; no se permiten comillas simples (').");
  if (containsComments(raw)) pushOnce("No se permiten comentarios (// o /* */).");
  if (containsTabs(raw)) pushOnce("Evita usar tabs (usa espacios).");
  if (hasBOM(raw)) pushOnce("Se detectó un BOM al inicio del archivo.");
  if (containsControlChars(raw)) pushOnce("Hay caracteres de control no permitidos.");

  // 🔎 0) Valores explícitos null por campo (para /productos: string/number no aceptan null)
  {
    const re = /"([^"\\]+)"\s*:\s*null\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      const key = m[1];
      const expected = guessExpectedType(req, key);
      if (expected === "string" || expected === "number") {
        pushOnce(`El campo '${key}' no puede ser nulo.`);
      } else {
        pushOnce(`No se permite null en '${key}'.`);
      }
    }
  }

  // 1) Valor faltante: "key": ,
  {
    const re = /"([^"\\]+)"\s*:\s*,/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      const key = m[1];
      const expected = guessExpectedType(req, key);
      if (expected === "string") pushOnce(`Falta valor para "${key}". Es obligatorio agregar un dato entre comillas dobles.`);
      else if (expected === "number") pushOnce(`Falta valor para "${key}". Debes agregar un número válido (sin comillas).`);
      else pushOnce(`Falta valor para "${key}".`);
    }
  }

  // 2) Valor faltante antes de cerrar: "key":   }  o   ]
  {
    const re = /"([^"\\]+)"\s*:\s*(?=[}\]])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      const key = m[1];
      const expected = guessExpectedType(req, key);
      if (expected === "string") pushOnce(`Falta valor para "${key}". Es obligatorio agregar un dato entre comillas dobles.`);
      else if (expected === "number") pushOnce(`Falta valor para "${key}". Debes agregar un número válido (sin comillas).`);
      else pushOnce(`Falta valor para "${key}".`);
    }
  }

  // 3) Falta valor porque aparece la siguiente clave: "key":   "otraClave":
  {
    const re = /"([^"\\]+)"\s*:\s*(?=\s*"[^"\\]+"\s*:)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      const key = m[1];
      const expected = guessExpectedType(req, key);
      if (expected === "string") pushOnce(`Falta valor para "${key}". Es obligatorio agregar un dato entre comillas dobles.`);
      else if (expected === "number") pushOnce(`Falta valor para "${key}". Debes agregar un número válido (sin comillas).`);
      else pushOnce(`Falta valor para "${key}".`);
    }
  }

  // 4) Coma sobrante antes de cerrar
  {
    const re = /,\s*[}\]]/g;
    if (re.test(raw)) pushOnce("Coma sobrante antes de cerrar el objeto/arreglo.");
  }

  return issues;
}

function buildJsonSyntaxMessage(req: Request, err: any) {
  const raw = (req as any).rawBody ?? "";
  let pos = -1;
  let forcedKey: string | undefined;

  const m = /position\s+(\d+)/i.exec(err?.message || "");
  pos = m ? Math.max(0, parseInt(m[1], 10) || 0) : -1;

  if ((pos < 0 || Number.isNaN(pos)) && raw) {
    const h = findHeuristicPositionAndKey(raw);
    if (h) { pos = h.pos; forcedKey = h.key; }
  }

  // Recolectamos múltiples issues; si hay varias, las devolvemos juntas
  if (raw) {
    const aggregated = collectJsonSyntaxIssues(raw, req);
    if (aggregated.length) return "JSON inválido: " + aggregated.join(" | ");
  }

  if (pos >= 0 && raw) {
    const { line, col } = posToLineCol(raw, pos);
    const hint = inferHint(raw, pos, req, forcedKey);
    if (hint) return `JSON inválido: ${hint}`;
    return `JSON inválido: error de sintaxis cerca de la línea ${line}, columna ${col}.`;
  }
  return "JSON inválido.";
}

/* ======================= Seguridad: body scanner ======================= */

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
function scanForbiddenKeys(obj: unknown, path: string[] = []): string[] {
  const issues: string[] = [];
  if (!obj || typeof obj !== "object") return issues;

  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(k)) {
      issues.push(`${[...path, k].join(".")} → clave no permitida`);
      continue;
    }
    if (v && typeof v === "object") {
      issues.push(...scanForbiddenKeys(v, [...path, k]));
    }
  }
  return issues;
}

/* ======================= Middlewares ======================= */

/** Handler sintaxis JSON (debe ir tras express.json) — SOLO {codigo, mensaje} */
export function jsonSyntaxErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    const mensaje = buildJsonSyntaxMessage(req, err);
    return res.status(400).json({ codigo: AppCode.VALIDATION_FAILED, mensaje });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      codigo: AppCode.VALIDATION_FAILED,
      mensaje: "El cuerpo de la petición excede el tamaño máximo permitido.",
    });
  }
  return next(err);
}

/** Pre-validador del cuerpo ya parseado (seguridad / higiene) — SOLO {codigo, mensaje} */
export function bodyHygieneGuard(req: Request, res: Response, next: NextFunction) {
  const methodHasBody = req.method === "POST" || req.method === "PUT" || req.method === "PATCH";
  if (methodHasBody && (req.body === undefined || req.body === null)) {
    return res.status(400).json({
      codigo: AppCode.VALIDATION_FAILED,
      mensaje: "Cuerpo JSON requerido.",
    });
  }
  const issues = scanForbiddenKeys(req.body);
  if (issues.length) {
    return res.status(400).json({
      codigo: AppCode.VALIDATION_FAILED,
      mensaje: "Claves no permitidas en el JSON.",
    });
  }
  next();
}

/* ======================= 🎯 Zod → mensajes específicos (incluye null) ======================= */

function prettyIssueMessage(issue: ZodIssue): string {
  const code = (issue as any)?.code as string;
  const i: any = issue;
  const expected = i?.expected as string | undefined;
  const received = i?.received as string | undefined;

  switch (code) {
    case "invalid_type": {
      if (received === "undefined") return "Campo requerido";
      if (received === "null") {
        if (expected === "string")  return "No se permite null; debe ser una cadena entre comillas dobles (\"...\").";
        if (expected === "number")  return "No se permite null; debe ser un número.";
        if (expected === "boolean") return "No se permite null; debe ser verdadero o falso.";
        if (expected === "object")  return "No se permite null; debe ser un objeto.";
        if (expected === "array")   return "No se permite null; debe ser un arreglo.";
        return "No se permite null.";
      }
      if (expected && received) {
        if (expected === "string" && received === "number") return "Debe ser una cadena entre comillas dobles (\"...\"), no un número.";
        if (expected === "number" && received === "string") return "Debe ser un número (sin comillas).";
        return `Tipo de dato inválido (se esperaba ${expected}, se recibió ${received}).`;
      }
      return "Tipo de dato inválido";
    }
    case "too_small": {
      if (i.minimum != null) {
        if (i.type === "string") return i.exact ? `Debe tener exactamente ${i.minimum} caracteres` : `Debe tener al menos ${i.minimum} caracteres`;
        if (i.type === "array")  return i.exact ? `Debe incluir exactamente ${i.minimum} elementos` : `Debe incluir al menos ${i.minimum} elementos`;
        if (i.type === "number") return i.inclusive ? `Debe ser mayor o igual a ${i.minimum}` : `Debe ser mayor que ${i.minimum}`;
      }
      return "Valor demasiado pequeño";
    }
    case "too_big": {
      if (i.maximum != null) {
        if (i.type === "string") return `No debe exceder ${i.maximum} caracteres`;
        if (i.type === "array")  return `No debe exceder ${i.maximum} elementos`;
        if (i.type === "number") return i.inclusive ? `No debe ser mayor que ${i.maximum}` : `Debe ser menor que ${i.maximum}`;
      }
      return "Valor demasiado grande";
    }
    case "not_multiple_of": return "El número no es un múltiplo permitido";
    case "invalid_string":
    case "invalid_format": {
      const v = i.validation;
      if (v === "email") return "Formato de email inválido";
      if (v === "url") return "URL inválida";
      if (v === "uuid") return "UUID inválido";
      if (v === "regex") return "Formato inválido";
      if (v === "datetime") return "Fecha/hora inválida";
      return "Cadena inválida";
    }
    case "invalid_enum_value":
    case "invalid_value": return "Valor no permitido";
    case "unrecognized_keys":
    case "invalid_key": return "Campos no permitidos";
    case "invalid_union": return "Ninguna de las variantes es válida";
    case "invalid_union_discriminator": return "Discriminador de unión inválido";
    case "invalid_literal": return "Valor literal inválido";
    case "invalid_date": return "Fecha inválida";
    case "custom": return i?.message || "Valor inválido";
    default: return i?.message || "Valor inválido";
  }
}

/** Obtiene el valor original del body para un path "a.b.c" */
function getValueAtPath(obj: any, path: string): unknown {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, k) => (acc != null ? (acc as any)[k] : undefined), obj);
}

/** Adaptador Zod → responde SOLO {codigo, mensaje} (prioriza null/required y muestra uno) */
export function zodErrorToStd(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    const isTopLevel = (k: unknown) => k === "body" || k === "query" || k === "params";

    for (const issue of err.issues) {
      const p = issue.path;
      const msg = prettyIssueMessage(issue);
      const key = (!p || p.length === 0)
        ? ""
        : isTopLevel(p[0]) ? (p.slice(1).join(".") || String(p[0])) : p.join(".");
      if (key) (fieldErrors[key] ??= []).push(msg);
    }

    // 1) Si algún campo viene nulo en el body, devolver mensaje específico
    for (const [k] of Object.entries(fieldErrors)) {
      const val = getValueAtPath(req.body, k);
      if (val === null) {
        return res.status(400).json({
          codigo: AppCode.VALIDATION_FAILED,
          mensaje: `El campo '${k}' no puede ser nulo.`
        });
      }
    }

    // 2) Si falta algún campo requerido
    for (const [k, arr] of Object.entries(fieldErrors)) {
      if (arr.some(m => /Campo requerido/i.test(m))) {
        return res.status(400).json({
          codigo: AppCode.VALIDATION_FAILED,
          mensaje: `El campo '${k}' es obligatorio.`
        });
      }
    }

    // 3) Primer mensaje disponible (simple y directo)
    for (const [k, arr] of Object.entries(fieldErrors)) {
      if (arr.length) {
        return res.status(400).json({
          codigo: AppCode.VALIDATION_FAILED,
          mensaje: `El campo '${k}': ${arr[0]}`
        });
      }
    }

    return res.status(400).json({
      codigo: AppCode.VALIDATION_FAILED,
      mensaje: "Validación fallida."
    });
  }

  // Si no es ZodError
  return res.status(500).json({
    codigo: AppCode.INTERNAL_ERROR,
    mensaje: "Error interno."
  });
}
