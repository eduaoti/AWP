import { pool } from "../db";
import type { AlmacenCrearDTO } from "../schemas/domain/almacen.schemas";

/* =========================
   Normalizadores defensivos
   ========================= */
function normNombre(v: string) {
  return v.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function phoneDigits(v?: string | null) {
  if (!v) return "";
  return v.replace(/\D/g, "");
}

function safeTextOrNull(v?: string | null) {
  const s = typeof v === "string" ? v.normalize("NFKC").trim() : v ?? null;
  return s && s.length ? s : null;
}

/* ===========================================================
   Listar almacenes (paginado + defensivo)
   =========================================================== */
export async function listarAlmacenes(limit = 100, offset = 0) {
  const lim = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 100;
  const off = Number.isFinite(offset) && offset >= 0 ? offset : 0;

  const { rows: items } = await pool.query(
    `
    SELECT id, nombre, telefono, contacto, creado_en
      FROM almacenes
     ORDER BY nombre ASC
     LIMIT $1 OFFSET $2
    `,
    [lim, off]
  );

  const { rows: totalRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM almacenes`
  );
  const total = totalRows[0]?.total ?? 0;

  const meta = { total, limit: lim, offset: off, returned: items.length };

  return { items, meta };
}

/* ===========================================================
   Crear almacén con validaciones anti-duplicado (DB + precheck)
   =========================================================== */
export async function crearAlmacen(d: AlmacenCrearDTO) {
  const nombreNorm = normNombre(d.nombre);
  const telefonoOrig = safeTextOrNull(d.telefono ?? undefined);
  const telefonoDigits = phoneDigits(telefonoOrig);
  const contacto = safeTextOrNull(d.contacto ?? undefined);

  // 🔎 Duplicado por nombre
  const { rows: dupNombre } = await pool.query(
    `SELECT id, nombre
       FROM almacenes
      WHERE lower(regexp_replace(nombre,'\\s+',' ','g'))
            = lower(regexp_replace($1,'\\s+',' ','g'))
      LIMIT 1`,
    [nombreNorm]
  );
  if (dupNombre.length > 0) {
    const err: any = new Error(
      `Ya existe un almacén con el mismo nombre (ignora mayúsculas y espacios): "${dupNombre[0].nombre}".`
    );
    err.status = 409;
    err.code = "ALMACEN_DUPLICADO_NOMBRE";
    err.constraint = "uniq_almacenes_nombre_ci";
    throw err;
  }

  // 🔎 Duplicado por teléfono
  if (telefonoDigits) {
    const { rows: dupTel } = await pool.query(
      `SELECT id, telefono
         FROM almacenes
        WHERE regexp_replace(COALESCE(telefono,''), '\\D', '', 'g') = $1
        LIMIT 1`,
      [telefonoDigits]
    );
    if (dupTel.length > 0) {
      const err: any = new Error(
        `Ya existe un almacén con el mismo teléfono (solo se comparan dígitos): "${dupTel[0].telefono}".`
      );
      err.status = 409;
      err.code = "ALMACEN_DUPLICADO_TELEFONO";
      throw err;
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO almacenes (nombre, telefono, contacto)
       VALUES ($1,$2,$3)
       RETURNING id, nombre, telefono, contacto, creado_en`,
      [nombreNorm, telefonoOrig, contacto]
    );
    return rows[0];
  } catch (e: any) {
    if (e?.code === "23505") {
      const c = String(e?.constraint || "");
      if (c === "uniq_almacenes_nombre_ci") {
        const err: any = new Error("Nombre de almacén ya registrado (ignora mayúsculas y espacios).");
        err.status = 409;
        err.code = "ALMACEN_DUPLICADO_NOMBRE";
        err.constraint = c;
        throw err;
      }
      const err: any = new Error("Conflicto de unicidad en almacenes.");
      err.status = 409;
      err.code = "DB_CONSTRAINT";
      err.constraint = c;
      throw err;
    }

    const err: any = new Error("Error de base de datos al crear almacén.");
    err.status = 500;
    err.code = "DB_ERROR";
    err.detail = e?.message ?? e;
    throw err;
  }
}

/* ===========================================================
   Existencia por id
   =========================================================== */
export async function existeAlmacen(id: number) {
  const { rows } = await pool.query(
    `SELECT 1 FROM almacenes WHERE id = $1`,
    [id]
  );
  return !!rows[0];
}

/* ===========================================================
   Obtener almacén por id
   =========================================================== */
export async function obtenerAlmacen(id: number) {
  const { rows } = await pool.query(
    `SELECT id, nombre, telefono, contacto, creado_en
       FROM almacenes
      WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/* ===========================================================
   Actualizar almacén
   =========================================================== */
export async function actualizarAlmacen(d: { id: number; nombre: string; telefono?: string; contacto?: string }) {
  const nombreNorm = normNombre(d.nombre);
  const telefonoOrig = safeTextOrNull(d.telefono ?? undefined);
  const contacto = safeTextOrNull(d.contacto ?? undefined);

  // Duplicado por nombre
  const { rows: dupNombre } = await pool.query(
    `SELECT id FROM almacenes
      WHERE lower(regexp_replace(nombre,'\\s+',' ','g'))
            = lower(regexp_replace($1,'\\s+',' ','g'))
        AND id <> $2
      LIMIT 1`,
    [nombreNorm, d.id]
  );
  if (dupNombre.length > 0) {
    const err: any = new Error("Nombre de almacén ya registrado (ignora mayúsculas y espacios).");
    err.status = 409;
    err.code = "ALMACEN_DUPLICADO_NOMBRE";
    throw err;
  }

  const { rows } = await pool.query(
    `UPDATE almacenes
        SET nombre=$1, telefono=$2, contacto=$3
      WHERE id=$4
      RETURNING id, nombre, telefono, contacto, creado_en`,
    [nombreNorm, telefonoOrig, contacto, d.id]
  );
  if (!rows[0]) {
    const err: any = new Error("Almacén no encontrado");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

/* ===========================================================
   Eliminar almacén
   =========================================================== */
export async function eliminarAlmacen(id: number) {
  const { rows } = await pool.query(
    `DELETE FROM almacenes WHERE id=$1 RETURNING id`,
    [id]
  );
  if (!rows[0]) {
    const err: any = new Error("Almacén no encontrado");
    err.status = 404;
    throw err;
  }
  return rows[0];
}
