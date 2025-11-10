// src/routes/productos.routes.ts
import { Router } from "express";
import { requireJson } from "../middlewares/security/require-json";
import { validateBodySimple, validateParams } from "../middlewares/validation/validate";
import {
  CreateProductoSchema,
  UpdateProductoSchema,
  UpdateStockMinimoSchema,
} from "../schemas/domain/producto.schemas";
import {
  crearProducto,
  actualizarPorCodigo,
  eliminarPorCodigo,
  listar,
  actualizar,
  actualizarStockMinimo,
  eliminar,
} from "../controllers/producto.controller";
import { AppCode } from "../status/codes";
import { sendCode } from "../status/respond";
import { z } from "zod";

/* ===========================================================
   🧩 Validación para código (parametro en URL)
   =========================================================== */
const CodigoParamSchema = z.object({
  params: z.object({
    codigo: z
      .string()
      .min(2, "codigo → Debe tener al menos 2 caracteres")
      .max(20, "codigo → No debe exceder 20 caracteres")
      .regex(/^[A-Za-z0-9_-]{2,20}$/, {
        message: "codigo → Solo puede contener letras, números, guiones (-) o guiones bajos (_)",
      }),
  }),
});

const r = Router();

/* ===========================================================
   🧱 CRUD PRINCIPALES
   =========================================================== */

/** Crear producto */
r.post("/", requireJson, validateBodySimple(CreateProductoSchema), crearProducto);

/** Actualizar producto por código */
r.put(
  "/codigo/:codigo",
  requireJson,
  validateParams(CodigoParamSchema),
  validateBodySimple(UpdateProductoSchema),
  actualizarPorCodigo
);

/** Eliminar producto por código */
r.delete("/codigo/:codigo", validateParams(CodigoParamSchema), eliminarPorCodigo);

/* ===========================================================
   📋 LISTAR PRODUCTOS
   =========================================================== */

/** Listar productos (paginado o completo) */
r.post("/listar", requireJson, listar);

/* ===========================================================
   🔁 UNIFICADAS (por clave/nombre en body)
   =========================================================== */

/** Actualizar producto (clave o nombre en body) */
r.put("/actualizar", requireJson, validateBodySimple(UpdateProductoSchema), actualizar);

/** Actualizar solo el stock mínimo */
r.put("/stock-minimo", requireJson, validateBodySimple(UpdateStockMinimoSchema), actualizarStockMinimo);

/** Eliminar producto (por body: clave o nombre) */
r.delete("/eliminar", requireJson, eliminar);

/* ===========================================================
   ⚠️ DEPRECATED ENDPOINT
   =========================================================== */
r.get("/", (req, res) => {
  return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
    httpStatus: 200,
    message: "Este endpoint está deprecado. Usa POST /productos/listar con body JSON.",
  });
});

export default r;
