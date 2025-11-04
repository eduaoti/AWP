import { Router } from "express";
import { validateBodySimple } from "../middlewares/validation/validate";
import { requireJson } from "../middlewares/security/require-json";
import { AlmacenCrearSchema, AlmacenActualizarSchema, AlmacenEliminarSchema } from "../schemas/domain/almacen.schemas";
import * as C from "../controllers/almacenes.controller";

const r = Router();

r.get("/", C.list);
r.post("/", requireJson, validateBodySimple(AlmacenCrearSchema), C.create);
r.get("/:id", C.getOne);
r.put("/", requireJson, validateBodySimple(AlmacenActualizarSchema), C.update);
r.post("/eliminar", requireJson, validateBodySimple(AlmacenEliminarSchema), C.remove);

export default r;
