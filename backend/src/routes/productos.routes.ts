// src/routes/productos.routes.ts
import { Router } from "express";
import { z } from "zod";
import {
  CreateProductoSchema,
  UpdateProductoSchema, // usado en compat por código
} from "../schemas/producto.schemas";
import { validateBodySimple } from "../middlewares/validate";
import { requireJson } from "../middlewares/require-json";
import * as Productos from "../models/producto.model";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";

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
      return sendCode(req, res, AppCode.OK, undefined, {
        httpStatus: 200,
        message: "Producto creado con éxito",
      });
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
      return sendCode(req, res, AppCode.OK, undefined, {
        httpStatus: 200,
        message: "Producto actualizado con éxito",
      });
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
    return sendCode(req, res, AppCode.OK, undefined, {
      httpStatus: 200,
      message: "Producto eliminado con éxito",
    });
  } catch (e) {
    next(e);
  }
});

/* ===========================================================
   ✅ POST /productos/listar (JSON-only)
   =========================================================== */

const ProductoFindBodySchema = z.object({
  clave: z.string().optional().transform((v) => (v ?? "").trim()),
  nombre: z.string().optional().transform((v) => (v ?? "").trim()),
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

      // En listados, podemos dejar un mensaje neutro o afirmar éxito del listado
      return sendCode(req, res, AppCode.OK, data, {
        httpStatus: 200,
        message: "Listado generado con éxito",
      });
    } catch (e: any) {
      if (e?.status === 400 && e?.code === "PARAMETRO_INVALIDO") {
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
   ❗️DEPRECATED: GET /productos (usar POST /productos/listar)
   =========================================================== */
r.get("/", (_req, res) => {
  return sendCode(_req, res, AppCode.NOT_FOUND, undefined, {
    httpStatus: 200,
    message: "Este endpoint está deprecado. Usa POST /productos/listar con body JSON.",
  });
});

/* ===========================================================
   🔄 ENDPOINTS UNIFICADOS: por CLAVE *o* por NOMBRE
   - Envia exactamente uno de: { clave } o { nombre } (XOR)
   =========================================================== */

// Regla XOR para identificador
const IdentificadorSchema = z
  .object({
    clave: z.string().trim().optional(),
    nombre: z.string().trim().optional(),
  })
  .refine((d) => (!!d.clave && !d.nombre) || (!d.clave && !!d.nombre), {
    message: "Proporciona solo 'clave' o solo 'nombre'.",
    path: ["identificador"],
  });

// PUT /productos/actualizar  → { clave|nombre, ...campos }
const UpdateProductoFlexSchema = IdentificadorSchema.passthrough();

r.put(
  "/actualizar",
  requireJson,
  validateBodySimple(UpdateProductoFlexSchema),
  async (req, res, next) => {
    try {
      const { clave, nombre, ...data } = req.body as { clave?: string; nombre?: string } & Record<string, unknown>;

      const actualizado = clave
        ? await Productos.actualizarPorClave(clave, data)
        : await Productos.actualizarPorNombre(nombre as string, data);

      if (!actualizado) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }
      return sendCode(req, res, AppCode.OK, undefined, {
        httpStatus: 200,
        message: "Producto actualizado con éxito",
      });
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

// PUT /productos/stock-minimo → { clave|nombre, stock_minimo }
// ✅ Zod v4: usar safeExtend cuando el objeto tiene refine()
const UpdateStockMinimoFlexSchema = (IdentificadorSchema as z.ZodObject<any>).safeExtend({
  stock_minimo: z.coerce.number().finite().min(0, "stock_minimo debe ser ≥ 0"),
});

r.put(
  "/stock-minimo",
  requireJson,
  validateBodySimple(UpdateStockMinimoFlexSchema),
  async (req, res, next) => {
    try {
      const { clave, nombre, stock_minimo } = req.body as { clave?: string; nombre?: string; stock_minimo: number };

      const prod = clave
        ? await Productos.actualizarStockMinimoPorClave(clave, stock_minimo)
        : await Productos.actualizarStockMinimoPorNombre(nombre as string, stock_minimo);

      if (!prod) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }
      return sendCode(req, res, AppCode.OK, undefined, {
        httpStatus: 200,
        message: "Stock mínimo actualizado con éxito",
      });
    } catch (e) {
      next(e);
    }
  }
);

// DELETE /productos/eliminar → { clave|nombre }
const DeleteFlexSchema = IdentificadorSchema;

r.delete(
  "/eliminar",
  requireJson,
  validateBodySimple(DeleteFlexSchema),
  async (req, res, next) => {
    try {
      const { clave, nombre } = req.body as { clave?: string; nombre?: string };

      const eliminado = clave
        ? await Productos.eliminarPorClave(clave)
        : await Productos.eliminarPorNombre(nombre as string);

      if (!eliminado) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }
      return sendCode(req, res, AppCode.OK, undefined, {
        httpStatus: 200,
        message: "Producto eliminado con éxito",
      });
    } catch (e) {
      next(e);
    }
  }
);

/* ===========================================================
   📴 Envío de alertas: manejado por worker (sin endpoints write)
   =========================================================== */

export default r;
