// src/services/movimiento.service.ts
import * as Movimientos from "../../models/movimiento.model";
import type { MovimientoDTO } from "../../schemas/domain/movimiento.schemas";

/**
 * Registrar un nuevo movimiento (entrada o salida).
 * Reutiliza el modelo directamente para mantener validaciones de negocio y stock.
 */
export async function registrarMovimiento(data: MovimientoDTO) {
  return Movimientos.registrarMovimiento(data);
}

/**
 * Listar movimientos con límites defensivos.
 */
export async function listarMovimientos(limit: number, offset: number) {
  return Movimientos.listarMovimientos(limit, offset);
}
