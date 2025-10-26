// src/services/producto.service.ts
import * as Productos from "../../models/producto.model";
import * as LowStock from "../system/lowStock";
import type {
  CreateProductoDTO,
  UpdateProductoDTO,
} from "../../schemas/domain/producto.schemas";

/**
 * Crea un producto nuevo y lanza alerta inmediata si el stock inicial está bajo.
 */
export async function crearProducto(data: CreateProductoDTO) {
  const producto = await Productos.crearProducto(data);

  try {
    await LowStock.checkAndNotifyByClave(data.clave);
  } catch {
    /* Ignorar errores de notificación */
  }

  return producto;
}

/**
 * Actualiza producto por clave o nombre.
 */
export async function actualizarProducto(identificador: { clave?: string; nombre?: string }, data: UpdateProductoDTO) {
  let actualizado = null;

  if (identificador.clave) {
    actualizado = await Productos.actualizarPorClave(identificador.clave, data);
    if (actualizado) {
      try {
        await LowStock.checkAndNotifyByClave(identificador.clave);
      } catch {}
    }
  } else if (identificador.nombre) {
    actualizado = await Productos.actualizarPorNombre(identificador.nombre, data);
    if (actualizado) {
      try {
        await LowStock.checkAndNotifyByNombre(identificador.nombre);
      } catch {}
    }
  }

  return actualizado;
}

/**
 * Actualiza solo el stock mínimo por clave o nombre.
 */
export async function actualizarStockMinimo(identificador: { clave?: string; nombre?: string }, stock_minimo: number) {
  let actualizado = null;

  if (identificador.clave) {
    actualizado = await Productos.actualizarStockMinimoPorClave(identificador.clave, stock_minimo);
    if (actualizado) {
      try {
        await LowStock.checkAndNotifyByClave(identificador.clave);
      } catch {}
    }
  } else if (identificador.nombre) {
    actualizado = await Productos.actualizarStockMinimoPorNombre(identificador.nombre, stock_minimo);
    if (actualizado) {
      try {
        await LowStock.checkAndNotifyByNombre(identificador.nombre);
      } catch {}
    }
  }

  return actualizado;
}

/**
 * Elimina producto por clave o nombre.
 */
export async function eliminarProducto(identificador: { clave?: string; nombre?: string }) {
  if (identificador.clave) return Productos.eliminarPorClave(identificador.clave);
  if (identificador.nombre) return Productos.eliminarPorNombre(identificador.nombre);
  return null;
}

/**
 * Lista productos según filtros (paginado o unificado).
 */
export async function listarProductos(body: any) {
  return Productos.findByContainerIgnoreCase({
    page: body.page,
    perPage: body.per_page,
    sortBy: body.sort_by,
    sortDir: body.sort_dir,
    clave: body.clave,
    nombre: body.nombre,
  });
}
