// src/services/domain/proveedores.service.ts
import * as Proveedores from "../../models/proveedor.model";
import type { CreateProveedorDTO, UpdateProveedorDTO } from "../../schemas/domain/proveedor.schemas";

export async function list(limit: number, offset: number) {
  return Proveedores.listarProveedores(limit, offset);
}

export async function create(dto: CreateProveedorDTO) {
  return Proveedores.crearProveedor(dto);
}

export async function getById(id: number) {
  return Proveedores.obtenerProveedorPorId(id);
}

export async function update(dto: UpdateProveedorDTO) {
  return Proveedores.actualizarProveedor(dto);
}

export async function remove(id: number) {
  return Proveedores.eliminarProveedor(id);
}
