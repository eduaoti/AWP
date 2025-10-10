// src/schemas/movimiento.schemas.ts
import { z } from "zod";

const BaseMovimiento = z.object({
  producto_id: z.coerce.number().int().positive({ message: "producto_id inválido" }),
  cantidad: z.coerce.number().positive({ message: "cantidad debe ser > 0" }),
  documento: z.string().min(1).max(120).optional(),
  responsable: z.string().min(1).max(120).optional(),
  // fecha se asigna en DB, pero permitimos override opcional
  fecha: z.coerce.date().optional()
});

export const MovimientoEntradaSchema = BaseMovimiento.extend({
  // NUEVO: proveedor opcional para entradas
  proveedor_id: z.coerce.number().int().positive().optional(),
});

export const MovimientoSalidaSchema = BaseMovimiento.extend({
  // salidas no llevan proveedor
});

export type MovimientoEntradaDTO = z.infer<typeof MovimientoEntradaSchema>;
export type MovimientoSalidaDTO  = z.infer<typeof MovimientoSalidaSchema>;
