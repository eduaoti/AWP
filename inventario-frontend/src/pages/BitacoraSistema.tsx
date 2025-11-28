// src/pages/BitacoraSistema.tsx
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { fetchBitacoraSistema } from "../api/bitacora";
import type { BitacoraSistema } from "../api/bitacora";

// Regex estrictos
const USER_ID_RE = /^[0-9]{1,9}$/;
// Empieza con letra, resto letras/números/_ , 3–40 caracteres en total
const TABLE_RE = /^[A-Za-z][A-Za-z0-9_]{2,39}$/;
// ISO estricto con Z: 2025-01-01T00:00:00Z
const ISO_Z_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function parseIsoZ(s: string): Date | null {
  if (!ISO_Z_RE.test(s)) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export default function BitacoraSistemaPage() {
  const [rows, setRows] = useState<BitacoraSistema[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [usuarioId, setUsuarioId] = useState("");
  const [tabla, setTabla] = useState("");
  const [operacion, setOperacion] = useState<
    "" | "CREATE" | "UPDATE" | "DELETE"
  >("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // Errores por campo
  const [usuarioIdError, setUsuarioIdError] = useState<string | null>(null);
  const [tablaError, setTablaError] = useState<string | null>(null);
  const [desdeError, setDesdeError] = useState<string | null>(null);
  const [hastaError, setHastaError] = useState<string | null>(null);

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

  /* ───────────────── VALIDACIÓN GLOBAL ───────────────── */

  function validateFilters(): boolean {
    let ok = true;
    setUsuarioIdError(null);
    setTablaError(null);
    setDesdeError(null);
    setHastaError(null);
    setError(null);

    const uid = usuarioId.trim();
    const t = tabla.trim();
    const d = desde.trim();
    const h = hasta.trim();

    // Usuario ID
    if (uid) {
      if (!USER_ID_RE.test(uid)) {
        setUsuarioIdError(
          "Solo dígitos (1 a 9 caracteres), sin espacios ni símbolos."
        );
        ok = false;
      } else if (Number(uid) <= 0) {
        setUsuarioIdError("El ID de usuario debe ser un entero positivo.");
        ok = false;
      }
    }

    // Tabla
    if (t) {
      if (!TABLE_RE.test(t)) {
        setTablaError(
          "Solo letras, números y guion bajo. Debe iniciar con letra y tener entre 3 y 40 caracteres."
        );
        ok = false;
      }
    }

    // Fechas
    let dDate: Date | null = null;
    let hDate: Date | null = null;

    if (d) {
      dDate = parseIsoZ(d);
      if (!dDate) {
        setDesdeError(
          "Formato inválido. Usa YYYY-MM-DDTHH:MM:SSZ (ej. 2025-01-01T00:00:00Z)."
        );
        ok = false;
      }
    }

    if (h) {
      hDate = parseIsoZ(h);
      if (!hDate) {
        setHastaError(
          "Formato inválido. Usa YYYY-MM-DDTHH:MM:SSZ (ej. 2025-12-31T23:59:59Z)."
        );
        ok = false;
      }
    }

    // Comparación de rango si ambas son válidas
    if (dDate && hDate) {
      if (dDate > hDate) {
        setHastaError("La fecha 'Hasta' no puede ser menor que 'Desde'.");
        ok = false;
      }

      // Anti-rango absurdo (más de 10 años hacia el futuro)
      const now = new Date();
      const maxFuture = new Date(now);
      maxFuture.setFullYear(now.getFullYear() + 10);
      if (hDate > maxFuture) {
        setHastaError(
          "La fecha 'Hasta' no puede ser más de 10 años en el futuro."
        );
        ok = false;
      }
    }

    if (!ok) {
      setError(
        "Corrige los errores de los filtros antes de consultar la bitácora."
      );
    }

    return ok;
  }

  /* ───────────────── CARGA DE DATOS ───────────────── */

  async function cargarDatos(p = page) {
    try {
      setLoading(true);
      setError(null);

      const res = await fetchBitacoraSistema({
        page: p,
        pageSize,
        usuarioId: usuarioId.trim()
          ? Number(usuarioId.trim())
          : undefined,
        tabla: tabla.trim() || undefined,
        operacion: operacion || undefined,
        desde: desde.trim() || undefined,
        hasta: hasta.trim() || undefined,
      });

      setRows(res.rows);
      setPage(res.page);
      setTotal(res.total);
    } catch (err: any) {
      const msg =
        err?.data?.mensaje ||
        err?.response?.data?.mensaje ||
        err?.message ||
        "Error al cargar la bitácora de sistema";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Carga inicial sin filtros (todos válidos vacíos)
    cargarDatos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateFilters()) return;
    cargarDatos(1);
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return;
    if (!validateFilters()) return;
    cargarDatos(nextPage);
  }

  /* ───────────────── RENDER ───────────────── */

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">
        Bitácora de cambios en el sistema
      </h1>

      {/* Filtros */}
      <form
        onSubmit={handleSubmit}
        className="mb-4 grid gap-2 md:grid-cols-5 bg-gray-50 rounded-lg p-3"
      >
        {/* Usuario ID */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Usuario ID
          </label>
          <input
            type="text"
            value={usuarioId}
            onChange={(e) => {
              const v = e.target.value.trim();
              setUsuarioId(v);
              if (!v) {
                setUsuarioIdError(null);
              } else if (!USER_ID_RE.test(v)) {
                setUsuarioIdError(
                  "Solo dígitos (1 a 9 caracteres), sin espacios ni símbolos."
                );
              } else if (Number(v) <= 0) {
                setUsuarioIdError(
                  "El ID de usuario debe ser un entero positivo."
                );
              } else {
                setUsuarioIdError(null);
              }
            }}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="Ej: 1"
          />
          {usuarioIdError && (
            <p className="text-xs text-red-600 mt-1">{usuarioIdError}</p>
          )}
        </div>

        {/* Tabla */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Tabla
          </label>
          <input
            type="text"
            value={tabla}
            onChange={(e) => {
              const v = e.target.value.trim();
              setTabla(v);
              if (!v) {
                setTablaError(null);
              } else if (!TABLE_RE.test(v)) {
                setTablaError(
                  "Solo letras, números y guion bajo. Debe iniciar con letra y tener entre 3 y 40 caracteres."
                );
              } else {
                setTablaError(null);
              }
            }}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="productos, movimientos..."
          />
          {tablaError && (
            <p className="text-xs text-red-600 mt-1">{tablaError}</p>
          )}
        </div>

        {/* Operación */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Operación
          </label>
          <select
            value={operacion}
            onChange={(e) =>
              setOperacion(e.target.value as "" | "CREATE" | "UPDATE" | "DELETE")
            }
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        {/* Desde */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Desde
          </label>
          <input
            type="text"
            value={desde}
            onChange={(e) => {
              const v = e.target.value.trim();
              setDesde(v);
              if (!v) {
                setDesdeError(null);
              } else if (!ISO_Z_RE.test(v)) {
                setDesdeError(
                  "Formato inválido. Usa YYYY-MM-DDTHH:MM:SSZ."
                );
              } else if (!parseIsoZ(v)) {
                setDesdeError("Fecha/hora inválida.");
              } else {
                setDesdeError(null);
              }
            }}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="2025-01-01T00:00:00Z"
          />
          {desdeError && (
            <p className="text-xs text-red-600 mt-1">{desdeError}</p>
          )}
        </div>

        {/* Hasta */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Hasta
          </label>
          <input
            type="text"
            value={hasta}
            onChange={(e) => {
              const v = e.target.value.trim();
              setHasta(v);
              if (!v) {
                setHastaError(null);
              } else if (!ISO_Z_RE.test(v)) {
                setHastaError(
                  "Formato inválido. Usa YYYY-MM-DDTHH:MM:SSZ."
                );
              } else if (!parseIsoZ(v)) {
                setHastaError("Fecha/hora inválida.");
              } else {
                setHastaError(null);
              }
            }}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="2025-12-31T23:59:59Z"
          />
          {hastaError && (
            <p className="text-xs text-red-600 mt-1">{hastaError}</p>
          )}
        </div>

        <div className="md:col-span-5 flex justify-end mt-2">
          <button
            type="submit"
            className="px-4 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Cargando..." : "Filtrar"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-xs md:text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 text-left">ID</th>
              <th className="px-2 py-1 text-left">Fecha</th>
              <th className="px-2 py-1 text-left">Usuario</th>
              <th className="px-2 py-1 text-left">Tabla</th>
              <th className="px-2 py-1 text-left">Registro</th>
              <th className="px-2 py-1 text-left">Operación</th>
              <th className="px-2 py-1 text-left">IP</th>
              <th className="px-2 py-1 text-left">User-Agent</th>
              <th className="px-2 py-1 text-left">Antes</th>
              <th className="px-2 py-1 text-left">Después</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-3 text-center text-gray-500"
                >
                  Sin registros para los filtros actuales.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-2 py-1">{r.id}</td>
                <td className="px-2 py-1">
                  {new Date(r.fecha).toLocaleString()}
                </td>
                <td className="px-2 py-1">
                  {r.usuario_id ?? (
                    <span className="text-gray-400">–</span>
                  )}
                </td>
                <td className="px-2 py-1">{r.tabla}</td>
                <td className="px-2 py-1">
                  {r.registro_id ?? (
                    <span className="text-gray-400">–</span>
                  )}
                </td>
                <td className="px-2 py-1">{r.operacion}</td>
                <td className="px-2 py-1">{r.ip || "–"}</td>
                <td className="px-2 py-1">
                  <span className="line-clamp-2">
                    {r.user_agent || "–"}
                  </span>
                </td>
                <td className="px-2 py-1 max-w-xs">
                  <pre className="whitespace-pre-wrap text-[11px] bg-gray-50 rounded p-1 max-h-32 overflow-auto">
                    {r.valores_antes
                      ? JSON.stringify(r.valores_antes, null, 2)
                      : "–"}
                  </pre>
                </td>
                <td className="px-2 py-1 max-w-xs">
                  <pre className="whitespace-pre-wrap text-[11px] bg-gray-50 rounded p-1 max-h-32 overflow-auto">
                    {r.valores_despues
                      ? JSON.stringify(r.valores_despues, null, 2)
                      : "–"}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <div>
          Página {page} de {totalPages} — {total} registros
        </div>
        <div className="space-x-2">
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            disabled={page <= 1 || loading}
            onClick={() => goToPage(page - 1)}
          >
            Anterior
          </button>
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            disabled={page >= totalPages || loading}
            onClick={() => goToPage(page + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
