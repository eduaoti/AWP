import api from "./http";

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

/* =======================================
   CRUD Productos
   ======================================= */

// 🟢 Crear producto
export function crearProducto(data: Omit<Producto, "id">) {
  return api.post("/productos", data);
}

// 🔵 Listar productos (usa el endpoint paginado del backend)
export function listarProductos(page = 1, per_page = 50) {
  return api.post("/productos/listar", { page, per_page });
}

// 🟠 Actualizar por clave
export function actualizarProducto(clave: string, data: Partial<Producto>) {
  return api.put(`/productos/codigo/${clave}`, data);
}

// 🔴 Eliminar por clave
export function eliminarProducto(clave: string) {
  return api.delete(`/productos/codigo/${clave}`);
}
