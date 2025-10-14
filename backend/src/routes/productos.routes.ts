// src/routes/productos.routes.ts
import { Router } from "express";
import {
  CreateProductoSchema,
  UpdateProductoSchema,            // ← compat (con path param)
  UpdateStockMinimoSchema,        // ← compat (con path param)
  // ✅ JSON-only POR CLAVE
  IdPorClaveSchema,
  UpdatePorClaveSchema,
  UpdateStockMinimoPorClaveSchema,
  // ✅ JSON-only POR NOMBRE
  IdPorNombreSchema,
  UpdatePorNombreSchema,
  UpdateStockMinimoPorNombreSchema,
} from "../schemas/producto.schemas";
import { validateBodySimple } from "../middlewares/validate";
import * as Productos from "../models/producto.model";

const r = Router();

/* ===========================================================
   4.4 Respuesta estándar: {codigo, mensaje, path, timestamp, data}
   =========================================================== */
const stamp = () => new Date().toISOString();
const ok = (path: string, data: any) =>
  ({ codigo: 0, mensaje: "OK", path, timestamp: stamp(), data });
const err = (codigo: number, path: string, mensaje: string, detalle?: any) =>
  ({ codigo, mensaje, path, timestamp: stamp(), detalle });

/* ===========================================================
   📌 Compatibilidad por CÓDIGO (path params) — siguen funcionando
   =========================================================== */

/** POST /productos  (crear) */
r.post("/", validateBodySimple(CreateProductoSchema), async (req, res, next) => {
  try {
    const creado = await Productos.crearProducto(req.body);
    return res.status(201).json(ok("/productos", creado));
  } catch (e: any) {
    if (e?.code === "23505") {
      return res.status(409).json(err(3, "/productos", "La clave o el nombre ya existe"));
    }
    next(e);
  }
});

/** PUT /productos/codigo/:codigo  (actualizar por código - compat) */
r.put("/codigo/:codigo", validateBodySimple(UpdateProductoSchema), async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const actualizado = await Productos.actualizarPorCodigo(codigo, req.body);
    if (!actualizado) return res.status(404).json(err(4, "/productos/codigo/:codigo", "No encontrado"));
    return res.json(ok("/productos/codigo/:codigo", actualizado));
  } catch (e: any) {
    if (e?.code === "23505") {
      return res.status(409).json(err(3, "/productos/codigo/:codigo", "La clave o el nombre ya existe"));
    }
    next(e);
  }
});

/** DELETE /productos/codigo/:codigo  (eliminar por código - compat) */
r.delete("/codigo/:codigo", async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const eliminado = await Productos.eliminarPorCodigo(codigo);
    if (!eliminado) return res.status(404).json(err(4, "/productos/codigo/:codigo", "No encontrado"));
    // mantenemos el campo devuelto tal cual el path param usado
    return res.json(ok("/productos/codigo/:codigo", { codigo }));
  } catch (e) {
    next(e);
  }
});

/** GET /productos (listar todos) */
r.get("/", async (_req, res, next) => {
  try {
    const data = await Productos.listarProductos();
    return res.json(ok("/productos", data));
  } catch (e) {
    next(e);
  }
});

/** GET /productos/codigo/:codigo (obtener por código - compat) */
r.get("/codigo/:codigo", async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const prod = await Productos.obtenerPorCodigo(codigo);
    if (!prod) return res.status(404).json(err(4, "/productos/codigo/:codigo", "No encontrado"));
    return res.json(ok("/productos/codigo/:codigo", prod));
  } catch (e) {
    next(e);
  }
});

/** PUT /productos/codigo/:codigo/stock-minimo (compat) */
r.put(
  "/codigo/:codigo/stock-minimo",
  validateBodySimple(UpdateStockMinimoSchema),
  async (req, res, next) => {
    try {
      const { codigo } = req.params;
      const prod = await Productos.actualizarStockMinimoPorCodigo(
        codigo,
        req.body.stock_minimo
      );
      if (!prod) return res.status(404).json(err(4, "/productos/codigo/:codigo/stock-minimo", "No encontrado"));
      return res.json(ok("/productos/codigo/:codigo/stock-minimo", prod));
    } catch (e) {
      next(e);
    }
  }
);

/* ===========================================================
   ✅ CRUD JSON-only por CLAVE (sin params en URL)
   =========================================================== */

