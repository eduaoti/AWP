// src/routes/productos.routes.ts
import { Router } from "express";
import { z } from "zod";
import {
  CreateProductoSchema,
  UpdateProductoSchema, // usado en compat y para /actualizar (fuerte)
} from "../schemas/producto.schemas";
import { validateBodySimple, validateParams } from "../middlewares/validate";
import { requireJson } from "../middlewares/require-json";
import * as Productos from "../models/producto.model";
import { sendCode } from "../status/respond";
import { AppCode } from "../status/codes";
import { claveStrict, safeText, nonNegativeInt } from "../schemas/_helpers";
import * as LowStock from "../services/lowStock"; // ⬅️ NUEVO

const r = Router();

/* ===========================================================
   🔧 Helpers de schemas locales (listar y flex)
   =========================================================== */

// Permite "" (sin filtro) o valida con el schema dado
const emptyOr = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.union([z.literal(""), schema])
  );

// Body para POST /productos/listar
const ProductoFindBodySchema = z
  .object({
    // Si viene vacío "" → sin filtro; si no, valida fuerte
    clave: emptyOr(claveStrict("clave", 10)).optional().default(""),
    nombre: emptyOr(safeText("nombre", 3, 120)).optional().default(""),

    page: z.coerce.number().int().min(1, "page → Debe ser ≥ 1").default(1),
    per_page: z
      .coerce.number()
      .int()
      .min(1, "per_page → Debe ser ≥ 1")
      .max(100, "per_page → Máximo 100")
      .default(20),
    sort_by: z.enum(["nombre", "precio", "stock_actual", "creado_en"]).optional(),
    sort_dir: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

// Params para /codigo/:codigo
const CodigoParamSchema = z.object({
  params: z.object({
    codigo: claveStrict("codigo", 10),
  }),
});

// Identificador XOR (clave | nombre) para endpoints flex
const IdentificadorSchema = z
  .object({
    clave: z
      .preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1).optional())
      .optional(),
    nombre: z
      .preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1).optional())
      .optional(),
  })
  .superRefine((obj, ctx) => {
    const hasClave = !!obj.clave;
    const hasNombre = !!obj.nombre;
    if ((hasClave && hasNombre) || (!hasClave && !hasNombre)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Proporciona solo 'clave' o solo 'nombre'.",
        path: ["identificador"],
      });
      return;
    }
    // Validar fuerte según cuál venga
    if (hasClave) {
      const res = claveStrict("clave", 10).safeParse(String(obj.clave));
      if (!res.success) {
        for (const e of res.error.issues) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: e.message, path: ["clave"] });
        }
      }
    }
    if (hasNombre) {
      const res = safeText("nombre", 3, 120).safeParse(String(obj.nombre));
      if (!res.success) {
        for (const e of res.error.issues) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: e.message, path: ["nombre"] });
        }
      }
    }
  });

// Para /stock-minimo (flex): identificador + stock_minimo entero ≥ 0
const UpdateStockMinimoFlexSchema = (IdentificadorSchema as z.ZodObject<any>).safeExtend({
  stock_minimo: nonNegativeInt("stock_minimo"),
});

// 🔥 Cuerpo FUERTE para PUT /productos/actualizar
// (passthrough para no chocar con la clave/nombre del identificador)
const UpdateProductoFlexBodySchema = IdentificadorSchema.and(
  UpdateProductoSchema.passthrough()
);

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

      // Si se crea con stock bajo desde el inicio, dispara alerta inmediata
      try {
        await LowStock.checkAndNotifyByClave(req.body.clave);
      } catch {}

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
  validateParams(CodigoParamSchema),
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

      // ⬅️ INSTANT ALERT: revisa y notifica al momento
      try {
        await LowStock.checkAndNotifyByClave(codigo);
      } catch {}

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
r.delete(
  "/codigo/:codigo",
  validateParams(CodigoParamSchema),
  async (req, res, next) => {
    try {
      const { codigo } = req.params as { codigo: string };
      const eliminado = await Productos.eliminarPorCodigo(codigo);
      if (!eliminado) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }
      // (La FK ON DELETE CASCADE limpiará alertas activas de ese producto)
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
   ✅ POST /productos/listar (JSON-only)
   =========================================================== */

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
   =========================================================== */

// PUT /productos/actualizar  → { clave|nombre, ...campos }
r.put(
  "/actualizar",
  requireJson,
  validateBodySimple(UpdateProductoFlexBodySchema), // ⬅️ usa esquema fuerte con passthrough
  async (req, res, next) => {
    try {
      const { clave, nombre, ...data } =
        req.body as { clave?: string; nombre?: string } & Record<string, unknown>;

      const actualizado = clave
        ? await Productos.actualizarPorClave(clave, data)
        : await Productos.actualizarPorNombre(nombre as string, data);

      if (!actualizado) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }

      // ⬅️ INSTANT ALERT
      try {
        if (clave) await LowStock.checkAndNotifyByClave(clave);
        else await LowStock.checkAndNotifyByNombre(nombre as string);
      } catch {}

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
r.put(
  "/stock-minimo",
  requireJson,
  validateBodySimple(UpdateStockMinimoFlexSchema),
  async (req, res, next) => {
    try {
      const { clave, nombre, stock_minimo } = req.body as {
        clave?: string;
        nombre?: string;
        stock_minimo: number;
      };

      const prod = clave
        ? await Productos.actualizarStockMinimoPorClave(clave, stock_minimo)
        : await Productos.actualizarStockMinimoPorNombre(nombre as string, stock_minimo);

      if (!prod) {
        return sendCode(req, res, AppCode.NOT_FOUND, undefined, {
          httpStatus: 200,
          message: "No encontrado",
        });
      }

      // ⬅️ INSTANT ALERT
      try {
        if (clave) await LowStock.checkAndNotifyByClave(clave);
        else await LowStock.checkAndNotifyByNombre(nombre as string);
      } catch {}

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
r.delete(
  "/eliminar",
  requireJson,
  validateBodySimple(IdentificadorSchema),
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
      // (ON DELETE CASCADE para alertas activas)
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
   📴 Envío de alertas: ahora también instantáneo (lowStock.ts)
   =========================================================== */

export default r;
