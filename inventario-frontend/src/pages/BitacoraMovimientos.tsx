// src/pages/BitacoraMovimientos.tsx
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { fetchBitacoraMovimientos } from "../api/bitacora";
import type { BitacoraMovimiento } from "../api/bitacora";

export default function BitacoraMovimientos() {
  const [rows, setRows] = useState<BitacoraMovimiento[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [usuarioId, setUsuarioId] = useState("");
  const [tipo, setTipo] = useState<"" | "entrada" | "salida">("");
  const [productoId, setProductoId] = useState("");
  const [almacenId, setAlmacenId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

  async function cargarDatos(p = page) {
    try {
      setLoading(true);
      setError(null);

      const res = await fetchBitacoraMovimientos({
        page: p,
        pageSize,
        usuarioId: usuarioId ? Number(usuarioId) : undefined,
        tipo: tipo || undefined,
        productoId: productoId ? Number(productoId) : undefined,
        almacenId: almacenId ? Number(almacenId) : undefined,
        proveedorId: proveedorId ? Number(proveedorId) : undefined,
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
        "Error al cargar la bitácora de movimientos";
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
        Bitácora de movimientos de inventario
      </h1>

      {/* Filtros */}
      <form
        onSubmit={handleSubmit}
        className="mb-4 grid gap-2 md:grid-cols-6 bg-gray-50 rounded-lg p-3"
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
          <label className="block text-sm font-medium mb-1">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as any)}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Producto ID</label>
          <input
            type="text"
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="ID producto"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Almacén ID</label>
          <input
            type="text"
            value={almacenId}
            onChange={(e) => setAlmacenId(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="ID almacén"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Proveedor ID</label>
          <input
            type="text"
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="ID proveedor"
          />
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

        <div className="md:col-span-6 flex justify-end mt-2">
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
              <th className="px-2 py-1 text-left">Mov ID</th>
              <th className="px-2 py-1 text-left">Fecha mov</th>
              <th className="px-2 py-1 text-left">Usuario</th>
              <th className="px-2 py-1 text-left">Tipo</th>
              <th className="px-2 py-1 text-left">Producto</th>
              <th className="px-2 py-1 text-left">Cant</th>
              <th className="px-2 py-1 text-left">Almacén</th>
              <th className="px-2 py-1 text-left">Proveedor</th>
              <th className="px-2 py-1 text-left">Responsable</th>
              <th className="px-2 py-1 text-left">Documento</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={11} className="px-3 py-3 text-center text-gray-500">
                  Sin registros para los filtros actuales.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-2 py-1">{r.id}</td>
                <td className="px-2 py-1">{r.movimiento_id}</td>
                <td className="px-2 py-1">
                  {new Date(r.fecha_mov).toLocaleString()}
                </td>
                <td className="px-2 py-1">
                  {r.usuario_id ?? <span className="text-gray-400">–</span>}
                </td>
                <td className="px-2 py-1">
                  {r.tipo === "entrada" ? "Entrada" : "Salida"}
                </td>
                <td className="px-2 py-1">{r.producto_id}</td>
                <td className="px-2 py-1">{r.cantidad}</td>
                <td className="px-2 py-1">
                  {r.almacen_id ?? <span className="text-gray-400">–</span>}
                </td>
                <td className="px-2 py-1">
                  {r.proveedor_id ?? <span className="text-gray-400">–</span>}
                </td>
                <td className="px-2 py-1">{r.responsable || "–"}</td>
                <td className="px-2 py-1">{r.documento || "–"}</td>
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
