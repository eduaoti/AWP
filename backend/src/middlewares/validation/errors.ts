// backend/src/middlewares/validation/errors.ts
import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppCode } from "../../status/codes";

/* ======================= Helpers JSON syntax / raw body ======================= */
function posToLineCol(text: string, pos: number) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < text.length && i < pos; i++) {
    if (text[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

function hasBOM(raw: string) {
  return raw.length > 0 && (raw.codePointAt(0) ?? -1) === 0xfeff;
}
function containsTabs(raw: string) {
  return raw.includes("\t");
}

// Detección de comentarios “// …” sin regex complejas (evita hotspots)
function containsLineComments(raw: string) {
  // Busca “//” y verifica que antes en la misma línea solo haya espacios, {, , o [
  for (let i = 0; i < raw.length - 1; i++) {
    if (raw[i] === "/" && raw[i + 1] === "/") {
      let j = i - 1;
      while (j >= 0 && raw[j] !== "\n" && /\s/.test(raw[j])) j--;
      if (j < 0 || raw[j] === "\n" || raw[j] === "{" || raw[j] === "," || raw[j] === "[") {
        return true;
      }
    }
  }
  return false;
}

// Comentarios tipo /* ... */ (lineal, sin backtracking ni while(true))
function containsBlockComments(raw: string) {
  for (let i = raw.indexOf("/*"); i !== -1; i = raw.indexOf("/*", i + 2)) {
    const close = raw.indexOf("*/", i + 2);
    if (close !== -1) return true;   // hay al menos un bloque bien formado
    break;                            // no hay cierre: dejamos de buscar
  }
  return false;
}

function containsComments(raw: string) {
  return containsLineComments(raw) || containsBlockComments(raw);
}

// Evita incluir caracteres de control literales: usa \uXXXX
const CONTROL_CHARS_RE = new RegExp(
  // [\x00-\x08\x0B\x0C\x0E-\x1F] pero sin literales de control en el source
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]"
);

function containsControlChars(raw: string) {
  return CONTROL_CHARS_RE.test(raw);
}

/** Campos esperados en POST /productos (para sugerir tipo cuando falta valor) */
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
function isBareWordStart(ch?: string) {
  return !!ch && /[A-Za-z_\p{L}]/u.test(ch);
}
function isDigitLike(ch?: string) {
  return !!ch && /[0-9-]/.test(ch);
}
function guessExpectedType(
  req: Request,
  field?: string
): "string" | "number" | undefined {
  if (!field) return undefined;
  if (req.method === "POST" && req.path === "/productos") {
    return PRODUCTOS_CREATE_EXPECTED[field];
  }
  return undefined;
}

/* ---------- inferHint: bajar complejidad separando checks ---------- */
function basicFormatIssues(raw: string): string | undefined {
  if (containsComments(raw)) return "Se detectaron comentarios. El JSON no admite // ni /* */.";
  if (containsTabs(raw)) return String.raw`Se detectaron tabs. Usa espacios; evita '\t'.`;
  if (hasBOM(raw)) return "Se detectó BOM al inicio del JSON. Elimínalo.";
  if (raw.includes("'"))
    return 'Usa comillas dobles (") para cadenas; no se permiten comillas simples (\').';
  if (containsControlChars(raw)) return "Hay caracteres de control no permitidos.";
  return undefined;
}
function missingOrWrongTypeForKey(
  key: string,
  ch: string | undefined,
  expected?: "string" | "number"
): string | undefined {
  if (ch === "," || ch === "}" || ch === "]" || ch === undefined) {
    if (expected === "string")
      return `Falta valor para "${key}". Es obligatorio agregar un dato entre comillas dobles.`;
    if (expected === "number")
      return `Falta valor para "${key}". Debes agregar un número válido (sin comillas).`;
    return `Falta valor para "${key}". Agrega un valor válido.`;
  }
  if (isBareWordStart(ch)) {
    if (expected === "string") return `El valor de "${key}" debe ir entre comillas dobles.`;
    if (expected === "number")
      return `El valor de "${key}" debe ser numérico (ej. 120.5), no texto.`;
    return `El valor de "${key}" parece no estar entre comillas.`;
  }
  if (isDigitLike(ch) && expected === "string") {
    return `El campo "${key}" espera una cadena; coloca el valor entre comillas dobles.`;
  }
  return undefined;
}

function inferHint(raw: string, pos: number, req: Request, forcedKey?: string) {
  const basic = basicFormatIssues(raw);
  if (basic) return basic;

  const { ch } = nextNonWsChar(raw, pos);
  const key = forcedKey || findNearestKeyBefore(raw, pos);
  if (key) {
    const expected = guessExpectedType(req, key);
    const msg = missingOrWrongTypeForKey(key, ch, expected);
    if (msg) return msg;
  }
  return "Revisa comillas, comas y llaves cercanas a la posición indicada.";
}

/* ====== Heurística para cuando el parser no entrega “position N” (sin lookaheads pesados) ====== */
function skipWs(s: string, i: number) {
  while (i < s.length && /\s/.test(s[i])) i++;
  return i;
}
function findClosingQuote(s: string, from: number) {
  let i = from + 1;
  let esc = false;
  for (; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') return i;
  }
  return -1;
}

export function findHeuristicPositionAndKey(
  raw: string
): { pos: number; key?: string } | null {
  // 1) "key": ,
  {
    const re = /"([^"\\]+)"\s*:\s*,/g;
    const m = re.exec(raw);
    if (m) {
      const commaIndex = m.index + m[0].lastIndexOf(",");
      return { pos: commaIndex, key: m[1] };
    }
  }
  // 2) "key":   }  o   ]
  {
    const re = /"([^"\\]+)"\s*:\s*/g; // sin lookahead
    const m = re.exec(raw);
    if (m) {
      let i = skipWs(raw, re.lastIndex);
      const ch = raw[i];
      if (ch === "}" || ch === "]") {
        return { pos: i, key: m[1] };
      }
    }
  }
  // 3) "key":   "otraClave":
  {
    const re = /"([^"\\]+)"\s*:\s*/g; // detecta "key":
    const m = re.exec(raw);
    if (m) {
      let i = skipWs(raw, re.lastIndex);
      if (raw[i] === '"') {
        const end = findClosingQuote(raw, i);
        if (end !== -1) {
          let j = skipWs(raw, end + 1);
          if (raw[j] === ":") {
            return { pos: i, key: m[1] };
          }
        }
      }
    }
  }
  // 4) Coma sobrante antes de cerrar
  {
    const re = /,\s*[}\]]/g;
    const m = re.exec(raw);
    if (m) return { pos: m.index, key: undefined };
  }
  return null;
}

