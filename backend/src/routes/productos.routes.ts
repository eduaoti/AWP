// src/routes/productos.routes.ts
import { Router } from "express";
import { z } from "zod";
import {
  CreateProductoSchema,
  UpdateProductoSchema,
  // JSON-only POR CLAVE
  UpdatePorClaveSchema,
  UpdateStockMinimoPorClaveSchema,
  // JSON-only POR NOMBRE
  UpdatePorNombreSchema,
  UpdateStockMinimoPorNombreSchema,
} from "../schemas/producto.schemas";
import { validateBodySimple } from "../middlewares/validate";
import { requireJson } from "../middlewares/require-json";
import * as Productos from "../models/producto.model";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import { enqueueLowStockAlertToChief } from "../services/emailQueue";

const r = Router();

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
      await Productos.crearProducto(req.body);
      // Respuesta mínima siempre HTTP 200 (sin data)
      return sendCode(req, res, AppCode.OK, undefined, { httpStatus: 200, message: "OK" });
    } catch (e: any) {
      if (e?.code === "23505") {
        return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
          httpStatus: 200,
          message: "La clave o el nombre ya existe",
        });
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
      const { codigo } = req.params as { codigo: string };
      const actualizado = await Productos.actualizarPorCodigo(codigo, req.body);
      if (!actualizado) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }
      return sendCode(req, res, AppCode.OK, undefined, { httpStatus: 200, message: "OK" });
    } catch (e: any) {
      if (e?.code === "23505") {
        return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
          httpStatus: 200,
          message: "La clave o el nombre ya existe",
        });
      }
      next(e);
    }
  }
);

/** DELETE /productos/codigo/:codigo  (eliminar por código - compat) */
r.delete("/codigo/:codigo", async (req, res, next) => {
  try {
    const { codigo } = req.params as { codigo: string };
    const eliminado = await Productos.eliminarPorCodigo(codigo);
    if (!eliminado) {
      return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
        httpStatus: 200,
        message: "No encontrado",
      });
    }
    return sendCode(req, res, AppCode.OK, undefined, { httpStatus: 200, message: "OK" });
  } catch (e) {
    next(e);
  }
});

/* ===========================================================
   ✅ POST /productos/listar  (antes GET /findbycontainerignorecase)
   - Todo por JSON body.
   - Case-insensitive, exacto por clave/nombre.
   - Mantiene paginación y orden.
   - 🔥 Devuelve data (items + meta).
   =========================================================== */

const ProductoFindBodySchema = z.object({
  clave: z.string().optional().transform(v => (v ?? "").trim()),
  nombre: z.string().optional().transform(v => (v ?? "").trim()),
  page: z.coerce.number().int("page → Debe ser entero").min(1, "page → Debe ser ≥ 1").default(1),
  per_page: z.coerce.number().int("per_page → Debe ser entero").min(1, "per_page → Debe ser ≥ 1").max(100, "per_page → Máximo 100").default(20),
  sort_by: z.enum(["nombre", "precio", "stock_actual", "creado_en"]).optional(),
  sort_dir: z.enum(["asc", "desc"]).optional(),
}).strict();

r.post(
  "/listar",
  requireJson,
  validateBodySimple(ProductoFindBodySchema),
  async (req, res, next) => {
    try {
      const { clave = "", nombre = "", page, per_page, sort_by, sort_dir } = req.body as any;

      const data = await Productos.findByContainerIgnoreCase({
        page,
        perPage: per_page,
        sortBy: sort_by,
        sortDir: sort_dir,
        clave,
        nombre,
      });

      // En listar SÍ devolvemos data
      return sendCode(req, res, AppCode.OK, data, { httpStatus: 200, message: "OK" });
    } catch (e: any) {
      if (e?.status === 400 && e?.code === "PARAMETRO_INVALIDO") {
        // Validación de parámetros: HTTP 200 pero sin data
        return sendCode(req, res, AppCode.VALIDATION_FAILED, undefined, {
          httpStatus: 200,
          message: e.message,
        });
      }
      next(e);
    }
  }
);

/* ===========================================================
   ❗️DEPRECATED: GET /productos (sugiere el nuevo)
   =========================================================== */
