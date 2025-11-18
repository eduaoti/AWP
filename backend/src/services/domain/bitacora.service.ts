// src/services/domain/bitacora.service.ts
import { pool } from "../../db";
import {
  BitacoraAccesosQuerySchema,
  BitacoraMovimientosQuerySchema,
  BitacoraSistemaQuerySchema,
} from "../../schemas/bitacora/bitacora.schemas";

/* ===========================================================
   Helper genérico para construir WHERE dinámico
   =========================================================== */
type WhereBuilder = {
  where: string[];
  params: any[];
  idx: number;
};

function wb(): WhereBuilder {
  return { where: [], params: [], idx: 1 };
}

function addCond(
  b: WhereBuilder,
  cond: string | null | undefined,
  value?: any
) {
  if (!cond) return;
  b.where.push(cond);
  if (typeof value !== "undefined") {
    b.params.push(value);
    b.idx++;
  }
}

/* ===========================================================
   /bitacora/accesos
   Lee de login_audit
   =========================================================== */
export async function accesos(rawQuery: any) {
  const q = BitacoraAccesosQuerySchema.parse(rawQuery);
  const { page, pageSize, ...f } = q;

  const b = wb();

  if (f.userId) {
    addCond(b, `user_id = $${b.idx}`, f.userId);
  }
  if (f.email) {
    // si luego agregas columna email a login_audit, úsala;
    // por ahora lo dejamos en detalle/ip/user_agent → no lo filtramos directamente
    // addCond(b, `email ILIKE $${b.idx}`, `%${f.email}%`);
  }
  if (f.metodo) {
    addCond(b, `metodo = $${b.idx}`, f.metodo);
  }
  if (typeof f.exito === "boolean") {
    addCond(b, `exito = $${b.idx}`, f.exito);
  }
  if (f.desde) {
    addCond(b, `fecha >= $${b.idx}`, f.desde);
  }
  if (f.hasta) {
    addCond(b, `fecha <= $${b.idx}`, f.hasta);
  }

  const whereSql = b.where.length ? `WHERE ${b.where.join(" AND ")}` : "";
  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  // total para paginación
  const countSql = `SELECT COUNT(*) AS total FROM login_audit ${whereSql}`;
  const countRes = await pool.query(countSql, b.params);
  const total = Number(countRes.rows[0]?.total || 0);

  const dataSql = `
    SELECT id, user_id, fecha, ip, user_agent, metodo, exito, detalle
    FROM login_audit
    ${whereSql}
    ORDER BY fecha DESC
    LIMIT $${b.idx} OFFSET $${b.idx + 1}
  `;
  const dataParams = [...b.params, limit, offset];
  const { rows } = await pool.query(dataSql, dataParams);

  return {
    page,
    pageSize,
    total,
    rows,
  };
}

/* ===========================================================
   /bitacora/movimientos
   Lee de bitacora_movimientos
   =========================================================== */
export async function movimientos(rawQuery: any) {
  const q = BitacoraMovimientosQuerySchema.parse(rawQuery);
  const { page, pageSize, ...f } = q;

  const b = wb();

  if (f.usuarioId) {
    addCond(b, `usuario_id = $${b.idx}`, f.usuarioId);
  }
  if (f.tipo) {
    addCond(b, `tipo = $${b.idx}`, f.tipo);
  }
  if (f.productoId) {
    addCond(b, `producto_id = $${b.idx}`, f.productoId);
  }
  if (f.almacenId) {
    addCond(b, `almacen_id = $${b.idx}`, f.almacenId);
  }
  if (f.proveedorId) {
    addCond(b, `proveedor_id = $${b.idx}`, f.proveedorId);
  }
  if (f.desde) {
    addCond(b, `fecha_mov >= $${b.idx}`, f.desde);
  }
  if (f.hasta) {
    addCond(b, `fecha_mov <= $${b.idx}`, f.hasta);
  }

  const whereSql = b.where.length ? `WHERE ${b.where.join(" AND ")}` : "";
  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  const countSql = `SELECT COUNT(*) AS total FROM bitacora_movimientos ${whereSql}`;
  const countRes = await pool.query(countSql, b.params);
  const total = Number(countRes.rows[0]?.total || 0);

  const dataSql = `
    SELECT
      id,
      movimiento_id,
      fecha_log,
      fecha_mov,
      usuario_id,
      tipo,
      producto_id,
      cantidad,
      documento,
      responsable,
      proveedor_id,
      almacen_id,
      snapshot
    FROM bitacora_movimientos
    ${whereSql}
    ORDER BY fecha_mov DESC
    LIMIT $${b.idx} OFFSET $${b.idx + 1}
  `;
  const dataParams = [...b.params, limit, offset];
  const { rows } = await pool.query(dataSql, dataParams);

  return {
    page,
    pageSize,
    total,
    rows,
  };
}

/* ===========================================================
   /bitacora/sistema
   Lee de bitacora_sistema
   =========================================================== */
export async function sistema(rawQuery: any) {
  const q = BitacoraSistemaQuerySchema.parse(rawQuery);
  const { page, pageSize, ...f } = q;

  const b = wb();

  if (f.usuarioId) {
    addCond(b, `usuario_id = $${b.idx}`, f.usuarioId);
  }
  if (f.tabla) {
    addCond(b, `tabla = $${b.idx}`, f.tabla);
  }
  if (f.operacion) {
    addCond(b, `operacion = $${b.idx}`, f.operacion);
  }
  if (f.desde) {
    addCond(b, `fecha >= $${b.idx}`, f.desde);
  }
  if (f.hasta) {
    addCond(b, `fecha <= $${b.idx}`, f.hasta);
  }

  const whereSql = b.where.length ? `WHERE ${b.where.join(" AND ")}` : "";
  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  const countSql = `SELECT COUNT(*) AS total FROM bitacora_sistema ${whereSql}`;
  const countRes = await pool.query(countSql, b.params);
  const total = Number(countRes.rows[0]?.total || 0);

  const dataSql = `
    SELECT
      id,
      fecha,
      usuario_id,
      tabla,
      registro_id,
      operacion,
      ip,
      user_agent,
      valores_antes,
      valores_despues
    FROM bitacora_sistema
    ${whereSql}
    ORDER BY fecha DESC
    LIMIT $${b.idx} OFFSET $${b.idx + 1}
  `;
  const dataParams = [...b.params, limit, offset];
  const { rows } = await pool.query(dataSql, dataParams);

  return {
    page,
    pageSize,
    total,
    rows,
  };
}
