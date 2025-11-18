// src/api/proveedores.ts
import api from "./http";

/* ============================
   Tipos
   ============================ */
export interface Proveedor {
  id: number;
  nombre: string;
  telefono?: string | null;
  contacto?: string | null;
  creado_en: string;
}

export interface ProveedoresMeta {
  total: number;
  limit: number;
  offset: number;
  returned: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextOffset?: number | null;
  prevOffset?: number | null;
}

interface ListarParams {
  limit?: number;
  offset?: number;
}

/* ============================
   Listar proveedores
   ============================ */
export async function listarProveedores(params: ListarParams) {
  const { limit = 10, offset = 0 } = params;

  const res = await api.get("/proveedores", {
    params: { limit, offset },
  });

  const data = res.data?.data ?? {};
  return {
    items: (data.items ?? []) as Proveedor[],
    meta: (data.meta ?? null) as ProveedoresMeta | null,
  };
}

/* ============================
   Crear proveedor
   ============================ */
export interface CrearProveedorDTO {
  nombre: string;
  telefono?: string;
  contacto?: string;
}

export async function crearProveedor(payload: CrearProveedorDTO) {
  const res = await api.post("/proveedores", payload);
  return res.data;
}

/* ============================
   Actualizar proveedor
   (asumiendo que tengas PUT /proveedores/:id en el backend)
   ============================ */
export interface ActualizarProveedorDTO extends CrearProveedorDTO {
  id: number;
}

export async function actualizarProveedor(payload: ActualizarProveedorDTO) {
  const { id, ...rest } = payload;
  const res = await api.put(`/proveedores/${id}`, rest);
  return res.data;
}

/* ============================
   Eliminar proveedor
   (asumiendo DELETE /proveedores/:id)
   ============================ */
export async function eliminarProveedor(id: number) {
  const res = await api.delete(`/proveedores/${id}`);
  return res.data;
}
