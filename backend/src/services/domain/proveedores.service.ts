// src/services/proveedores.service.ts
import * as Proveedores from "../../models/proveedor.model";
import type { CreateProveedorDTO } from "../../schemas/domain/proveedor.schemas";

export async function list(limit: number, offset: number) {
  return Proveedores.listarProveedores(limit, offset);
}

export async function create(dto: CreateProveedorDTO) {
  // El modelo ya realiza normalización y prechecks de unicidad (nombre / teléfono)
  return Proveedores.crearProveedor(dto);
}

// —— Opcionales si luego expones más endpoints ——
// export async function getById(id: number) { ... }
// export async function update(...) { ... }
// export async function remove(id: number) { ... }
