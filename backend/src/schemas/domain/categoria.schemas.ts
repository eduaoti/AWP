import { z } from "zod";
import { safeText, noFlood, hasHtmlLike, hasRiskyJs } from "../shared/_helpers";

/** Nombre de categoría */
const Nombre = safeText("nombre", 3, 120).and(noFlood("nombre"));

/** Descripción opcional */
const Descripcion = z
  .string()
  .trim()
  .max(240, "descripcion → No debe exceder 240 caracteres")
  .refine((v) => !hasHtmlLike(v), "descripcion → HTML no permitido")
  .refine((v) => !hasRiskyJs(v), "descripcion → Contenido peligroso")
  .optional();

export const CreateCategoriaSchema = z
  .object({
    nombre: Nombre,
    descripcion: Descripcion,
    activo: z.boolean().optional().default(true),
  })
  .strict();

export const UpdateCategoriaSchema = z
  .object({
    nombre: Nombre.optional(),
    descripcion: Descripcion,
    activo: z.boolean().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Sin campos para actualizar",
  });

export const CategoriaListSchema = z
  .object({
    q: z.string().trim().max(120).optional(),
  })
  .strict();

export type CreateCategoriaDTO = z.infer<typeof CreateCategoriaSchema>;
export type UpdateCategoriaDTO = z.infer<typeof UpdateCategoriaSchema>;
export type CategoriaListDTO = z.infer<typeof CategoriaListSchema>;
