// src/routes/productos.routes.ts
import { Router } from "express";
import { requireJson } from "../middlewares/security/require-json";
import { validateBodySimple, validateParams } from "../middlewares/validation/validate";
import { CreateProductoSchema, UpdateProductoSchema } from "../schemas/domain/producto.schemas";
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

/* Schema para params de código */
const CodigoParamSchema = z.object({
  params: z.object({
    codigo: z.string().min(1).max(10),
  }),
});

const r = Router();

/* ===========================================================
   RUTAS CRUD
   =========================================================== */

r.post("/", requireJson, validateBodySimple(CreateProductoSchema), crearProducto);
r.put("/codigo/:codigo", requireJson, validateParams(CodigoParamSchema), validateBodySimple(UpdateProductoSchema), actualizarPorCodigo);
r.delete("/codigo/:codigo", validateParams(CodigoParamSchema), eliminarPorCodigo);

/* ===========================================================
   LISTAR
   =========================================================== */
r.post("/listar", requireJson, listar);

/* ===========================================================
   UNIFICADAS
   =========================================================== */
r.put("/actualizar", requireJson, actualizar);
r.put("/stock-minimo", requireJson, actualizarStockMinimo);
r.delete("/eliminar", requireJson, eliminar);

/* ===========================================================
   DEPRECATED
   =========================================================== */
r.get("/", (req, res) => {
  return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
    httpStatus: 200,
    message: "Este endpoint está deprecado. Usa POST /productos/listar con body JSON.",
  });
});

export default r;
