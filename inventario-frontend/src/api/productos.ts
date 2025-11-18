// src/api/productos.ts
import api from "./http";

/* ======================================================
   Tipos
   ====================================================== */

export interface Producto {
  id: number;
  clave: string;
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  unidad: string;
  precio: number;
  stock_minimo: number;
  stock_actual: number;
  creado_en?: string;
  actualizado_en?: string;
}

export interface ProductoMini {
  id: number;
  clave: string;
  nombre: string;
}

/* ======================================================
   Auth headers helper
   ====================================================== */
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ======================================================
   CRUD Productos
   ====================================================== */

// 🟢 Crear producto
export function crearProducto(data: Omit<Producto, "id">) {
  return api.post("/productos", data, {
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
  });
}

// 🔵 Listar productos (PAGINADO + FILTRO OPCIONAL)
export function listarProductos(params?: {
  page?: number;
  per_page?: number;
  search?: string;
}) {
  return api.post(
    "/productos/listar",
    {
      page: params?.page ?? 1,
      per_page: params?.per_page ?? 50,
      search: params?.search?.trim() || undefined,
    },
    {
      headers: getAuthHeaders(),
    }
  );
}

// 🟡 Obtener 1 producto por clave
export function obtenerProductoPorClave(clave: string) {
  return api.get(`/productos/codigo/${clave}`, {
    headers: getAuthHeaders(),
  });
}

// 🟠 Actualizar producto por clave
export function actualizarProducto(clave: string, data: Partial<Producto>) {
  return api.put(`/productos/codigo/${clave}`, data, {
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
  });
}

// 🔴 Eliminar producto por clave
export function eliminarProducto(clave: string) {
  return api.delete(`/productos/codigo/${clave}`, {
    headers: getAuthHeaders(),
  });
}

/* ======================================================
   Autocompletado / Buscador rápido
   ====================================================== */

export async function buscarProductos(q: string): Promise<ProductoMini[]> {
  const res = await api.get("/productos", {
    params: {
      search: q.trim(),
      limit: 15,
    },
    headers: getAuthHeaders(),
  });

  return res.data?.data ?? [];
}
