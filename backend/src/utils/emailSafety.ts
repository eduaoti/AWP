// src/utils/emailSafety.ts
import * as punycode from "punycode";

/** Proveedores comunes (para detectar typos por distancia de edición) */
const COMMON_PROVIDERS = [
  "gmail.com", "outlook.com", "hotmail.com", "yahoo.com",
  "icloud.com", "proton.me", "live.com", "msn.com",
  "protonmail.com", "aol.com", "gmx.com", "ymail.com"
];

/** Conjunto para chequear rápido si el dominio ya es “bien conocido” */
const WELL_KNOWN = new Set(COMMON_PROVIDERS);

/** Mapa de typos frecuentes => sugerencia correcta (estos sí pueden ser “errores”) */
const TYPO_MAP: Record<string, string> = {
  // Gmail
  "gmal.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  // Hotmail / Outlook
  "hotnail.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  // Yahoo
  "yaho.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  // Proton
  "proton.com": "proton.me"
};

/** Lista (ejemplo) de dominios desechables/temporales */
const DISPOSABLE_DOMAINS = new Set<string>([
  "mailinator.com", "10minutemail.com", "guerrillamail.com",
  "yopmail.com", "trashmail.com", "tempmail.dev",
  "getnada.com", "tempmailo.com", "fakeinbox.com"
]);

/** TLDs no permitidas por política (opcional) */
const FORBIDDEN_TLDS = new Set<string>([
  "zip", "mov"
]);

function isAscii(s: string) { return /^[\x00-\x7F]*$/.test(s); }
function hasConsecutiveDots(s: string) { return s.includes(".."); }
function hasLeadingTrailingDot(s: string) { return s.startsWith(".") || s.endsWith("."); }
function hasIllegalLocalChars(s: string) {
  // Subconjunto práctico de RFC 5322 para casos problemáticos en la parte local
  return /[^\w!#$%&'*+/=?`{|}~.^-]/i.test(s);
}
function startsOrEndsWithHyphen(label: string) {
  return label.startsWith("-") || label.endsWith("-");
}
function hasUnderscore(label: string) {
  return label.includes("_");
}
function baseDomain(domain: string) {
  // Regresa los últimos 2 labels (e.g., sub.mailinator.com -> mailinator.com)
  const parts = domain.split(".").filter(Boolean);
  if (parts.length <= 2) return domain;
  return parts.slice(-2).join(".");
}

export type EmailSafetyResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** sugerencia de dominio cuando se detecta typo */
  suggestion?: string;
};

/**
 * Valida email con reglas endurecidas:
 * - Longitudes (total ≤ 254, local ≤ 64)
 * - Formato básico, puntos consecutivos, puntos al inicio/fin
 * - Caracteres ilegales en parte local
 * - Reglas de dominio (labels sin '_' y sin guion al inicio/fin)
 * - TLD válida y TLDs no permitidas (p. ej., .zip/.mov)
 * - Dominios desechables (considerando subdominios)
 * - Typos exactos del mapa (error) y distancia de edición 1 (solo warning)
 * - IDN/Punycode (aviso); convierte a ASCII para validar
 * - Subaddressing (+tag) → warning informativo
 */
export function checkEmailSafety(emailRaw: string): EmailSafetyResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let suggestion: string | undefined;

  const email = emailRaw.normalize("NFKC").trim().replace(/^"+|"+$/g, "");
  if (!email) return { ok: false, errors: ["Email vacío"], warnings: [] };

  if (email.length > 254) {
    return { ok: false, errors: ["Email demasiado largo (máx. 254)"], warnings: [] };
  }

  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1) {
    return {
      ok: false,
      errors: ["Formato email inválido: falta parte local o dominio"],
      warnings: [],
    };
  }

  const local = email.slice(0, at);
  let domain = email.slice(at + 1).toLowerCase();

  if (local.length > 64) {
    errors.push("Parte local demasiado larga (máx. 64)");
  }

  // Subaddressing (+tag) → útil, avisamos por si no era intencional
  if (/\+/.test(local)) {
    warnings.push("El email incluye etiqueta con '+'. Verifica que sea intencional.");
  }

  // IDN / Punycode
  if (!isAscii(domain)) {
    const ascii = punycode.toASCII(domain);
    domain = ascii;
    warnings.push("Dominio internacionalizado (IDN) convertido a ASCII");
  }
  if (domain.startsWith("xn--")) {
    warnings.push("Dominio con Punycode (posible homógrafo); revisar autenticidad");
  }

  // Reglas locales y dominio
  if (hasConsecutiveDots(local) || hasConsecutiveDots(domain)) {
    errors.push("No se permiten puntos consecutivos en email");
  }
  if (hasLeadingTrailingDot(local) || hasLeadingTrailingDot(domain)) {
    errors.push("No se permiten puntos al inicio/fin de las partes del email");
  }
  if (hasIllegalLocalChars(local)) {
    errors.push("Caracteres no permitidos en la parte local del email");
  }
  if (domain.length > 253) errors.push("Dominio demasiado largo");
  if (!/^[a-z0-9.-]+$/.test(domain)) {
    errors.push("Dominio con caracteres inválidos (solo a-z, 0-9, punto y guion)");
  }
  if (!domain.includes(".")) errors.push("Dominio sin TLD");

  const labels = domain.split(".");
  if (labels.some(l => !l || l.length > 63)) {
    errors.push("Etiqueta de dominio vacía o de longitud inválida");
  }
  if (labels.some(hasUnderscore)) {
    errors.push("El dominio no puede contener '_' en sus etiquetas");
  }
  if (labels.some(startsOrEndsWithHyphen)) {
    errors.push("Las etiquetas de dominio no pueden iniciar ni terminar con '-'");
  }

  const tld = labels[labels.length - 1];
  if (!tld || tld.length < 2) {
    errors.push("TLD inválida");
  } else if (FORBIDDEN_TLDS.has(tld)) {
    errors.push(`TLD .${tld} no permitida por política`);
  }

  // Desechables (considerar subdominios)
  const bdom = baseDomain(domain);
  if (DISPOSABLE_DOMAINS.has(domain) || DISPOSABLE_DOMAINS.has(bdom)) {
    errors.push("Dominio desechable/temporal no permitido");
  }

  // 1) Typos exactos del mapa → tratamos como ERROR
  if (TYPO_MAP[bdom]) {
    suggestion = TYPO_MAP[bdom];
    errors.push(`Dominio parece un typo; ¿quisiste decir ${suggestion}?`);
  } else {
    // 2) Distancia 1 contra proveedores comunes → SOLO WARNING
    //    y SOLO si NO es ya un dominio bien conocido.
    if (!WELL_KNOWN.has(bdom)) {
      for (const prov of COMMON_PROVIDERS) {
        if (levenshtein(bdom, prov) === 1) {
          suggestion = prov;
          warnings.push(`Dominio sospechoso; ¿quisiste decir ${prov}?`);
          break;
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, suggestion };
}

/** Distancia de Levenshtein (edición) */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}
