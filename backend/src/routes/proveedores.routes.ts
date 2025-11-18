// src/routes/proveedores.routes.ts
import { Router } from "express";
import { validateBodySimple } from "../middlewares/validation/validate";
import { requireJson } from "../middlewares/security/require-json";
import { CreateProveedorSchema } from "../schemas/domain/proveedor.schemas";
import * as C from "../controllers/proveedores.controller";

const r = Router();

/** GET /proveedores  (listar con data + meta) */
r.get("/", C.list);

/** GET /proveedores/:id  (obtener uno) */
r.get("/:id", C.getById);

/** POST /proveedores  (alta con validaciones y manejo de duplicados) */
r.post("/", requireJson, validateBodySimple(CreateProveedorSchema), C.create);

/** PUT /proveedores/:id  (actualizar proveedor) */
r.put("/:id", requireJson, C.update);

/** DELETE /proveedores/:id  (eliminar proveedor) */
r.delete("/:id", C.remove);

export default r;
