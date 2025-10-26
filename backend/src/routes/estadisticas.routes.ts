// src/routes/estadisticas.routes.ts
import { Router } from "express";
import { requireJson } from "../middlewares/security/require-json";
import {
  ventasPorProducto,
  productosMenorVenta,
  productosExtremos,
} from "../controllers/estadisticas.controller";

const r = Router();

/* ===========================================================
   Rutas JSON-only
   =========================================================== */

r.post("/ventas-producto", requireJson, ventasPorProducto);
r.post("/productos-menor-venta", requireJson, productosMenorVenta);
r.post("/productos-extremos", requireJson, productosExtremos);

export default r;
