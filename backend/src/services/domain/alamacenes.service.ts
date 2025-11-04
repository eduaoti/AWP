// services/domain/almacenes.service.ts
import * as Almacenes from "../../models/almacen.model";

/* ===========================================================
   LISTAR ALMACENES (PAGINADO)
   =========================================================== */
/**
 * Devuelve items y meta con paginación enriquecida.
 * meta incluye: total, limit, offset, returned, hasNext, hasPrev, nextOffset, prevOffset
 */
export async function list(limit: number, offset: number) {
  const { items, meta } = await Almacenes.listarAlmacenes(limit, offset);

  const hasNext = meta.offset + meta.returned < meta.total;
  const hasPrev = meta.offset > 0;

  const nextOffset = hasNext ? meta.offset + meta.returned : null;
  const prevOffset = hasPrev ? Math.max(0, meta.offset - meta.limit) : null;

  return {
    items,
    meta: {
      total: meta.total,
      limit: meta.limit,
      offset: meta.offset,
      returned: meta.returned,
      hasNext,
      hasPrev,
      nextOffset,
      prevOffset
    }
  };
}

/* ===========================================================
   CREAR, OBTENER, ACTUALIZAR, ELIMINAR
   =========================================================== */
export async function create(d: unknown) {
  return Almacenes.crearAlmacen(d as any);
}

export async function getById(id: number) {
  return Almacenes.obtenerAlmacen(id);
}

export async function update(d: { id: number; nombre: string; telefono?: string; contacto?: string }) {
  return Almacenes.actualizarAlmacen(d);
}

export async function remove(id: number) {
  return Almacenes.eliminarAlmacen(id);
}
