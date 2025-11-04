import api from "./http";

export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string | null;
  creado_en?: string;
}

/* ===========================================================
   CRUD de Categorías
   =========================================================== */

// 🟢 Crear
export function crearCategoria(data: Omit<Categoria, "id">) {
  return api.post("/categorias", data);
}

// 🔵 Listar todas
export function listarCategorias() {
  return api.get("/categorias");
}

// 🟠 Actualizar
export function actualizarCategoria(id: number, data: Partial<Categoria>) {
  return api.put(`/categorias/${id}`, data);
}

// 🔴 Eliminar
export function eliminarCategoria(id: number) {
  return api.delete(`/categorias/${id}`);
}
