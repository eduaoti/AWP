// src/schemas/proveedor.schemas.ts
import { z } from "zod";

export const CreateProveedorSchema = z.object({
  nombre: z.string().min(2, "nombre requerido"),
  telefono: z.string().min(5).max(40).optional(),
  contacto: z.string().min(2).max(120).optional(),
});

export type CreateProveedorDTO = z.infer<typeof CreateProveedorSchema>;
