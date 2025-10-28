import { z } from "zod";

/* ===========================================================
   🧰 Utilidades
   =========================================================== */

export const collapseSpaces = (s: string) => s.replace(/\s+/g, " ");

/* ===========================================================
   🔒 HTML/JS (rechazo) — sin regex costosas
   =========================================================== */

/** Detecta contenido “tipo HTML” o &lt;/&gt; con escaneo lineal O(n). */
export function hasHtmlLike(s: string): boolean {
  const t = s.toLowerCase();
  if (t.includes("&lt;") || t.includes("&gt;")) return true;

  // Busca cualquier '<' seguido de letra, '/', '!' o '?' y un '>' después.
  for (let i = s.indexOf("<"); i !== -1; i = s.indexOf("<", i + 1)) {
    const next = s[i + 1];
    if (next == null) return true; // '<' al final → sospechoso
    if (
      (next >= "a" && next <= "z") ||
      (next >= "A" && next <= "Z") ||
      next === "/" ||
      next === "!" ||
      next === "?"
    ) {
      const close = s.indexOf(">", i + 2);
      if (close !== -1) return true; // hay un cierre
      return true; // sin cierre: lo tratamos como HTML igual
    }
  }
  return false;
}

/** Palabras/atributos peligrosos típicos (sin regex, lineal). */
export function hasRiskyJs(s: string): boolean {
  const t = s.toLowerCase();
  if (t.includes("javascript:")) return true;
  const attrs = ["onerror", "onload", "onclick", "onmouseover"];
  for (const a of attrs) if (t.includes(a)) return true;
  return false;
}

export const noHtmlJs = (campo: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string()
      .refine((v) => !(hasHtmlLike(v) || hasRiskyJs(v)), {
        message: `${campo} → Contenido potencialmente peligroso (HTML/JS no permitido)`,
      })
  );

/* ===========================================================
   🔡 Cadenas
   =========================================================== */

/** Cadena recortada no vacía con límites de longitud. */
export const nonEmptyTrimmed = (min: number, max: number, campo: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v as string).trim() : v),
    z
      .string()
      .min(1, { message: `${campo} → Campo requerido` })
      .min(min, { message: `${campo} → Debe tener al menos ${min} caracteres` })
      .max(max, { message: `${campo} → No debe exceder ${max} caracteres` })
  );

/** Evita floods “aaaaaaaaa” o “1111111” (≥ 5 repeticiones). */
export const noFlood = (campo: string) =>
  z
    .string()
    .refine((v) => !/(.)\1{4,}/.test(v), {
      message: `${campo} → Contenido ambiguo o repetitivo`,
    });

/** Texto “seguro”: no vacío, límites y sin HTML/JS. */
export const safeText = (campo: string, min: number, max: number) =>
  z
    .preprocess(
      (v) => (typeof v === "string" ? collapseSpaces((v as string).trim()) : v),
      z
        .string()
        .min(1, { message: `${campo} → Campo requerido` })
        .min(min, { message: `${campo} → Debe tener al menos ${min} caracteres` })
        .max(max, { message: `${campo} → No debe exceder ${max} caracteres` })
    )
    .and(noHtmlJs(campo))
    .and(noFlood(campo));

/* ===========================================================
   🔢 Números
   =========================================================== */

/** Evita -0 exactamente y exige ≥ 0 (coerce). */
export const nonNegativeNoMinusZero = (campo: string) =>
  z
    .coerce.number()
    .refine((n) => Number.isFinite(n), { message: `${campo} → Debe ser un número finito` })
    .refine((n) => n >= 0, { message: `${campo} → Debe ser ≥ 0` })
    .refine((n) => !Object.is(n, -0), { message: `${campo} → Valor inválido (-0)` });

/** Entero no negativo con tope razonable. */
export const nonNegativeInt = (campo: string, max = 100_000_000) =>
  z
    .coerce.number()
    .refine((n) => Number.isFinite(n), { message: `${campo} → Debe ser un número finito` })
    .int({ message: `${campo} → Debe ser entero` })
    .refine((n) => n >= 0, { message: `${campo} → Debe ser ≥ 0` })
    .refine((n) => n <= max, { message: `${campo} → No debe exceder ${max}` });

/** Dinero > 0, máx 2 decimales y tope. */
export const positiveMoney = (campo: string, max = 1_000_000) =>
  z
    .coerce.number()
    .refine((n) => Number.isFinite(n), { message: `${campo} → Debe ser un número finito` })
    .refine((v) => v > 0, { message: `${campo} → Debe ser mayor a 0` })
    .refine((v) => Math.round(v * 100) === v * 100, {
      message: `${campo} → Máximo 2 decimales`,
    })
    .refine((v) => v <= max, { message: `${campo} → No debe exceder ${max}` });

/* ===========================================================
   🏷️ Campos específicos (unidad, categoría, clave, teléfono)
   =========================================================== */

/** Unidad controlada: letras (con acentos), números, espacios, punto o %; largo 1–30. */
export const alphaUnidad = z.preprocess(
  (v) => (typeof v === "string" ? collapseSpaces((v as string).trim()) : v),
  z
    .string()
    .min(1, { message: "unidad → Campo requerido" })
    .max(30, { message: "unidad → Máximo 30 caracteres" })
    .regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ./%-]+$/, {
      message: "unidad → Solo letras/números/espacios/./%/-",
    })
    .refine(
      (v) =>
        [
          "pieza",
          "paquete",
          "caja",
          "bolsa",
          "botella",
          "kg",
          "g",
          "l",
          "ml",
          "m",
          "cm",
          "servicio",
        ].includes(v.toLowerCase()) || v.length >= 2,
      { message: "unidad → Usa una unidad válida (p. ej., pieza, kg, l) o un texto claro" }
    )
);

/** Categoría alfanumérica simple con separadores comunes; 1–60. */
export const alphaCategoria = z.preprocess(
  (v) => (typeof v === "string" ? collapseSpaces((v as string).trim()) : v),
  z
    .string()
    .min(1, { message: "categoria → Campo requerido" })
    .max(60, { message: "categoria → Máximo 60 caracteres" })
    .regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,&/()-]+$/, {
      message: "categoria → Caracteres inválidos",
    })
);

/**
 * CLAVE estricta:
 * - Solo [A-Za-z0-9-]
 * - Sin guiones al inicio/fin
 * - Sin “--”
 * - Longitud ≤ maxLen (por defecto 10)
 */
export const claveStrict = (campo = "clave", maxLen = 10) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v as string).trim() : v),
    z
      .string()
      .min(1, { message: `${campo} → Requerida` })
      .max(maxLen, { message: `${campo} → Máximo ${maxLen} caracteres` })
      .regex(/^[A-Za-z0-9-]+$/, {
        message: `${campo} → Solo letras, números y guiones (-)`,
      })
      .refine((v) => !/^-|-$/.test(v), {
        message: `${campo} → No puede iniciar/terminar con guion`,
      })
      .refine((v) => !/--/.test(v), {
        message: `${campo} → No se permiten guiones consecutivos`,
      })
      .refine((v) => !/(.)\1{4,}/.test(v), {
        message: `${campo} → Contenido ambiguo o repetitivo`,
      })
  );

/** Teléfono: exactamente 10–11 dígitos (se eliminan símbolos y espacios). */
export const telefonoSoloDigitos = z
  .string()
  .transform((v: string) => (v ?? "").replace(/\D/g, ""))
  .refine((v) => v.length === 0 || (v.length >= 10 && v.length <= 11), {
    message: "telefono → Debe contener 10 a 11 dígitos",
  });
