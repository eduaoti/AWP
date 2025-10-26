// src/routes/movimientos.routes.ts
import { Router } from "express";
import { z } from "zod";
import { requireJson } from "../middlewares/security/require-json";
import { validateBodySimple, validateQuery } from "../middlewares/validation/validate";
import { MovimientoSchema } from "../schemas/domain/movimiento.schemas";
import { listar, registrar } from "../controllers/movimiento.controller";

const r = Router();

/* ===========================================================
   Validación de query para listado
   =========================================================== */
const MovimientosListQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(1000).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

/* ===========================================================
   RUTAS
   =========================================================== */

r.get("/", validateQuery(MovimientosListQuery), listar);

r.post("/", requireJson, validateBodySimple(MovimientoSchema), registrar);

export default r;
