// src/api/movimientos.ts
import api from "./http";

/* ===========================================================
   Tipos
   =========================================================== */

export interface Movimiento {
  id: number;
  fecha: string;
  tipo: "entrada" | "salida";
  producto_id: number;
  cantidad: number;
  documento: string | null;
  responsable: string | null;
  proveedor_id: number | null;
  cliente_id: number | null;

  // Campos provenientes del JOIN
  producto_clave: string;
  producto_nombre: string;
  proveedor_nombre: string | null;
  cliente_nombre: string | null;
}

export interface MovimientosMeta {
  limit: number;
  offset: number;
  count: number;
}

export interface RegistrarMovimientoPayload {
  entrada: boolean;
  producto_clave: string;
  cantidad: number;
  documento?: string | null;
  responsable?: string | null;
  fecha?: string | Date;
  proveedor_id?: number;
  cliente_id?: number;
}

/* ===========================================================
   API
   =========================================================== */

/**
 * Listar movimientos con paginación básica.
 * GET /movimientos?limit=10&offset=0
 * Devuelve { items, meta } desenvueltos desde data.data.
 */
export async function listarMovimientos(params: {
  limit?: number;
  offset?: number;
}): Promise<{ items: Movimiento[]; meta: MovimientosMeta }> {
  const { limit = 10, offset = 0 } = params;

  const res = await api.get("/movimientos", {
    params: { limit, offset },
  });

  // Convención backend: { codigo, mensaje, data }
  const data = res.data?.data ?? res.data ?? {};

  return {
    items: (data.items ?? []) as Movimiento[],
    meta: (data.meta ?? {
      limit,
      offset,
      count: Array.isArray(data.items) ? data.items.length : 0,
    }) as MovimientosMeta,
  };
}

/**
 * Registrar un movimiento (entrada/salida).
 * POST /movimientos
 */
export async function registrarMovimiento(payload: RegistrarMovimientoPayload) {
  const res = await api.post("/movimientos", payload);
  return res.data;
}
