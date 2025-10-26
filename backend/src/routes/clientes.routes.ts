// src/routes/clientes.routes.ts
import { Router } from "express";
import { validateBodySimple } from "../middlewares/validation/validate";
import { requireJson } from "../middlewares/security/require-json";
import { ClienteCrearSchema, ClienteActualizarSchema, ClienteEliminarSchema } from "../schemas/domain/cliente.schemas";
import * as C from "../controllers/clientes.controller";

const r = Router();

// Listar
r.get("/", C.list);

// Crear
r.post("/", requireJson, validateBodySimple(ClienteCrearSchema), C.create);

// —— Opcionales REST completos ——
r.get("/:id", C.getOne);
r.put("/", requireJson, validateBodySimple(ClienteActualizarSchema), C.update);
r.post("/eliminar", requireJson, validateBodySimple(ClienteEliminarSchema), C.remove);

export default r;
