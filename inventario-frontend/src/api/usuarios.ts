import api from "./http";

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: "admin" | "editor" | "lector" | "jefe_inventario";
  creado_en: string;
}

// Listar usuarios
export function listarUsuarios() {
  return api.post("/usuarios/listar", {
    page: 1,
    pageSize: 50,
    sortBy: "id",
    sortDir: "desc",
  });
}

// Crear usuario
export function crearUsuario(nombre: string, email: string, password: string, rol: string) {
  return api.post("/usuarios", { nombre, email, password, rol });
}

// Actualizar usuario
export function actualizarUsuario(id: number, nombre: string, email: string, rol: string) {
  return api.put("/usuarios", { id, nombre, email, rol });
}

// Eliminar usuario
export function eliminarUsuario(id: number) {
  return api.post("/usuarios/eliminar", { id });
}
