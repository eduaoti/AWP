// src/routes/estadisticas.routes.ts
import { Router } from "express";
import * as Stats from "../models/estadisticas.model";
import { z } from "zod";
import { ok, sendCode } from "../status/respond";
import { AppCode } from "../status/codes";

const r = Router();

/* ===========================================================
   Esquemas entrada (JSON-only) ultra estrictos
   =========================================================== */

const ISO_Z_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/; // UTC con Z

// Versión sin required_error (compatible con Zod antiguo)
const IsoStrictRequired = z
  .string()                                // requerido porque el objeto lo exige
  .trim()
  .min(1, "No puede estar vacío")          // mensaje si viene "" o solo espacios
  .regex(ISO_Z_REGEX, "Fecha inválida: usa ISO-8601 con Z (ej. 2025-01-01T00:00:00Z)")
  .transform((v) => new Date(v).toISOString());

/**
 * Rango estricto, ambos requeridos.
 * - futuro prohibido
 * - hasta > desde
 * - delta ≥ 1s
 * - rango ≤ 366 días
 */
const RangoFechasBody = z
  .object({
    desde: IsoStrictRequired,
    hasta: IsoStrictRequired,
  })
  .strict()
  .superRefine((val, ctx) => {
    const { desde, hasta } = val;
    const now = new Date().toISOString();

    // futuro NO permitido
    if (desde > now) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["desde"], message: "Rango inválido: 'desde' no puede ser futura" });
    }
    if (hasta > now) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["hasta"], message: "Rango inválido: 'hasta' no puede ser futura" });
    }

    // orden / tamaño
    if (hasta <= desde) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hasta"],
        message: "Rango inválido: 'hasta' debe ser mayor que 'desde' (modelo [desde, hasta))",
      });
    }
    const deltaMs = new Date(hasta).getTime() - new Date(desde).getTime();
    if (deltaMs < 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hasta"],
        message: "Rango inválido: la ventana debe ser de al menos 1 segundo",
      });
    }
    const dias = deltaMs / (1000 * 60 * 60 * 24);
    if (dias > 366) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hasta"],
        message: "Rango inválido: la ventana no debe exceder 366 días",
      });
    }
  });

const LimiteOpt = z
  .coerce.number()
  .int("limite → Debe ser entero")
  .positive("limite → Debe ser ≥ 1")
  .max(100000, "limite → Demasiado grande")
  .optional();

const TopOpt = z
  .coerce.number()
  .int("top → Debe ser entero")
  .positive("top → Debe ser ≥ 1")
  .max(100000, "top → Demasiado grande")
  .optional();

/* ===========================================================
   Rutas (POST JSON-only — app valida Content-Type 415)
   =========================================================== */

/** POST /estadisticas/ventas-producto */
r.post("/ventas-producto", async (req, res) => {
  try {
    const { desde, hasta } = RangoFechasBody.parse(req.body ?? {});
    const data = await Stats.ventasPorProducto(desde, hasta);
    return ok(req, res, data);
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, {
        message: e.issues?.map((i: any) => `${i.path?.join(".") || ""}: ${i.message}`).join("; ") || "Validación fallida",
      });
    }
    if (e?.status === 400 && e?.code === "RANGO_FECHAS_INVALIDO") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, { message: e.message, detalle: e.detail });
    }
    if (e?.status === 500 && e?.code === "DB_ERROR") {
      return sendCode(req, res, AppCode.DB_ERROR, null, { message: "Error de base de datos", detalle: e.detail });
    }
    return sendCode(req, res, AppCode.INTERNAL_ERROR, null, { message: "Error interno del servidor" });
  }
});

/** POST /estadisticas/productos-menor-venta */
r.post("/productos-menor-venta", async (req, res) => {
  try {
    const base = RangoFechasBody.extend({ limite: LimiteOpt });
    const { desde, hasta, limite } = base.parse(req.body ?? {});
    const data = await Stats.productosMenorVenta(desde, hasta, limite ?? 10);
    return ok(req, res, data);
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, {
        message: e.issues?.map((i: any) => `${i.path?.join(".") || ""}: ${i.message}`).join("; ") || "Validación fallida",
      });
    }
    if (e?.status === 400 && ["RANGO_FECHAS_INVALIDO", "PARAMETRO_INVALIDO"].includes(e?.code)) {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, { message: e.message, detalle: e.detail });
    }
    if (e?.status === 500 && e?.code === "DB_ERROR") {
      return sendCode(req, res, AppCode.DB_ERROR, null, { message: "Error de base de datos", detalle: e.detail });
    }
    return sendCode(req, res, AppCode.INTERNAL_ERROR, null, { message: "Error interno del servidor" });
  }
});

/** POST /estadisticas/productos-extremos */
r.post("/productos-extremos", async (req, res) => {
  try {
    const base = RangoFechasBody.extend({ top: TopOpt });
    const { desde, hasta, top } = base.parse(req.body ?? {});
    const data = await Stats.productosExtremos(desde, hasta, top ?? 10);
    return ok(req, res, data);
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, {
        message: e.issues?.map((i: any) => `${i.path?.join(".") || ""}: ${i.message}`).join("; ") || "Validación fallida",
      });
    }
    if (e?.status === 400 && ["RANGO_FECHAS_INVALIDO", "PARAMETRO_INVALIDO"].includes(e?.code)) {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, { message: e.message, detalle: e.detail });
    }
    if (e?.status === 500 && e?.code === "DB_ERROR") {
      return sendCode(req, res, AppCode.DB_ERROR, null, { message: "Error de base de datos", detalle: e.detail });
    }
    return sendCode(req, res, AppCode.INTERNAL_ERROR, null, { message: "Error interno del servidor" });
  }
});

export default r;
