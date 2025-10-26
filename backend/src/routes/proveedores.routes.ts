// src/routes/proveedores.routes.ts
import { Router } from "express";
import { validateBodySimple } from "../middlewares/validation/validate";
import { requireJson } from "../middlewares/security/require-json";
import { CreateProveedorSchema } from "../schemas/domain/proveedor.schemas";
import * as C from "../controllers/proveedores.controller";

const r = Router();

/** GET /proveedores  (listar con data + meta) */
r.get("/", C.list);

/** POST /proveedores  (alta con validaciones y manejo de duplicados) */
r.post("/", requireJson, validateBodySimple(CreateProveedorSchema), C.create);

export default r;