/* ============ Recolector de incidencias JSON (sin lookaheads pesados) ============ */
function pushMissingValueMessage(
  issues: string[],
  key: string,
  expected?: "string" | "number"
) {
  let msg = `Falta valor para "${key}".`;
  if (expected === "string") {
    msg = `Falta valor para "${key}". Es obligatorio agregar un dato entre comillas dobles.`;
  } else if (expected === "number") {
    msg = `Falta valor para "${key}". Debes agregar un número válido (sin comillas).`;
  }
  if (!issues.includes(msg)) issues.push(msg);
}

function collectJsonSyntaxIssues(raw: string, req: Request): string[] {
  const issues: string[] = [];
  const pushOnce = (msg: string) => {
    if (!issues.includes(msg)) issues.push(msg);
  };

  // Globales
  if (raw.includes("'"))
    pushOnce('Usa comillas dobles (") para cadenas; no se permiten comillas simples (\').');
  if (containsComments(raw)) pushOnce("No se permiten comentarios (// o /* */).");
  if (containsTabs(raw)) pushOnce(String.raw`Evita usar tabs (usa espacios).`);
  if (hasBOM(raw)) pushOnce("Se detectó un BOM al inicio del archivo.");
  if (containsControlChars(raw)) pushOnce("Hay caracteres de control no permitidos.");

  // 0) null explícito por campo
  {
    const re = /"([^"\\]+)"\s*:\s*null\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      const key = m[1];
      const expected = guessExpectedType(req, key);
      const msg =
        expected === "string" || expected === "number"
          ? `El campo '${key}' no puede ser nulo.`
          : `No se permite null en '${key}'.`;
      pushOnce(msg);
    }
  }
  // 1) "key": ,
  {
    const re = /"([^"\\]+)"\s*:\s*,/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      pushMissingValueMessage(issues, m[1], guessExpectedType(req, m[1]));
    }
  }
  // 2) "key":   }  o   ]
  {
    const re = /"([^"\\]+)"\s*:\s*/g; // sin lookahead
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      let i = skipWs(raw, re.lastIndex);
      const ch = raw[i];
      if (ch === "}" || ch === "]") {
        pushMissingValueMessage(issues, m[1], guessExpectedType(req, m[1]));
      }
    }
  }
  // 3) "key":   "otraClave":
  {
    const re = /"([^"\\]+)"\s*:\s*/g; // sin lookahead
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      let i = skipWs(raw, re.lastIndex);
      if (raw[i] === '"') {
        const end = findClosingQuote(raw, i);
        if (end !== -1) {
          let j = skipWs(raw, end + 1);
          if (raw[j] === ":") {
            pushMissingValueMessage(issues, m[1], guessExpectedType(req, m[1]));
          }
        }
      }
    }
  }
  // 4) Coma sobrante antes de cerrar
  if (/,(\s)*[}\]]/g.test(raw)) pushOnce("Coma sobrante antes de cerrar el objeto/arreglo.");

  return issues;
}

