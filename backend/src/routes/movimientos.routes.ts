import { Router } from "express";
import { z } from "zod";
import { requireJson } from "../middlewares/security/require-json";
import { validateBodySimple, validateQuery } from "../middlewares/validation/validate";
import { MovimientoSchema } from "../schemas/domain/movimiento.schemas";
import { listar, registrar } from "../controllers/movimiento.controller";

const r = Router();

/* ===========================================================
   🧾 Validación de query para listado de movimientos
   - limit / offset para paginación
   - desde / hasta (opcional) para filtrar por fecha
   =========================================================== */
const MovimientosListQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(1000).default(50),
    offset: z.coerce.number().int().min(0).default(0),

    // Fechas opcionales (ISO o YYYY-MM-DD)
    desde: z
      .preprocess((v) => (typeof v === "string" ? new Date(v) : v), z.date())
      .optional(),
    hasta: z
      .preprocess((v) => (typeof v === "string" ? new Date(v) : v), z.date())
      .optional(),
  })
  .refine(
    (data) => {
      if (data.desde && data.hasta) {
        return data.desde <= data.hasta;
      }
      return true;
    },
    { message: "El rango de fechas no es válido (desde > hasta)" }
  )
  .strict();

/* ===========================================================
   🧭 RUTAS
   =========================================================== */

/**
 * GET /movimientos
 * Lista los movimientos con paginación y (opcionalmente) rango de fechas.
 * Query params: ?limit=50&offset=0&desde=2025-11-01&hasta=2025-11-03
 */
r.get("/", validateQuery(MovimientosListQuery), listar);

/**
 * POST /movimientos
 * Registra un nuevo movimiento de entrada o salida.
 * Body JSON validado con MovimientoSchema.
 */
r.post("/", requireJson, validateBodySimple(MovimientoSchema), registrar);

export default r;
