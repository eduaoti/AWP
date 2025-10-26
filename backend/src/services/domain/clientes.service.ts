// src/services/clientes.service.ts
import * as Clientes from "../../models/cliente.model";

export async function list(limit: number, offset: number) {
  return Clientes.listarClientes(limit, offset);
}

export async function create(d: unknown) {
  // El modelo ya valida y arroja errores claros (duplicados, DB, etc.)
  return Clientes.crearCliente(d as any);
}

// —— Opcionales (si activas endpoints de detalle/actualización/borrado) ——
export async function getById(id: number) {
  return Clientes.obtenerCliente(id);
}

export async function update(d: { id: number; nombre: string; telefono?: string; contacto?: string }) {
  return Clientes.actualizarCliente(d);
}

export async function remove(id: number) {
  return Clientes.eliminarCliente(id);
}
