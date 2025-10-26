// src/models/producto.model.ts
import { pool } from "../db";
import type {
  CreateProductoDTO,
  UpdateProductoDTO,
} from "../schemas/domain/producto.schemas";

/** Obtiene la clave a partir del DTO, aceptando clave o codigo por compat. */
function getClaveFromDTO(d: Partial<CreateProductoDTO | UpdateProductoDTO>) {
  return (d as any).clave ?? (d as any).codigo;
}

/* ===========================================================
   CRUD por CLAVE (columna 'clave' en la BD)
   =========================================================== */

export async function crearProducto(d: CreateProductoDTO) {
  const clave = getClaveFromDTO(d);
  const q = `INSERT INTO productos (clave, nombre, descripcion, categoria, unidad, precio, stock_minimo, stock_actual)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
  const { rows } = await pool.query(q, [
    clave,
    d.nombre,
    d.descripcion ?? null,
    d.categoria,
    d.unidad,
    d.precio ?? 0,
    d.stock_minimo ?? 0,
    d.stock_actual ?? 0,
  ]);
  return rows[0];
}

export async function actualizarPorClave(clave: string, data: UpdateProductoDTO) {
  const campos: string[] = [];
  const valores: any[] = [];
  let i = 1;

  for (const [k, v] of Object.entries(data)) {
    // Evitar que intenten cambiar la clave desde aquí
    if (k === "codigo" || k === "clave") continue;
    campos.push(`${k} = $${i++}`);
    valores.push(v);
  }
  if (!campos.length) return obtenerPorClave(clave);

  const q = `UPDATE productos
             SET ${campos.join(", ")}, actualizado_en = NOW()
             WHERE clave = $${i}
             RETURNING *`;
  valores.push(clave);

  const { rows } = await pool.query(q, valores);
  return rows[0] ?? null;
}

export async function eliminarPorClave(clave: string) {
  const { rows } = await pool.query(
    `DELETE FROM productos WHERE clave = $1 RETURNING *`,
    [clave]
  );
  return rows[0] ?? null;
}

export async function obtenerPorClave(clave: string) {
  const { rows } = await pool.query(
    `SELECT * FROM productos WHERE clave = $1`,
    [clave]
  );
  return rows[0] ?? null;
}

export async function actualizarStockMinimoPorClave(clave: string, stockMin: number) {
  const { rows } = await pool.query(
    `UPDATE productos
     SET stock_minimo = $1, actualizado_en = NOW()
     WHERE clave = $2
     RETURNING *`,
    [stockMin, clave]
  );
  return rows[0] ?? null;
}

/* ===========================================================
   Listado (legacy sin paginación) — se mantiene para compat
   =========================================================== */

export async function listarProductos() {
  const { rows } = await pool.query(
    `SELECT * FROM productos ORDER BY nombre ASC`
  );
  return rows;
}

/** 🚨 Alertas: productos con stock bajo (stock_actual < stock_minimo) */
export async function listarProductosBajoStock() {
  const { rows } = await pool.query(
    `SELECT * FROM productos
     WHERE stock_actual < stock_minimo
     ORDER BY (stock_minimo - stock_actual) DESC, nombre ASC`
  );
  return rows;
}

/* ===========================================================
   CRUD por NOMBRE (case-insensitive, usa índice LOWER(nombre))
   =========================================================== */

export async function obtenerPorNombre(nombre: string) {
  const { rows } = await pool.query(
    `SELECT * FROM productos WHERE LOWER(nombre) = LOWER($1)`,
    [nombre]
  );
  return rows[0] ?? null;
}

export async function actualizarPorNombre(nombre: string, data: UpdateProductoDTO) {
  const campos: string[] = [];
  const valores: any[] = [];
  let i = 1;

  for (const [k, v] of Object.entries(data)) {
    if (k === "codigo") continue; // permitir cambiar 'clave' aquí (según el esquema), pero no 'codigo' legacy
    campos.push(`${k} = $${i++}`);
    valores.push(v);
  }
  if (!campos.length) return obtenerPorNombre(nombre);

  const q = `UPDATE productos
             SET ${campos.join(", ")}, actualizado_en = NOW()
             WHERE LOWER(nombre) = LOWER($${i})
             RETURNING *`;
  valores.push(nombre);

  const { rows } = await pool.query(q, valores);
  return rows[0] ?? null;
}

export async function actualizarStockMinimoPorNombre(nombre: string, stockMin: number) {
  const { rows } = await pool.query(
    `UPDATE productos
     SET stock_minimo = $1, actualizado_en = NOW()
     WHERE LOWER(nombre) = LOWER($2)
     RETURNING *`,
    [stockMin, nombre]
  );
  return rows[0] ?? null;
}

export async function eliminarPorNombre(nombre: string) {
  const { rows } = await pool.query(
    `DELETE FROM productos WHERE LOWER(nombre) = LOWER($1) RETURNING *`,
    [nombre]
  );
  return rows[0] ?? null;
}

/* ===========================================================
   🔁 COMPAT: alias *PorCodigo → *PorClave (DEPRECADO)
   =========================================================== */

export async function actualizarPorCodigo(codigo: string, data: UpdateProductoDTO) {
  return actualizarPorClave(codigo, data);
}

export async function eliminarPorCodigo(codigo: string) {
  return eliminarPorClave(codigo);
}

export async function obtenerPorCodigo(codigo: string) {
  return obtenerPorClave(codigo);
}

export async function actualizarStockMinimoPorCodigo(codigo: string, stockMin: number) {
  return actualizarStockMinimoPorClave(codigo, stockMin);
}

/* ===========================================================
   ✅ Listado con paginación estricta (búsqueda general q)
   =========================================================== */

export type ListarProductosOpts = {
  page: number;
  perPage: number;
  sortBy?: "nombre" | "precio" | "stock_actual" | "creado_en";
  sortDir?: "asc" | "desc";
  q?: string | null;
};

export async function listarProductosPaginado(opts: ListarProductosOpts) {
  const pageRaw = Number(opts.page);
  const perRaw = Number(opts.perPage);

  if (!Number.isInteger(pageRaw) || pageRaw < 1) {
    const err: any = new Error("page → Debe ser entero ≥ 1");
    err.status = 400; err.code = "PARAMETRO_INVALIDO"; err.detail = { page: opts.page };
    throw err;
  }
  if (!Number.isInteger(perRaw) || perRaw < 1) {
    const err: any = new Error("per_page → Debe ser entero ≥ 1");
    err.status = 400; err.code = "PARAMETRO_INVALIDO"; err.detail = { per_page: opts.perPage };
    throw err;
  }

  // CAP a 100
  const PER_MAX = 100;
  const perPage = perRaw > PER_MAX ? PER_MAX : perRaw;
  const perPageCapped = perRaw > PER_MAX;

  // Sort whitelist
  const sortBy = (opts.sortBy ?? "nombre").toLowerCase();
  const sortDir = (opts.sortDir ?? "asc").toLowerCase();
  const validSortBy = new Set(["nombre", "precio", "stock_actual", "creado_en"]);
  const validSortDir = new Set(["asc", "desc"]);

  if (!validSortBy.has(sortBy)) {
    const err: any = new Error("sort_by → Valor inválido. Usa: nombre | precio | stock_actual | creado_en");
    err.status = 400; err.code = "PARAMETRO_INVALIDO"; err.detail = { sort_by: sortBy };
    throw err;
  }
  if (!validSortDir.has(sortDir)) {
    const err: any = new Error("sort_dir → Valor inválido. Usa: asc | desc");
    err.status = 400; err.code = "PARAMETRO_INVALIDO"; err.detail = { sort_dir: sortDir };
    throw err;
  }

  // Búsqueda opcional
  const q = (opts.q ?? "").trim();
  if (q.length > 0 && q.length < 2) {
    const err: any = new Error("q → Debe tener al menos 2 caracteres");
    err.status = 400; err.code = "PARAMETRO_INVALIDO"; err.detail = { q };
    throw err;
  }
  if (q.length > 120) {
    const err: any = new Error("q → Máximo 120 caracteres");
    err.status = 400; err.code = "PARAMETRO_INVALIDO"; err.detail = { q_len: q.length };
    throw err;
  }

  // Sanitiza comodines excesivos para evitar scans patológicos
  const qParam = q.replace(/[%_]{3,}/g, "%"); // colapsa patrones hiper-generales

  // Mapeo seguro para ORDER BY
  const sortMap: Record<string, string> = {
    nombre: "nombre",
    precio: "precio",
    stock_actual: "stock_actual",
    creado_en: "creado_en",
  };
  const sortCol = sortMap[sortBy];

  // COUNT total con (o sin) filtro
  const where = qParam
    ? `WHERE (LOWER(nombre) LIKE LOWER($1) OR LOWER(clave) LIKE LOWER($1) OR LOWER(categoria) LIKE LOWER($1))`
    : ``;

  const countSql = `SELECT COUNT(*)::bigint AS total FROM productos ${where}`;
  const countParams = qParam ? [`%${qParam}%`] : [];
  const countRes = await pool.query(countSql, countParams);
  const totalBig = BigInt(countRes.rows[0]?.total ?? "0");
  const total = Number(totalBig); // cabe si < 2^53

  // Calcular páginas
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(pageRaw, totalPages); // ajusta si piden > totalPages
  const pageAdjusted = page !== pageRaw;

  const offset = (page - 1) * perPage;

  // Query page
  const baseSql = `
    SELECT *
      FROM productos
      ${where}
     ORDER BY ${sortCol} ${sortDir === "desc" ? "DESC" : "ASC"}, id ASC
     LIMIT $${qParam ? 2 : 1}
    OFFSET $${qParam ? 3 : 2}
  `;
  const params = qParam ? [`%${qParam}%`, perPage, offset] : [perPage, offset];
  const { rows } = await pool.query(baseSql, params);

  const meta = {
    page,
    per_page: perPage,
    total_items: total,
    total_pages: totalPages,
    has_prev: page > 1,
    has_next: page < totalPages,
    sort_by: sortBy,
    sort_dir: sortDir,
    query: q || null,
    caps: {
      per_page_capped: perPageCapped ? { applied: perPage, original: perRaw } : null,
    },
    adjustments: {
      page_adjusted: pageAdjusted ? { applied: page, original: pageRaw } : null,
    },
  };

  return { items: rows, meta };
}

/* ===========================================================
   ✅ NUEVO: Unificado GET (clave | nombre | todos) case-insensitive
   =========================================================== */

export type FindByContainerOpts = {
  page: number;
  perPage: number;
  sortBy?: "nombre" | "precio" | "stock_actual" | "creado_en";
  sortDir?: "asc" | "desc";
  clave?: string;   // "" o undefined => sin filtro por clave
  nombre?: string;  // "" o undefined => sin filtro por nombre
};

/**
 * Unifica:
 * - clave y nombre vacíos -> todos
 * - clave con valor       -> por clave (ignora nombre)
 * - nombre con valor      -> por nombre
 * Comparación exacta case-insensitive (LOWER(...)=LOWER($)).
 */
export async function findByContainerIgnoreCase(opts: FindByContainerOpts) {
  const pageRaw = Number(opts.page);
  const perRaw  = Number(opts.perPage);

  if (!Number.isInteger(pageRaw) || pageRaw < 1) {
    const err: any = new Error("page → Debe ser entero ≥ 1");
    err.status = 400; err.code = "PARAMETRO_INVALIDO"; err.detail = { page: opts.page };
    throw err;
  }
  if (!Number.isInteger(perRaw) || perRaw < 1) {
    const err: any = new Error("per_page → Debe ser entero ≥ 1");
    err.status = 400; err.code = "PARAMETRO_INVALIDO"; err.detail = { per_page: opts.perPage };
    throw err;
  }

  const PER_MAX = 100;
  const perPage = perRaw > PER_MAX ? PER_MAX : perRaw;

  const sortBy  = (opts.sortBy ?? "nombre").toLowerCase();
  const sortDir = (opts.sortDir ?? "asc").toLowerCase();
  const validSortBy  = new Set(["nombre", "precio", "stock_actual", "creado_en"]);
  const validSortDir = new Set(["asc", "desc"]);
  if (!validSortBy.has(sortBy)) {
    const err: any = new Error("sort_by → Valor inválido. Usa: nombre | precio | stock_actual | creado_en");
    err.status = 400; err.code = "PARAMETRO_INVALIDO"; err.detail = { sort_by: sortBy };
    throw err;
  }
  if (!validSortDir.has(sortDir)) {
    const err: any = new Error("sort_dir → Valor inválido. Usa: asc | desc");
    err.status = 400; err.code = "PARAMETRO_INVALIDO"; err.detail = { sort_dir: sortDir };
    throw err;
  }

  const sortMap: Record<string, string> = {
    nombre: "nombre",
    precio: "precio",
    stock_actual: "stock_actual",
    creado_en: "creado_en",
  };
  const sortCol = sortMap[sortBy];

  const clave  = (opts.clave ?? "").trim();
  const nombre = (opts.nombre ?? "").trim();

  // Prioridad: clave > nombre > todos
  let where = "";
  let params: any[] = [];
  if (clave) {
    where = `WHERE LOWER(clave) = LOWER($1)`;
    params = [clave];
  } else if (nombre) {
    where = `WHERE LOWER(nombre) = LOWER($1)`;
    params = [nombre];
  }

  // COUNT
  const countSql = `SELECT COUNT(*)::bigint AS total FROM productos ${where}`;
  const countRes = await pool.query(countSql, params);
  const total = Number(BigInt(countRes.rows[0]?.total ?? "0"));
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(pageRaw, totalPages);
  const offset = (page - 1) * perPage;

  // PAGE
  const pageSql = `
    SELECT *
      FROM productos
      ${where}
     ORDER BY ${sortCol} ${sortDir === "desc" ? "DESC" : "ASC"}, id ASC
     LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;
  const { rows } = await pool.query(pageSql, [...params, perPage, offset]);

  return {
    items: rows,
    meta: {
      page,
      per_page: perPage,
      total_items: total,
      total_pages: totalPages,
      has_prev: page > 1,
      has_next: page < totalPages,
      sort_by: sortBy,
      sort_dir: sortDir,
      filters: {
        by: clave ? "clave" : (nombre ? "nombre" : "todos"),
        clave: clave || null,
        nombre: nombre || null,
      },
    },
  };
}
