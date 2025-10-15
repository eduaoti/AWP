import { Router } from "express";
import {
  CreateProductoSchema,
  UpdateProductoSchema,
  UpdateStockMinimoSchema,
  // JSON-only POR CLAVE
  IdPorClaveSchema,
  UpdatePorClaveSchema,
  UpdateStockMinimoPorClaveSchema,
  // JSON-only POR NOMBRE
  IdPorNombreSchema,
  UpdatePorNombreSchema,
  UpdateStockMinimoPorNombreSchema,
  // Listado JSON-only
  ProductoListInput,
} from "../schemas/producto.schemas";
import { validateBodySimple } from "../middlewares/validate";
import { requireJson } from "../middlewares/require-json";
import * as Productos from "../models/producto.model";

const r = Router();

/* ===========================================================
   Respuesta estándar
   =========================================================== */
const stamp = () => new Date().toISOString();
const ok = (path: string, data: any) =>
  ({ codigo: 0, mensaje: "OK", path, timestamp: stamp(), data });
const err = (codigo: number, path: string, mensaje: string, detalle?: any) =>
  ({ codigo, mensaje, path, timestamp: stamp(), detalle });

/* ===========================================================
   📌 Compat por CÓDIGO (path params)
   =========================================================== */

/** POST /productos  (crear) — JSON-only */
r.post(
  "/",
  requireJson,
  validateBodySimple(CreateProductoSchema),
  async (req, res, next) => {
    try {
      const creado = await Productos.crearProducto(req.body);
      return res.status(201).json(ok("/productos", creado));
    } catch (e: any) {
      if (e?.code === "23505") {
        return res.status(409).json(err(3, "/productos", "La clave o el nombre ya existe"));
      }
      next(e);
    }
  }
);

/** PUT /productos/codigo/:codigo  (actualizar por código - compat) — JSON-only */
r.put(
  "/codigo/:codigo",
  requireJson,
  validateBodySimple(UpdateProductoSchema),
  async (req, res, next) => {
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
  }
);

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

/* ===========================================================
   ❗️DEPRECATED: GET /productos (usar POST /productos/listar)
   =========================================================== */
r.get("/", (_req, res) => {
  return res
    .status(410)
    .json(
      err(
        4,
        "/productos",
        "Este endpoint está deprecado. Usa POST /productos/listar con JSON."
      )
    );
});

/* ===========================================================
   ✅ NUEVO: POST /productos/listar (JSON-only, paginado + filtros)
   =========================================================== */
r.post(
  "/listar",
  requireJson,
  validateBodySimple(ProductoListInput),
  async (req, res, next) => {
    try {
      const { page, per_page, sort_by, sort_dir, q } = req.body;

      const data = await Productos.listarProductosPaginado({
        page,
        perPage: per_page,
        sortBy: sort_by,
        sortDir: sort_dir,
        q: q ?? null,
      });

      return res.json(ok("/productos/listar", data));
    } catch (e: any) {
      if (e?.status === 400 && e?.code === "PARAMETRO_INVALIDO") {
        return res.status(400).json(err(1, "/productos/listar", e.message, e.detail));
      }
      next(e);
    }
  }
);

/* ===========================================================
   ✅ CRUD JSON-only por CLAVE
   =========================================================== */

/** POST /productos/clave/obtener  → { clave } */
r.post(
  "/clave/obtener",
  requireJson,
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
  requireJson,
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
  requireJson,
  validateBodySimple(UpdateStockMinimoPorClaveSchema),
  async (req, res, next) => {
    try {
      const prod = await Productos.actualizarStockMinimoPorClave(req.body.clave, req.body.stock_minimo);
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
  requireJson,
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
r.post(
  "/obtener",
  requireJson,
  validateBodySimple(IdPorNombreSchema),
  async (req, res, next) => {
    try {
      const prod = await Productos.obtenerPorNombre(req.body.nombre);
      if (!prod) return res.status(404).json(err(4, "/productos/obtener", "No encontrado"));
      return res.json(ok("/productos/obtener", prod));
    } catch (e) {
      next(e);
    }
  }
);

/** PUT /productos/actualizar  → { nombre, ...campos } */
r.put(
  "/actualizar",
  requireJson,
  validateBodySimple(UpdatePorNombreSchema),
  async (req, res, next) => {
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
  }
);

/** PUT /productos/stock-minimo  → { nombre, stock_minimo } */
r.put(
  "/stock-minimo",
  requireJson,
  validateBodySimple(UpdateStockMinimoPorNombreSchema),
  async (req, res, next) => {
    try {
      const prod = await Productos.actualizarStockMinimoPorNombre(req.body.nombre, req.body.stock_minimo);
      if (!prod) return res.status(404).json(err(4, "/productos/stock-minimo", "No encontrado"));
      return res.json(ok("/productos/stock-minimo", prod));
    } catch (e) {
      next(e);
    }
  }
);

/** DELETE /productos/eliminar  → { nombre } */
r.delete(
  "/eliminar",
  requireJson,
  validateBodySimple(IdPorNombreSchema),
  async (req, res, next) => {
    try {
      const eliminado = await Productos.eliminarPorNombre(req.body.nombre);
      if (!eliminado) return res.status(404).json(err(4, "/productos/eliminar", "No encontrado"));
      return res.json(ok("/productos/eliminar", { nombre: req.body.nombre }));
    } catch (e) {
      next(e);
    }
  }
);

export default r;
