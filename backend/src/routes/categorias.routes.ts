import { Router } from "express";
import { requireJson } from "../middlewares/security/require-json";
import { validateBodySimple } from "../middlewares/validation/validate";
import { CreateCategoriaSchema, UpdateCategoriaSchema } from "../schemas/domain/categoria.schemas";
import * as CategoriaController from "../controllers/categoria.controller";
import { z } from "zod";

const IdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().min(1),
  }),
});

const r = Router();

/* ===========================================================
   CRUD CATEGORÍAS
   =========================================================== */
r.post("/", requireJson, validateBodySimple(CreateCategoriaSchema), CategoriaController.crear);
r.get("/", CategoriaController.listar);
r.put("/:id", requireJson, CategoriaController.actualizar);
r.delete("/:id", CategoriaController.eliminar);

export default r;
