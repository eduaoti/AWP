// src/routes/estadisticas.routes.ts
import { Router } from "express";
import * as Stats from "../models/estadisticas.model";
import { z } from "zod";
import { ok, sendCode } from "../status/respond";
import { AppCode } from "../status/codes";

const r = Router();

/* ===========================================================
   Esquemas de entrada (JSON-only)
   - Todas las rutas son POST y reciben { desde?, hasta?, ... }
   - Los strings se recortan; números se convierten con coerce
   =========================================================== */

// 👇 Mantén el esquema base como ZodObject (sin optional/default) para poder .extend()
const RangoFechasBase = z.object({
  desde: z.string().trim().min(1, "desde → No puede estar vacío").optional(),
  hasta: z.string().trim().min(1, "hasta → No puede estar vacío").optional(),
}).strict();

const VentasProductoBody = RangoFechasBase;

const MenorVentaBody = RangoFechasBase.extend({
  limite: z.coerce.number()
    .int("limite → Debe ser un entero")
    .positive("limite → Debe ser ≥ 1")
    .max(100000, "limite → Demasiado grande")
    .optional(),
});

const ExtremosBody = RangoFechasBase.extend({
  top: z.coerce.number()
    .int("top → Debe ser un entero")
    .positive("top → Debe ser ≥ 1")
    .max(100000, "top → Demasiado grande")
    .optional(),
});

/* ===========================================================
   Helpers
   =========================================================== */

function requireJson(req: any) {
  if (!req.is?.("application/json")) {
    const err: any = new Error("Content-Type debe ser application/json");
    err.status = 415;
    err.code = "BAD_CONTENT_TYPE";
    throw err;
  }
}

/* ===========================================================
   Rutas
   =========================================================== */

/** POST /estadisticas/ventas-producto */
r.post("/ventas-producto", async (req, res) => {
  try {
    requireJson(req);
    // Si no mandan body, parsea {} sin problema
    const { desde, hasta } = VentasProductoBody.parse(req.body ?? {});
    const data = await Stats.ventasPorProducto(desde, hasta);
    return ok(req, res, data);
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, {
        message: e.issues?.map((i: any) => i.message).join("; ") || "Validación fallida",
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
    requireJson(req);
    const { desde, hasta, limite } = MenorVentaBody.parse(req.body ?? {});
    const data = await Stats.productosMenorVenta(desde, hasta, limite ?? 10);
    return ok(req, res, data);
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, {
        message: e.issues?.map((i: any) => i.message).join("; ") || "Validación fallida",
      });
    }
    if (e?.status === 400 && e?.code === "RANGO_FECHAS_INVALIDO") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, { message: e.message, detalle: e.detail });
    }
    if (e?.status === 400 && e?.code === "PARAMETRO_INVALIDO") {
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
    requireJson(req);
    const { desde, hasta, top } = ExtremosBody.parse(req.body ?? {});
    const data = await Stats.productosExtremos(desde, hasta, top ?? 10);
    return ok(req, res, data);
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, {
        message: e.issues?.map((i: any) => i.message).join("; ") || "Validación fallida",
      });
    }
    if (e?.status === 400 && e?.code === "RANGO_FECHAS_INVALIDO") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, { message: e.message, detalle: e.detail });
    }
    if (e?.status === 400 && e?.code === "PARAMETRO_INVALIDO") {
      return sendCode(req, res, AppCode.VALIDATION_FAILED, null, { message: e.message, detalle: e.detail });
    }
    if (e?.status === 500 && e?.code === "DB_ERROR") {
      return sendCode(req, res, AppCode.DB_ERROR, null, { message: "Error de base de datos", detalle: e.detail });
    }
    return sendCode(req, res, AppCode.INTERNAL_ERROR, null, { message: "Error interno del servidor" });
  }
});

export default r;
