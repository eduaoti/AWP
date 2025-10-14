// src/schemas/movimiento.schemas.ts
import { z } from "zod";

/** Base común para movimientos */
const BaseMovimiento = z.object({
  producto_id: z.coerce.number().int().positive({ message: "producto_id inválido" }),
  cantidad: z.coerce.number().positive({ message: "cantidad debe ser > 0" }),
  documento: z.string().min(1).max(120).optional(),
  responsable: z.string().min(1).max(120).optional(),
  // La fecha se asigna en DB; permitir override opcional (ISO o Date)
  fecha: z.coerce.date().optional(),
});

/** Entradas: pueden llevar proveedor_id (opcional) */
export const MovimientoEntradaSchema = BaseMovimiento.extend({
  proveedor_id: z.coerce.number().int().positive({ message: "proveedor_id inválido" }).optional(),
});

/** Salidas: ahora requieren cliente_id para asociar la venta */
export const MovimientoSalidaSchema = BaseMovimiento.extend({
  cliente_id: z.coerce.number().int().positive({ message: "cliente_id inválido" }),
});

export type MovimientoEntradaDTO = z.infer<typeof MovimientoEntradaSchema>;
export type MovimientoSalidaDTO  = z.infer<typeof MovimientoSalidaSchema>;