function buildJsonSyntaxMessage(req: Request, err: unknown) {
  const raw = (req as any).rawBody ?? "";
  let pos = -1;
  let forcedKey: string | undefined;
  const text = (err as { message?: string })?.message ?? "";
  const m = /position\s+(\d+)/i.exec(text);
  pos = m ? Math.max(0, Number.parseInt(m[1], 10) || 0) : -1;

  if ((pos < 0 || Number.isNaN(pos)) && raw) {
    const h = findHeuristicPositionAndKey(raw);
    if (h) {
      pos = h.pos;
      forcedKey = h.key;
    }
  }

  const aggregated = raw ? collectJsonSyntaxIssues(raw, req) : [];
  if (aggregated.length) return "JSON inválido: " + aggregated.join(" | ");

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
export function jsonSyntaxErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const anyErr = err as { type?: string };
  if (anyErr?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    const mensaje = buildJsonSyntaxMessage(req, err);
    return res.status(400).json({ codigo: AppCode.VALIDATION_FAILED, mensaje });
  }
  if (anyErr?.type === "entity.too.large") {
    return res.status(413).json({
      codigo: AppCode.VALIDATION_FAILED,
      mensaje: "El cuerpo de la petición excede el tamaño máximo permitido.",
    });
  }
  return next(err);
}

export function bodyHygieneGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const methodHasBody =
    req.method === "POST" || req.method === "PUT" || req.method === "PATCH";
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

/* ======================= Zod → mensajes ======================= */
type IssueLike = {
  code?: string;
  path?: Array<string | number>;
  message?: string;
  expected?: string;
  received?: string;
  type?: string;
  minimum?: number;
  maximum?: number;
  inclusive?: boolean;
  exact?: boolean;
  validation?: string;
};

/* ---- messageInvalidType (refactor por ramas pequeñas) ---- */
function messageInvalidType(i: IssueLike) {
  const { expected, received } = i;

  if (received === "undefined") return "Campo requerido";

  if (received === "null") {
    const byExp: Record<string, string> = {
      string: 'No se permite null; debe ser una cadena entre comillas dobles ("...").',
      number: "No se permite null; debe ser un número.",
      boolean: "No se permite null; debe ser verdadero o falso.",
      object: "No se permite null; debe ser un objeto.",
      array: "No se permite null; debe ser un arreglo.",
    };
    return byExp[expected ?? ""] || "No se permite null.";
  }

  if (expected && received) {
    if (expected === "string" && received === "number")
      return 'Debe ser una cadena entre comillas dobles ("..."), no un número.';
    if (expected === "number" && received === "string")
      return "Debe ser un número (sin comillas).";
    return `Tipo de dato inválido (se esperaba ${expected}, se recibió ${received}).`;
  }

  return "Tipo de dato inválido";
}

/* ---- messageRange (refactor por tablas) ---- */
function messageRange(i: IssueLike) {
  const { minimum, maximum, type, inclusive, exact } = i;

  if (minimum != null) {
    const minMsgs: Record<string, string> = {
      string: exact ? `Debe tener exactamente ${minimum} caracteres` : `Debe tener al menos ${minimum} caracteres`,
      array: exact ? `Debe incluir exactamente ${minimum} elementos` : `Debe incluir al menos ${minimum} elementos`,
      number: inclusive ? `Debe ser mayor o igual a ${minimum}` : `Debe ser mayor que ${minimum}`,
    };
    return minMsgs[type ?? ""] as string | undefined;
  }

  if (maximum != null) {
    const maxMsgs: Record<string, string> = {
      string: `No debe exceder ${maximum} caracteres`,
      array: `No debe exceder ${maximum} elementos`,
      number: inclusive ? `No debe ser mayor que ${maximum}` : `Debe ser menor que ${maximum}`,
    };
    return maxMsgs[type ?? ""] as string | undefined;
  }

  return undefined;
}

