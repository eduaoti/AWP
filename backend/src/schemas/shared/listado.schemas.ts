// src/schemas/listado.schemas.ts
import { z } from "zod";

export const listarUsuariosSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["id","nombre","email","rol","creado_en"]).default("id"),
    sortDir: z.enum(["asc","desc"]).default("desc"),
    search: z.string().trim().max(80).optional()
  }).strict()
}).strict();
