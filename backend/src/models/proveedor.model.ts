// src/models/proveedor.model.ts
import { pool } from "../db";
import type {
  CreateProveedorDTO,
  UpdateProveedorDTO,
} from "../schemas/domain/proveedor.schemas";

/* =========================
   Normalizadores defensivos
   ========================= */

/** Normaliza nombre: NFKC, trim y colapso de espacios internos */
function normNombre(v: string) {
  return v.normalize("NFKC").trim().replace(/\s+/g, " ");
}

/** Deja solo dígitos o null si no hay nada útil */
function phoneDigitsOrNull(v?: string | null) {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  return digits.length ? digits : null;
}

/** Normaliza texto y lo convierte a null si queda vacío */
function safeTextOrNull(v?: string | null) {
  const s =
    typeof v === "string"
      ? v.normalize("NFKC").trim()
      : (v ?? null);
  return s && s.length ? s : null;
}

/* ===========================================================
   Crear proveedor con validaciones anti-duplicado (DB + precheck)
   =========================================================== */
export async function crearProveedor(data: CreateProveedorDTO) {
  const nombre = normNombre(data.nombre);
  const telefonoDigits = phoneDigitsOrNull(data.telefono ?? undefined);
  const contacto = safeTextOrNull(data.contacto ?? undefined);

  // 🔎 Pre-chequeo con casteo explícito a text para $2 (teléfono)
  const { rows: dup } = await pool.query<{ conflict: "nombre" | "telefono" | null }>(
    `
    SELECT
      CASE
        WHEN lower(regexp_replace(nombre, '\\s+', ' ', 'g')) =
             lower(regexp_replace($1::text, '\\s+', ' ', 'g'))
          THEN 'nombre'
        WHEN ($2::text) IS NOT NULL
             AND regexp_replace(coalesce(telefono, ''), '\\D', '', 'g') = ($2::text)
          THEN 'telefono'
        ELSE NULL
      END AS conflict
    FROM proveedores
    WHERE
      lower(regexp_replace(nombre, '\\s+', ' ', 'g')) =
        lower(regexp_replace($1::text, '\\s+', ' ', 'g'))
      OR (
        ($2::text) IS NOT NULL
        AND regexp_replace(coalesce(telefono, ''), '\\D', '', 'g') = ($2::text)
      )
    LIMIT 1
    `,
    [nombre, telefonoDigits]
  );

  if (dup.length && dup[0].conflict) {
    const conflict = dup[0].conflict;
    const err: any = new Error(
      conflict === "nombre"
        ? "Nombre de proveedor ya registrado (case-insensitive + colapso de espacios)."
        : "Teléfono ya registrado (se comparan solo dígitos; evita 477-555-1234 / (477)5551234)."
    );
    err.status = 409;
    err.code = "DB_CONSTRAINT";
    err.constraint =
      conflict === "nombre"
        ? "uniq_proveedores_nombre_norm"
        : "uniq_proveedores_tel_digits";
    throw err;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO proveedores (nombre, telefono, contacto)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, telefono, contacto, creado_en`,
      [nombre, telefonoDigits, contacto]
    );
    return rows[0];
  } catch (e: any) {
    if (e?.code === "23505") {
      const c: string = e?.constraint ?? "";
      let msg = "Restricción de unicidad violada.";
      if (c === "uniq_proveedores_nombre_norm") {
        msg =
          "Nombre de proveedor ya registrado (case-insensitive + colapso de espacios).";
      } else if (c === "uniq_proveedores_tel_digits") {
        msg =
          "Teléfono ya registrado (se comparan solo dígitos; evita 477-555-1234 / (477)5551234).";
      }
      const err: any = new Error(msg);
      err.status = 409;
      err.code = "DB_CONSTRAINT";
      err.constraint = c;
      throw err;
    }
    const err: any = new Error("Error de base de datos al crear proveedor.");
    err.status = 500;
    err.code = "DB_ERROR";
    err.detail = e?.message ?? e;
    throw err;
  }
}

/* ===========================================================
   Listar proveedores (ordenado por nombre asc)
   =========================================================== */
export async function listarProveedores(limit = 100, offset = 0) {
  const lim = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 100;
  const off = Number.isFinite(offset) && offset >= 0 ? offset : 0;

  const { rows } = await pool.query(
    `SELECT id, nombre, telefono, contacto, creado_en
     FROM proveedores
     ORDER BY nombre ASC
     LIMIT $1 OFFSET $2`,
    [lim, off]
  );
  return rows;
}

/* ===========================================================
   Obtener proveedor por ID
   =========================================================== */
export async function obtenerProveedorPorId(id: number) {
  const { rows } = await pool.query(
    `SELECT id, nombre, telefono, contacto, creado_en
     FROM proveedores
     WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/* ===========================================================
   Actualizar proveedor con pre-check de duplicados
   =========================================================== */
export async function actualizarProveedor(data: UpdateProveedorDTO) {
  const id = data.id;
  const nombre = normNombre(data.nombre);
  const telefonoDigits = phoneDigitsOrNull(data.telefono ?? undefined);
  const contacto = safeTextOrNull(data.contacto ?? undefined);

  // 🔎 Pre-chequeo anti-duplicados (ignorando el propio id)
  const { rows: dup } = await pool.query<{ conflict: "nombre" | "telefono" | null }>(
    `
    SELECT
      CASE
        WHEN lower(regexp_replace(nombre, '\\s+', ' ', 'g')) =
             lower(regexp_replace($1::text, '\\s+', ' ', 'g'))
          THEN 'nombre'
        WHEN ($2::text) IS NOT NULL
             AND regexp_replace(coalesce(telefono, ''), '\\D', '', 'g') = ($2::text)
          THEN 'telefono'
        ELSE NULL
      END AS conflict
    FROM proveedores
    WHERE id <> $3
      AND (
        lower(regexp_replace(nombre, '\\s+', ' ', 'g')) =
          lower(regexp_replace($1::text, '\\s+', ' ', 'g'))
        OR (
          ($2::text) IS NOT NULL
          AND regexp_replace(coalesce(telefono, ''), '\\D', '', 'g') = ($2::text)
        )
      )
    LIMIT 1
    `,
    [nombre, telefonoDigits, id]
  );

  if (dup.length && dup[0].conflict) {
    const conflict = dup[0].conflict;
    const err: any = new Error(
      conflict === "nombre"
        ? "Nombre de proveedor ya registrado (case-insensitive + colapso de espacios)."
        : "Teléfono ya registrado (se comparan solo dígitos; evita 477-555-1234 / (477)5551234)."
    );
    err.status = 409;
    err.code = "DB_CONSTRAINT";
    err.constraint =
      conflict === "nombre"
        ? "uniq_proveedores_nombre_norm"
        : "uniq_proveedores_tel_digits";
    throw err;
  }

  try {
    const { rows } = await pool.query(
      `UPDATE proveedores
       SET nombre   = $1,
           telefono = $2,
           contacto = $3
       WHERE id = $4
       RETURNING id, nombre, telefono, contacto, creado_en`,
      [nombre, telefonoDigits, contacto, id]
    );

    if (!rows.length) {
      const err: any = new Error("Proveedor no encontrado.");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    return rows[0];
  } catch (e: any) {
    if (e?.code === "23505") {
      const c: string = e?.constraint ?? "";
      let msg = "Restricción de unicidad violada.";
      if (c === "uniq_proveedores_nombre_norm") {
        msg =
          "Nombre de proveedor ya registrado (case-insensitive + colapso de espacios).";
      } else if (c === "uniq_proveedores_tel_digits") {
        msg =
          "Teléfono ya registrado (se comparan solo dígitos; evita 477-555-1234 / (477)5551234).";
      }
      const err: any = new Error(msg);
      err.status = 409;
      err.code = "DB_CONSTRAINT";
      err.constraint = c;
      throw err;
    }
    const err: any = new Error("Error de base de datos al actualizar proveedor.");
    err.status = 500;
    err.code = "DB_ERROR";
    err.detail = e?.message ?? e;
    throw err;
  }
}

/* ===========================================================
   Eliminar proveedor
   Regla de negocio: si hay FK (movimientos.proveedor_id), lanzará 23503
   =========================================================== */
export async function eliminarProveedor(id: number) {
  try {
    const { rows } = await pool.query(
      `DELETE FROM proveedores
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (!rows.length) {
      const err: any = new Error("Proveedor no encontrado.");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    return true;
  } catch (e: any) {
    // 23503 = violación de clave foránea (tiene movimientos vinculados)
    if (e?.code === "23503") {
      const err: any = new Error(
        "No se puede eliminar el proveedor porque tiene movimientos asociados."
      );
      err.status = 409;
      err.code = "DB_CONSTRAINT";
      throw err;
    }

    const err: any = new Error("Error de base de datos al eliminar proveedor.");
    err.status = 500;
    err.code = "DB_ERROR";
    err.detail = e?.message ?? e;
    throw err;
  }
}