r.get("/", (_req, res) => {
  return sendCode(_req, res, AppCode.NOT_FOUND, undefined, {
    httpStatus: 200,
    message: "Este endpoint está deprecado. Usa POST /productos/listar con body JSON.",
  });
});

/* ===========================================================
   ✅ CRUD JSON-only por CLAVE
   =========================================================== */

/** PUT /productos/clave/actualizar → { clave, ...campos } */
r.put(
  "/clave/actualizar",
  requireJson,
  validateBodySimple(UpdatePorClaveSchema),
  async (req, res, next) => {
    try {
      const { clave, ...data } = req.body as { clave: string } & Record<string, unknown>;
      const actualizado = await Productos.actualizarPorClave(clave, data);
      if (!actualizado) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }
      return sendCode(req, res, AppCode.OK, undefined, { httpStatus: 200, message: "OK" });
    } catch (e: any) {
      if (e?.code === "23505") {
        return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
          httpStatus: 200,
          message: "La clave o el nombre ya existe",
        });
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
      if (!prod) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }
      return sendCode(req, res, AppCode.OK, undefined, { httpStatus: 200, message: "OK" });
    } catch (e) {
      next(e);
    }
  }
);

/** DELETE /productos/clave/eliminar → { clave } */
r.delete(
  "/clave/eliminar",
  requireJson,
  validateBodySimple(UpdatePorClaveSchema.pick({ clave: true })), // solo valida 'clave'
  async (req, res, next) => {
    try {
      const eliminado = await Productos.eliminarPorClave(req.body.clave);
      if (!eliminado) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }
      return sendCode(req, res, AppCode.OK, undefined, { httpStatus: 200, message: "OK" });
    } catch (e) {
      next(e);
    }
  }
);

/* ===========================================================
   ✅ CRUD JSON-only por NOMBRE
   =========================================================== */

/** PUT /productos/actualizar  → { nombre, ...campos } */
r.put(
  "/actualizar",
  requireJson,
  validateBodySimple(UpdatePorNombreSchema),
  async (req, res, next) => {
    try {
      const { nombre, ...data } = req.body as { nombre: string } & Record<string, unknown>;
      const actualizado = await Productos.actualizarPorNombre(nombre, data);
      if (!actualizado) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }
      return sendCode(req, res, AppCode.OK, undefined, { httpStatus: 200, message: "OK" });
    } catch (e: any) {
      if (e?.code === "23505") {
        return sendCode(req, res, AppCode.DB_CONSTRAINT, undefined, {
          httpStatus: 200,
          message: "La clave o el nombre ya existe",
        });
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
      if (!prod) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }
      return sendCode(req, res, AppCode.OK, undefined, { httpStatus: 200, message: "OK" });
    } catch (e) {
      next(e);
    }
  }
);

/** DELETE /productos/eliminar  → { nombre } */
r.delete(
  "/eliminar",
  requireJson,
  validateBodySimple(UpdatePorNombreSchema.pick({ nombre: true })), // solo valida 'nombre'
  async (req, res, next) => {
    try {
      const eliminado = await Productos.eliminarPorNombre(req.body.nombre);
      if (!eliminado) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }
      return sendCode(req, res, AppCode.OK, undefined, { httpStatus: 200, message: "OK" });
    } catch (e) {
      next(e);
    }
  }
);

/* ===========================================================
   🚨 NUEVO (DEV): GET /productos/alertas
   - Lista productos con stock_actual < stock_minimo
   - Encola correo a 'jefe_inventario' con el resumen
   - Devuelve data (items y resultado de notificación)
   =========================================================== */
r.get("/alertas", async (_req, res, next) => {
  try {
    const items = await Productos.listarProductosBajoStock(); // ya ordena por faltante DESC
    // Encola correo solo si hay algo que alertar
    let notify: { to: string | null; enqueued: boolean; count: number } = {
      to: null,
      enqueued: false,
      count: items.length,
    };

    if (items.length > 0) {
      notify = await enqueueLowStockAlertToChief(items);
    }

    return sendCode(
      _req,
      res,
      AppCode.OK,
      { items, notify },
      { httpStatus: 200, message: items.length ? "OK" : "Sin alertas" }
    );
  } catch (e) {
    next(e);
  }
});

export default r;
