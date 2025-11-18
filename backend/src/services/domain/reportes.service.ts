// src/services/domain/reportes.service.ts
import * as ReportesModel from "../../models/reportes.model";
import * as EstadisticasModel from "../../models/estadisticas.model";

/* ===========================================================
   Helpers
   =========================================================== */

/**
 * Convierte Date | string | undefined a string ISO-8601 con Z (UTC) o undefined.
 * - Si es Date → date.toISOString()
 * - Si es string → se deja tal cual (el modelo valida el formato)
 * - Otro → undefined
 */
function toIsoZ(input?: Date | string): string | undefined {
  if (!input) return undefined;
  if (input instanceof Date) return input.toISOString();
  if (typeof input === "string") return input;
  return undefined;
}

/* ===========================================================
   Reporte: movimientos por producto
   (GET /reportes/movimientos-producto)
   =========================================================== */

export async function movimientosPorProducto(params: {
  productoClave: string;
  limit?: number;
  offset?: number;
  desde?: Date | string;
  hasta?: Date | string;
}) {
  const { productoClave, limit, offset, desde, hasta } = params;

  return ReportesModel.movimientosProducto({
    producto_clave: productoClave,
    limit,
    offset,
    desde: toIsoZ(desde),
    hasta: toIsoZ(hasta),
  });
}

/* ===========================================================
   Reporte: ventas por producto
   (usa el modelo de estadísticas)
   =========================================================== */

export async function ventasPorProducto(params: {
  limit?: number;   // por si luego quieres paginar en otro lado
  offset?: number;  // (el modelo actual no los usa, pero no estorban aquí)
  desde?: Date | string;
  hasta?: Date | string;
}) {
  const { desde, hasta } = params;

  const desdeIso = toIsoZ(desde);
  const hastaIso = toIsoZ(hasta);

  // El modelo de estadísticas espera (desde?: string, hasta?: string)
  return EstadisticasModel.ventasPorProducto(desdeIso, hastaIso);
}
