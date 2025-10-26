// backend/src/models/cliente.model.ts
import { pool } from "../db";
import type { ClienteCrearDTO } from "../schemas/domain/cliente.schemas";

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
   Listar clientes (ordenado por nombre asc; con límites defensivos)
   =========================================================== */
export async function listarClientes(limit = 100, offset = 0) {
  const lim = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 100;
  const off = Number.isFinite(offset) && offset >= 0 ? offset : 0;

  const { rows } = await pool.query(
    `SELECT id, nombre, telefono, contacto, creado_en
       FROM clientes
      ORDER BY nombre ASC
      LIMIT $1 OFFSET $2`,
    [lim, off]
  );
  return rows;
}

/* ===========================================================
   Crear cliente con validaciones anti-duplicado (DB + precheck)
   - Unicidad por nombre (case-insensitive + espacios normalizados)
   - Pre-chequeo por teléfono usando solo dígitos (sin índice único)
   - Mensajes claros y códigos coherentes
   =========================================================== */
export async function crearCliente(d: ClienteCrearDTO) {
  const nombreNorm = normNombre(d.nombre);
  const telefonoOrig = safeTextOrNull(d.telefono ?? undefined);
  const telefonoDigits = phoneDigits(telefonoOrig);
  const contacto = safeTextOrNull(d.contacto ?? undefined);

  // 🔎 Pre-chequeo: duplicado por nombre normalizado (coincide con idx uniq_clientes_nombre_ci)
  const { rows: dupNombre } = await pool.query(
    `SELECT id, nombre
       FROM clientes
      WHERE lower(regexp_replace(nombre,'\\s+',' ','g'))
            = lower(regexp_replace($1,'\\s+',' ','g'))
      LIMIT 1`,
    [nombreNorm]
  );
  if (dupNombre.length > 0) {
    const err: any = new Error(
      `Ya existe un cliente con el mismo nombre (ignora mayúsculas y espacios): "${dupNombre[0].nombre}".`
    );
    err.status = 409;
    err.code = "CLIENTE_DUPLICADO_NOMBRE";
    err.constraint = "uniq_clientes_nombre_ci";
    throw err;
  }

  // 🔎 Pre-chequeo: duplicado por teléfono comparando solo dígitos (sin índice único en DDL)
  if (telefonoDigits) {
    const { rows: dupTel } = await pool.query(
      `SELECT id, telefono
         FROM clientes
        WHERE regexp_replace(COALESCE(telefono,''), '\\D', '', 'g') = $1
        LIMIT 1`,
      [telefonoDigits]
    );
    if (dupTel.length > 0) {
      const err: any = new Error(
        `Ya existe un cliente con el mismo teléfono (se comparan solo dígitos; p. ej. 477-123-4567 ≡ (477)1234567): "${dupTel[0].telefono}".`
      );
      err.status = 409;
      err.code = "CLIENTE_DUPLICADO_TELEFONO";
      // sin constraint porque no hay índice único para teléfono en el DDL
      throw err;
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO clientes (nombre, telefono, contacto)
       VALUES ($1,$2,$3)
       RETURNING id, nombre, telefono, contacto, creado_en`,
      [nombreNorm, telefonoOrig, contacto]
    );
    return rows[0];
  } catch (e: any) {
    // Violación de unicidad por nombre (del índice uniq_clientes_nombre_ci)
    if (e?.code === "23505") {
      const c = String(e?.constraint || "");
      if (c === "uniq_clientes_nombre_ci") {
        const err: any = new Error(
          "Nombre de cliente ya registrado (ignora mayúsculas y espacios)."
        );
        err.status = 409;
        err.code = "CLIENTE_DUPLICADO_NOMBRE";
        err.constraint = c;
        throw err;
      }
      const err: any = new Error("Conflicto de unicidad en clientes.");
      err.status = 409;
      err.code = "DB_CONSTRAINT";
      err.constraint = c;
      throw err;
    }

    // Otros errores de base de datos
    const err: any = new Error("Error de base de datos al crear cliente.");
    err.status = 500;
    err.code = "DB_ERROR";
    err.detail = e?.message ?? e;
    throw err;
  }
}

/* ===========================================================
   Existencia por id
   =========================================================== */
export async function existeCliente(id: number) {
  const { rows } = await pool.query(
    `SELECT 1 FROM clientes WHERE id = $1`,
    [id]
  );
  return !!rows[0];
}

// src/models/cliente.model.ts (añadir debajo de tus exports)
export async function obtenerCliente(id: number) {
  const { rows } = await pool.query(
    `SELECT id, nombre, telefono, contacto, creado_en
       FROM clientes
      WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function actualizarCliente(d: { id: number; nombre: string; telefono?: string; contacto?: string }) {
  const nombreNorm = normNombre(d.nombre);
  const telefonoOrig = safeTextOrNull(d.telefono ?? undefined);
  const contacto = safeTextOrNull(d.contacto ?? undefined);

  // Evita colisiones de nombre con otros registros (igual que en crear)
  const { rows: dupNombre } = await pool.query(
    `SELECT id FROM clientes
      WHERE lower(regexp_replace(nombre,'\\s+',' ','g'))
            = lower(regexp_replace($1,'\\s+',' ','g'))
        AND id <> $2
      LIMIT 1`,
    [nombreNorm, d.id]
  );
  if (dupNombre.length > 0) {
    const err: any = new Error("Nombre de cliente ya registrado (ignora mayúsculas y espacios).");
    err.status = 409;
    err.code = "CLIENTE_DUPLICADO_NOMBRE";
    throw err;
  }

  const { rows } = await pool.query(
    `UPDATE clientes
        SET nombre=$1, telefono=$2, contacto=$3
      WHERE id=$4
      RETURNING id, nombre, telefono, contacto, creado_en`,
    [nombreNorm, telefonoOrig, contacto, d.id]
  );
  if (!rows[0]) {
    const err: any = new Error("Cliente no encontrado");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

export async function eliminarCliente(id: number) {
  const { rows } = await pool.query(
    `DELETE FROM clientes WHERE id=$1 RETURNING id`,
    [id]
  );
  if (!rows[0]) {
    const err: any = new Error("Cliente no encontrado");
    err.status = 404;
    throw err;
  }
  return rows[0];
}