/** POST /productos/clave/obtener  → { clave } */
r.post(
  "/clave/obtener",
  validateBodySimple(IdPorClaveSchema),
  async (req, res, next) => {
    try {
      const prod = await Productos.obtenerPorClave(req.body.clave);
      if (!prod) return res.status(404).json(err(4, "/productos/clave/obtener", "No encontrado"));
      return res.json(ok("/productos/clave/obtener", prod));
    } catch (e) {
      next(e);
    }
  }
);

/** PUT /productos/clave/actualizar → { clave, ...campos } */
r.put(
  "/clave/actualizar",
  validateBodySimple(UpdatePorClaveSchema),
  async (req, res, next) => {
    try {
      const { clave, ...data } = req.body;
      const actualizado = await Productos.actualizarPorClave(clave, data);
      if (!actualizado) return res.status(404).json(err(4, "/productos/clave/actualizar", "No encontrado"));
      return res.json(ok("/productos/clave/actualizar", actualizado));
    } catch (e: any) {
      if (e?.code === "23505") {
        return res.status(409).json(err(3, "/productos/clave/actualizar", "La clave o el nombre ya existe"));
      }
      next(e);
    }
  }
);

/** PUT /productos/clave/stock-minimo → { clave, stock_minimo } */
r.put(
  "/clave/stock-minimo",
  validateBodySimple(UpdateStockMinimoPorClaveSchema),
  async (req, res, next) => {
    try {
      const prod = await Productos.actualizarStockMinimoPorClave(
        req.body.clave,
        req.body.stock_minimo
      );
      if (!prod) return res.status(404).json(err(4, "/productos/clave/stock-minimo", "No encontrado"));
      return res.json(ok("/productos/clave/stock-minimo", prod));
    } catch (e) {
      next(e);
    }
  }
);

/** DELETE /productos/clave/eliminar → { clave } */
r.delete(
  "/clave/eliminar",
  validateBodySimple(IdPorClaveSchema),
  async (req, res, next) => {
    try {
      const eliminado = await Productos.eliminarPorClave(req.body.clave);
      if (!eliminado) return res.status(404).json(err(4, "/productos/clave/eliminar", "No encontrado"));
      return res.json(ok("/productos/clave/eliminar", { clave: req.body.clave }));
    } catch (e) {
      next(e);
    }
  }
);

/* ===========================================================
   ✅ CRUD JSON-only por NOMBRE
   =========================================================== */

/** POST /productos/obtener  → { nombre } */
r.post("/obtener", validateBodySimple(IdPorNombreSchema), async (req, res, next) => {
  try {
    const prod = await Productos.obtenerPorNombre(req.body.nombre);
    if (!prod) return res.status(404).json(err(4, "/productos/obtener", "No encontrado"));
    return res.json(ok("/productos/obtener", prod));
  } catch (e) {
    next(e);
  }
});

/** PUT /productos/actualizar  → { nombre, ...campos } */
r.put("/actualizar", validateBodySimple(UpdatePorNombreSchema), async (req, res, next) => {
  try {
    const { nombre, ...data } = req.body;
    const actualizado = await Productos.actualizarPorNombre(nombre, data);
    if (!actualizado) return res.status(404).json(err(4, "/productos/actualizar", "No encontrado"));
    return res.json(ok("/productos/actualizar", actualizado));
  } catch (e: any) {
    if (e?.code === "23505") {
      return res.status(409).json(err(3, "/productos/actualizar", "La clave o el nombre ya existe"));
    }
    next(e);
  }
});

/** PUT /productos/stock-minimo  → { nombre, stock_minimo } */
r.put(
  "/stock-minimo",
  validateBodySimple(UpdateStockMinimoPorNombreSchema),
  async (req, res, next) => {
    try {
      const prod = await Productos.actualizarStockMinimoPorNombre(
        req.body.nombre,
        req.body.stock_minimo
      );
      if (!prod) return res.status(404).json(err(4, "/productos/stock-minimo", "No encontrado"));
      return res.json(ok("/productos/stock-minimo", prod));
    } catch (e) {
      next(e);
    }
  }
);

/** DELETE /productos/eliminar  → { nombre } */
r.delete("/eliminar", validateBodySimple(IdPorNombreSchema), async (req, res, next) => {
  try {
    const eliminado = await Productos.eliminarPorNombre(req.body.nombre);
    if (!eliminado) return res.status(404).json(err(4, "/productos/eliminar", "No encontrado"));
    return res.json(ok("/productos/eliminar", { nombre: req.body.nombre }));
  } catch (e) {
    next(e);
  }
});

export default r;
