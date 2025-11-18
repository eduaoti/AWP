// src/pages/BitacoraSistema.tsx
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { fetchBitacoraSistema } from "../api/bitacora";
import type { BitacoraSistema } from "../api/bitacora";

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
  const [operacion, setOperacion] = useState<"" | "CREATE" | "UPDATE" | "DELETE">("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

  async function cargarDatos(p = page) {
    try {
      setLoading(true);
      setError(null);

      const res = await fetchBitacoraSistema({
        page: p,
        pageSize,
        usuarioId: usuarioId ? Number(usuarioId) : undefined,
        tabla: tabla || undefined,
        operacion: operacion || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
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
    cargarDatos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    cargarDatos(1);
  }

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
        <div>
          <label className="block text-sm font-medium mb-1">Usuario ID</label>
          <input
            type="text"
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="Ej: 1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tabla</label>
          <input
            type="text"
            value={tabla}
            onChange={(e) => setTabla(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="productos, movimientos..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Operación</label>
          <select
            value={operacion}
            onChange={(e) => setOperacion(e.target.value as any)}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Desde</label>
          <input
            type="text"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="2025-01-01T00:00:00Z"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Hasta</label>
          <input
            type="text"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="2025-12-31T23:59:59Z"
          />
        </div>

        <div className="md:col-span-5 flex justify-end mt-2">
          <button
            type="submit"
            className="px-4 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
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
                <td colSpan={10} className="px-3 py-3 text-center text-gray-500">
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
                  {r.usuario_id ?? <span className="text-gray-400">–</span>}
                </td>
                <td className="px-2 py-1">{r.tabla}</td>
                <td className="px-2 py-1">
                  {r.registro_id ?? <span className="text-gray-400">–</span>}
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
            onClick={() => cargarDatos(page - 1)}
          >
            Anterior
          </button>
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            disabled={page >= totalPages || loading}
            onClick={() => cargarDatos(page + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
