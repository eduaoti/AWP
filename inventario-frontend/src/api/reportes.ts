// src/api/reportes.ts
import api from "./http";

/* ================================
   Tipos para movimientos por producto
   ================================ */
export interface MovimientoProducto {
  id: number;
  fecha: string;
  tipo: "entrada" | "salida";
  cantidad: number;
  documento: string | null;
  responsable: string | null;
  producto_id: number;
  producto_clave: string;
  producto_nombre: string;
  proveedor_nombre?: string | null;
  cliente_nombre?: string | null;
  almacen_nombre?: string | null;
}

export interface MovimientosProductoMeta {
  total?: number;
  limit: number;
  offset: number;
  returned: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  nextOffset?: number | null;
  prevOffset?: number | null;
}

export interface MovimientosProductoResponse {
  items: MovimientoProducto[];
  meta: MovimientosProductoMeta;
}

/* ================================
   Tipos ventas por producto
   ================================ */
export interface VentaProducto {
  producto_id: number;
  clave: string;
  nombre: string;
  total_vendido: number;
}

export interface VentasPorProductoMeta {
  rango_aplicado?: { desde: string; hasta: string };
  ahora_utc?: string;
}

export interface VentasPorProductoResponse {
  items: VentaProducto[];
  meta: VentasPorProductoMeta;
}

/* ================================
   Helpers fechas
   ================================ */
export function toIsoZ(localValue?: string): string | undefined {
  if (!localValue) return undefined;
  const d = new Date(localValue);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/* ================================
   API movimientos por producto
   ================================ */
export async function fetchMovimientosPorProducto(params: {
  productoClave: string;
  limit?: number;
  offset?: number;
  desdeIso?: string;
  hastaIso?: string;
}): Promise<MovimientosProductoResponse> {
  const res = await api.get("/reportes/movimientos-producto", {
    params: {
      producto_clave: params.productoClave,
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      desde: params.desdeIso,
      hasta: params.hastaIso,
    },
  });

  return res.data.data as MovimientosProductoResponse;
}

/* ================================
   API ventas por producto
   ================================ */
export async function fetchVentasPorProducto(body: {
  desdeIso: string;
  hastaIso: string;
}): Promise<VentasPorProductoResponse> {
  const res = await api.post("/estadisticas/ventas-producto", {
    desde: body.desdeIso,
    hasta: body.hastaIso,
  });

  return res.data.data as VentasPorProductoResponse;
}
