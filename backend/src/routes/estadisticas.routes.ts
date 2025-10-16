// src/routes/estadisticas.routes.ts
import { Router } from "express";
import * as Stats from "../models/estadisticas.model";
import { z } from "zod";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import { requireJson } from "../middlewares/require-json";

const r = Router();

/* ===========================================================
   Esquemas de entrada (JSON-only) ultra estrictos
   =========================================================== */

const ISO_Z_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/; // UTC con Z

const IsoStrictRequired = z
  .string()
  .trim()
  .min(1, "No puede estar vacío")
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

    if (desde > now) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["desde"], message: "Rango inválido: 'desde' no puede ser futura" });
    }
    if (hasta > now) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["hasta"], message: "Rango inválido: 'hasta' no puede ser futura" });
    }
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
   Helpers de error (siempre HTTP 200)
   =========================================================== */

function zodFail(req: any, res: any, e: any) {
  const msg =
    e?.issues?.map((i: any) => `${i.path?.join(".") || ""}: ${i.message}`).join("; ") ||
    "Validación fallida";
  return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
    httpStatus: 200,
    message: msg,
  });
}

function handledAppError(req: any, res: any, e: any) {
  // Normaliza distintos códigos de error de modelo/DB a nuestro esquema minimal
  if (e?.status === 400 && ["RANGO_FECHAS_INVALIDO", "PARAMETRO_INVALIDO"].includes(e?.code)) {
    return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
      httpStatus: 200,
      message: e.message || "Validación fallida",
    });
  }
  if (e?.status === 500 && (e?.code === "DB_ERROR" || e?.code === "INTERNAL")) {
    return sendCode(req, res, AppCode.DB_ERROR, undefined, {
      httpStatus: 200,
      message: "Error de base de datos",
    });
  }
  return sendCode(req, res, AppCode.DB_ERROR, undefined, {
    httpStatus: 200,
    message: "Error interno del servidor",
  });
}

/* ===========================================================
   Rutas (POST JSON-only; requireJson asegura 415 si no es JSON)
   — En éxito DEVUELVEN data
   — En error responden 200 sin data
   =========================================================== */

/** POST /estadisticas/ventas-producto
 *  ✅ Devuelve data: Array<{ producto_id, clave, nombre, total_vendido }>
 */
r.post("/ventas-producto", requireJson, async (req, res) => {
  try {
    const { desde, hasta } = RangoFechasBody.parse(req.body ?? {});
    const data = await Stats.ventasPorProducto(desde, hasta);
    return sendCode(req, res, AppCode.OK, data, { httpStatus: 200, message: "OK" });
  } catch (e: any) {
    if (e?.name === "ZodError") return zodFail(req, res, e);
    return handledAppError(req, res, e);
  }
});

/** POST /estadisticas/productos-menor-venta
 *  ✅ Devuelve data: Array<{ producto_id, clave, nombre, total_vendido }>
 */
r.post("/productos-menor-venta", requireJson, async (req, res) => {
  try {
    const base = RangoFechasBody.extend({ limite: LimiteOpt });
    const { desde, hasta, limite } = base.parse(req.body ?? {});
    const data = await Stats.productosMenorVenta(desde, hasta, limite ?? 10);
    return sendCode(req, res, AppCode.OK, data, { httpStatus: 200, message: "OK" });
  } catch (e: any) {
    if (e?.name === "ZodError") return zodFail(req, res, e);
    return handledAppError(req, res, e);
  }
});

/** POST /estadisticas/productos-extremos
 *  ✅ Devuelve data: { mas_barato_mas_vendido, mas_caro_mas_vendido }
 */
r.post("/productos-extremos", requireJson, async (req, res) => {
  try {
    const base = RangoFechasBody.extend({ top: TopOpt });
    const { desde, hasta, top } = base.parse(req.body ?? {});
    const data = await Stats.productosExtremos(desde, hasta, top ?? 10);
    return sendCode(req, res, AppCode.OK, data, { httpStatus: 200, message: "OK" });
  } catch (e: any) {
    if (e?.name === "ZodError") return zodFail(req, res, e);
    return handledAppError(req, res, e);
  }
});

export default r;
