// src/services/estadisticas.service.ts
import * as Stats from "../../models/estadisticas.model";

/**
 * Delegamos directamente al modelo, que ya valida rango y límites.
 * Este servicio existe solo para centralizar la lógica de negocio,
 * sin alterar las respuestas ni mensajes.
 */

export async function ventasPorProducto(desde: string, hasta: string) {
  return Stats.ventasPorProducto(desde, hasta);
}

export async function productosMenorVenta(desde: string, hasta: string, limite?: number) {
  return Stats.productosMenorVenta(desde, hasta, limite ?? 10);
}

export async function productosExtremos(desde: string, hasta: string, top?: number) {
  return Stats.productosExtremos(desde, hasta, top ?? 10);
}