function messageByValidation(validation?: string) {
  if (validation === "email") return "Formato de email inválido";
  if (validation === "url") return "URL inválida";
  if (validation === "uuid") return "UUID inválido";
  if (validation === "regex") return "Formato inválido";
  if (validation === "datetime") return "Fecha/hora inválida";
  return "Cadena inválida";
}

function prettyIssueMessage(issue: IssueLike): string {
  const code = issue.code ?? "";
  if (code === "invalid_type") return messageInvalidType(issue);
  if (code === "too_small" || code === "too_big") {
    const msg = messageRange(issue);
    return msg ?? (code === "too_small" ? "Valor demasiado pequeño" : "Valor demasiado grande");
  }
  if (code === "not_multiple_of") return "El número no es un múltiplo permitido";
  if (code === "invalid_string" || code === "invalid_format") return messageByValidation(issue.validation);
  if (code === "invalid_enum_value" || code === "invalid_value") return "Valor no permitido";
  if (code === "unrecognized_keys" || code === "invalid_key") return "Campos no permitidos";
  if (code === "invalid_union") return "Ninguna de las variantes es válida";
  if (code === "invalid_union_discriminator") return "Discriminador de unión inválido";
  if (code === "invalid_literal") return "Valor literal inválido";
  if (code === "invalid_date") return "Fecha inválida";
  return issue.message || "Valor inválido";
}

function computeIssueKey(p?: Array<string | number>) {
  if (!p || p.length === 0) return "";
  if (p[0] === "body" || p[0] === "query" || p[0] === "params") {
    const rest = p.slice(1).join(".");
    return rest || String(p[0]);
  }
  return p.join(".");
}

/** Obtiene el valor original del body para un path "a.b.c" */
function getValueAtPath(obj: unknown, path: string): unknown {
  if (!obj || !path) return undefined;
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[k];
  }, obj);
}

/* ---- zodErrorToStd: reducir complejidad, early-returns ---- */
function firstNullField(fieldErrors: Map<string, string[]>, body: unknown): string | undefined {
  for (const k of fieldErrors.keys()) {
    if (getValueAtPath(body, k) === null) return k;
  }
  return undefined;
}
function firstRequiredField(fieldErrors: Map<string, string[]>): string | undefined {
  for (const [k, arr] of fieldErrors.entries()) {
    if (arr.some((m) => /Campo requerido/i.test(m))) return k;
  }
  return undefined;
}
function firstFieldWithMessage(fieldErrors: Map<string, string[]>): { k: string; m: string } | undefined {
  for (const [k, arr] of fieldErrors.entries()) {
    if (arr.length) return { k, m: arr[0] };
  }
  return undefined;
}

export function zodErrorToStd(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (!(err instanceof ZodError)) {
    return res.status(500).json({ codigo: AppCode.INTERNAL_ERROR, mensaje: "Error interno." });
  }

  const fieldErrors = new Map<string, string[]>();
  for (const rawIssue of (err.issues as unknown as IssueLike[])) {
    const key = computeIssueKey(rawIssue.path);
    if (!key) continue;
    const arr = fieldErrors.get(key) ?? [];
    arr.push(prettyIssueMessage(rawIssue));
    fieldErrors.set(key, arr);
  }

  const nullField = firstNullField(fieldErrors, req.body);
  if (nullField) {
    return res.status(400).json({
      codigo: AppCode.VALIDATION_FAILED,
      mensaje: `El campo '${nullField}' no puede ser nulo.`,
    });
  }

  const reqField = firstRequiredField(fieldErrors);
  if (reqField) {
    return res.status(400).json({
      codigo: AppCode.VALIDATION_FAILED,
      mensaje: `El campo '${reqField}' es obligatorio.`,
    });
  }

  const firstMsg = firstFieldWithMessage(fieldErrors);
  if (firstMsg) {
    return res.status(400).json({
      codigo: AppCode.VALIDATION_FAILED,
      mensaje: `El campo '${firstMsg.k}': ${firstMsg.m}`,
    });
  }

  return res.status(400).json({
    codigo: AppCode.VALIDATION_FAILED,
    mensaje: "Validación fallida.",
  });
}
