import * as CategoriaModel from "../../models/categoria.model";
import type { CreateCategoriaDTO, UpdateCategoriaDTO } from "../../schemas/domain/categoria.schemas";

export async function crearCategoria(data: CreateCategoriaDTO) {
  return CategoriaModel.crearCategoria(data);
}

export async function listarCategorias(filtro?: string) {
  return CategoriaModel.listarCategorias(filtro);
}

export async function actualizarCategoria(id: number, data: UpdateCategoriaDTO) {
  return CategoriaModel.actualizarCategoria(id, data);
}

export async function eliminarCategoria(id: number) {
  return CategoriaModel.eliminarCategoria(id);
}
