// backend/src/routes/reportes.routes.ts
import { Router } from "express";
import { movimientosProducto } from "../controllers/reportes.controller";
// Si quieres, puedes proteger con requireAuth aquí.
// import { requireAuth } from "../middlewares/security/require-auth";

const r = Router();

/**
 * GET /reportes/movimientos-producto
 * Ejemplo:
 *   /reportes/movimientos-producto
 *     ?producto_clave=ABC123
 *     &desde=2025-01-01T00:00:00Z
 *     &hasta=2025-02-01T00:00:00Z
 *     &limit=50
 *     &offset=0
 */
r.get("/movimientos-producto", movimientosProducto);

export default r;
