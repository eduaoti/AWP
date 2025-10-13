// src/routes/productos.routes.ts
import { Router } from "express";
import {
  CreateProductoSchema,
  UpdateProductoSchema,
  UpdateStockMinimoSchema,
  IdPorNombreSchema,
  UpdatePorNombreSchema,
  UpdateStockMinimoPorNombreSchema
} from "../schemas/producto.schemas";
import { validateBodySimple } from "../middlewares/validate";
import * as Productos from "../models/producto.model";

const r = Router();

/* ===========================================================
   📌 CRUD por CÓDIGO (mantiene compatibilidad)
   =========================================================== */

/** POST /productos  (crear) */
r.post("/", validateBodySimple(CreateProductoSchema), async (req, res, next) => {
  try {
    const creado = await Productos.crearProducto(req.body);
    return res.status(201).json({ codigo: 0, mensaje: "OK", data: creado });
  } catch (e: any) {
    if (e?.code === "23505") {
      return res.status(409).json({ codigo: 3, mensaje: "El código o nombre ya existe" });
    }
    next(e);
  }
});

/** PUT /productos/codigo/:codigo  (actualizar por código) */
r.put("/codigo/:codigo", validateBodySimple(UpdateProductoSchema), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const actualizado = await Productos.actualizarPorCodigo(codigo, req.body);
    if (!actualizado) return res.status(404).json({ codigo: 4, mensaje: "No encontrado" });
    return res.json({ codigo: 0, mensaje: "OK", data: actualizado });
  } catch (e: any) {
    if (e?.code === "23505") {
      return res.status(409).json({ codigo: 3, mensaje: "El código o nombre ya existe" });
    }
    next(e);
  }
});

/** DELETE /productos/codigo/:codigo  (eliminar por código) */
r.delete("/codigo/:codigo", async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const eliminado = await Productos.eliminarPorCodigo(codigo);
    if (!eliminado) return res.status(404).json({ codigo: 4, mensaje: "No encontrado" });
    return res.json({ codigo: 0, mensaje: "OK", data: { codigo } });
  } catch (e) {
    next(e);
  }
});

/** GET /productos (listar todos) */
r.get("/", async (_req, res, next) => {
  try {
    const data = await Productos.listarProductos();
    return res.json({ codigo: 0, mensaje: "OK", data });
  } catch (e) {
    next(e);
  }
});

/** GET /productos/codigo/:codigo (obtener por código) */
r.get("/codigo/:codigo", async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const prod = await Productos.obtenerPorCodigo(codigo);
    if (!prod) return res.status(404).json({ codigo: 4, mensaje: "No encontrado" });
    return res.json({ codigo: 0, mensaje: "OK", data: prod });
  } catch (e) {
    next(e);
  }
});

/** PUT /productos/codigo/:codigo/stock-minimo */
r.put("/codigo/:codigo/stock-minimo", validateBodySimple(UpdateStockMinimoSchema), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const prod = await Productos.actualizarStockMinimoPorCodigo(codigo, req.body.stock_minimo);
    if (!prod) return res.status(404).json({ codigo: 4, mensaje: "No encontrado" });
    return res.json({ codigo: 0, mensaje: "OK", data: prod });
  } catch (e) {
    next(e);
  }
});

/* ===========================================================
   ✅ NUEVO: CRUD por NOMBRE (JSON-only)
   No se usan params en la URL → Swagger mostrará solo requestBody
   =========================================================== */

/** POST /productos/obtener  → { nombre } */
r.post("/obtener", validateBodySimple(IdPorNombreSchema), async (req, res, next) => {
  try {
    const prod = await Productos.obtenerPorNombre(req.body.nombre);
    if (!prod) return res.status(404).json({ codigo: 4, mensaje: "No encontrado" });
    return res.json({ codigo: 0, mensaje: "OK", data: prod });
  } catch (e) {
    next(e);
  }
});

/** PUT /productos/actualizar  → { nombre, ...campos } */
r.put("/actualizar", validateBodySimple(UpdatePorNombreSchema), async (req, res, next) => {
  try {
    const { nombre, ...data } = req.body;
    const actualizado = await Productos.actualizarPorNombre(nombre, data);
    if (!actualizado) return res.status(404).json({ codigo: 4, mensaje: "No encontrado" });
    return res.json({ codigo: 0, mensaje: "OK", data: actualizado });
  } catch (e: any) {
    if (e?.code === "23505") {
      return res.status(409).json({ codigo: 3, mensaje: "El código o nombre ya existe" });
    }
    next(e);
  }
});

/** PUT /productos/stock-minimo  → { nombre, stock_minimo } */
r.put("/stock-minimo", validateBodySimple(UpdateStockMinimoPorNombreSchema), async (req, res, next) => {
  try {
    const prod = await Productos.actualizarStockMinimoPorNombre(
      req.body.nombre,
      req.body.stock_minimo
    );
    if (!prod) return res.status(404).json({ codigo: 4, mensaje: "No encontrado" });
    return res.json({ codigo: 0, mensaje: "OK", data: prod });
  } catch (e) {
    next(e);
  }
});

/** DELETE /productos/eliminar  → { nombre } */
r.delete("/eliminar", validateBodySimple(IdPorNombreSchema), async (req, res, next) => {
  try {
    const eliminado = await Productos.eliminarPorNombre(req.body.nombre);
    if (!eliminado) return res.status(404).json({ codigo: 4, mensaje: "No encontrado" });
    return res.json({ codigo: 0, mensaje: "OK", data: { nombre: req.body.nombre } });
  } catch (e) {
    next(e);
  }
});

export default r;
