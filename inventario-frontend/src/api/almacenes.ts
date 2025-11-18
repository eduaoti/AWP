// src/api/almacenes.ts
import api from "./http";

export interface Almacen {
  id: number;
  nombre: string;
  telefono?: string | null;
  contacto?: string | null;
  creado_en: string;
}

export interface AlmacenesMeta {
  total: number;
  limit: number;
  offset: number;
  returned: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  nextOffset?: number | null;
  prevOffset?: number | null;
}

export interface AlmacenesRespuesta {
  items: Almacen[];
  meta: AlmacenesMeta;
}

// GET /almacenes?limit=&offset=
export async function listarAlmacenes(params?: {
  limit?: number;
  offset?: number;
}): Promise<AlmacenesRespuesta> {
  const { data } = await api.get("/almacenes", { params });
  // backend responde {codigo, mensaje, data: {items, meta}}
  return data.data as AlmacenesRespuesta;
}

// POST /almacenes
export function crearAlmacen(payload: {
  nombre: string;
  telefono?: string;
  contacto?: string;
}) {
  return api.post("/almacenes", payload);
}

// PUT /almacenes
export function actualizarAlmacen(payload: {
  id: number;
  nombre: string;
  telefono?: string;
  contacto?: string;
}) {
  return api.put("/almacenes", payload);
}

// POST /almacenes/eliminar
export function eliminarAlmacen(id: number) {
  return api.post("/almacenes/eliminar", { id });
}
