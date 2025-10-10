// src/routes/productos.routes.ts
import { Router } from "express";
import { validate, validateBodySimple } from "../middlewares/validate"; // ⬅️ AGREGA validateBodySimple
import {
  CreateProductoSchema,
  UpdateProductoSchema,
  UpdateStockMinimoSchema,
} from "../schemas/producto.schemas";
import {
  crearProducto,
  actualizarProducto,
  actualizarStockMinimo,
  listarProductos,
  obtenerProducto,
} from "../models/producto.model";

const r = Router();

/** GET /productos */
r.get("/", async (_req, res, next) => {
  try {
    const data = await listarProductos();
    res.json(data);
  } catch (e) { next(e); }
});

/** GET /productos/:id */
r.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ mensaje: "id inválido" });
    const prod = await obtenerProducto(id);
    if (!prod) return res.status(404).json({ mensaje: "No encontrado" });
    res.json(prod);
  } catch (e) { next(e); }
});

/** POST /productos */
// r.post("/", validate(CreateProductoSchema), async (req, res, next) => {  // ← lo dejé de referencia
r.post("/", validateBodySimple(CreateProductoSchema), async (req, res, next) => {
  try {
    const creado = await crearProducto(req.body);
    res.status(201).json(creado);
  } catch (e: any) {
    if (e?.code === "23505") return res.status(409).json({ mensaje: "El código ya existe" });
    next(e);
  }
});

/** PUT /productos/:id */
// r.put("/:id", validate(UpdateProductoSchema), async (req, res, next) => {
r.put("/:id", validateBodySimple(UpdateProductoSchema), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ mensaje: "id inválido" });
    const actualizado = await actualizarProducto(id, req.body);
    if (!actualizado) return res.status(404).json({ mensaje: "No encontrado" });
    res.json(actualizado);
  } catch (e) { next(e); }
});

/** PUT /productos/:id/stock-minimo */
// r.put("/:id/stock-minimo", validate(UpdateStockMinimoSchema), async (req, res, next) => {
r.put("/:id/stock-minimo", validateBodySimple(UpdateStockMinimoSchema), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ mensaje: "id inválido" });
    const actualizado = await actualizarStockMinimo(id, req.body.stock_minimo);
    if (!actualizado) return res.status(404).json({ mensaje: "No encontrado" });
    res.json(actualizado);
  } catch (e) { next(e); }
});

export default r;
