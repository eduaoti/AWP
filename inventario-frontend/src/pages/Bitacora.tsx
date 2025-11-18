// src/pages/Bitacora.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import PrivateNavbar from "../components/PrivateNavbar";
import Button from "../components/Button";

import {
  fetchBitacoraAccesos,
  fetchBitacoraMovimientos,
  fetchBitacoraSistema,
  type BitacoraAcceso,
  type BitacoraMovimiento,
  type BitacoraSistema,
} from "../api/bitacora";

type TabId = "accesos" | "movimientos" | "sistema";

type DiffRow = {
  campo: string;
  antes: any;
  despues: any;
  cambiado: boolean;
};

export default function Bitacora() {
  const [tab, setTab] = useState<TabId>("accesos");

  // --------- Datos por pestaña ---------
  const [accRows, setAccRows] = useState<BitacoraAcceso[]>([]);
  const [movRows, setMovRows] = useState<BitacoraMovimiento[]>([]);
  const [sisRows, setSisRows] = useState<BitacoraSistema[]>([]);

  const [totalAcc, setTotalAcc] = useState(0);
  const [totalMov, setTotalMov] = useState(0);
  const [totalSis, setTotalSis] = useState(0);

  // --------- Paginación global por pestaña ---------
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // --------- Filtros compartidos ---------
  const [usuarioId, setUsuarioId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // Accesos
  const [metodo, setMetodo] = useState("");
  const [exito, setExito] = useState<"" | "true" | "false">("");

  // Movimientos
  const [tipoMov, setTipoMov] = useState<"" | "entrada" | "salida">("");
  const [productoId, setProductoId] = useState("");
  const [almacenId, setAlmacenId] = useState("");
  const [proveedorId, setProveedorId] = useState("");

  // Sistema
  const [tabla, setTabla] = useState("");
  const [operacion, setOperacion] = useState<"" | "CREATE" | "UPDATE" | "DELETE">("");

  // --------- Estado general ---------
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --------- Modal comparación Antes/Después ---------
  const [diffModalRow, setDiffModalRow] = useState<BitacoraSistema | null>(null);

  // =====================================================
  // Helpers
  // =====================================================

  function getTotalActual() {
    switch (tab) {
      case "accesos":
        return totalAcc;
      case "movimientos":
        return totalMov;
      case "sistema":
        return totalSis;
      default:
        return 0;
    }
  }

  const totalActual = getTotalActual();
  const totalPages = Math.max(1, Math.ceil(totalActual / pageSize));

  // Resumen simple para “tarjetitas” por pestaña
  const resumenAccesos = useMemo(() => {
    if (accRows.length === 0) return { ok: 0, fail: 0 };
    let ok = 0;
    let fail = 0;
    accRows.forEach((r) => {
      if (r.exito) ok++;
      else fail++;
    });
    return { ok, fail };
  }, [accRows]);

  const resumenMovimientos = useMemo(() => {
    if (movRows.length === 0) return { entradas: 0, salidas: 0 };
    let entradas = 0;
    let salidas = 0;
    movRows.forEach((r) => {
      if (r.tipo === "entrada") entradas++;
      else if (r.tipo === "salida") salidas++;
    });
    return { entradas, salidas };
  }, [movRows]);

  const resumenSistema = useMemo(() => {
    if (sisRows.length === 0) return { create: 0, update: 0, del: 0 };
    let create = 0;
    let update = 0;
    let del = 0;
    sisRows.forEach((r) => {
      if (r.operacion === "CREATE") create++;
      else if (r.operacion === "UPDATE") update++;
      else if (r.operacion === "DELETE") del++;
    });
    return { create, update, del };
  }, [sisRows]);

  // =====================================================
  // Carga de datos
  // =====================================================
  async function loadData(p: number, currentTab: TabId) {
    try {
      setLoading(true);
      setError(null);

      if (currentTab === "accesos") {
        const res = await fetchBitacoraAccesos({
          page: p,
          pageSize,
          userId: usuarioId ? Number(usuarioId) : undefined,
          metodo: metodo || undefined,
          exito: exito === "" ? undefined : exito === "true",
          desde: desde || undefined,
          hasta: hasta || undefined,
        });
        setAccRows(res.rows);
        setTotalAcc(res.total);
      } else if (currentTab === "movimientos") {
        const res = await fetchBitacoraMovimientos({
          page: p,
          pageSize,
          usuarioId: usuarioId ? Number(usuarioId) : undefined,
          tipo: tipoMov || undefined,
          productoId: productoId ? Number(productoId) : undefined,
          almacenId: almacenId ? Number(almacenId) : undefined,
          proveedorId: proveedorId ? Number(proveedorId) : undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
        });
        setMovRows(res.rows);
        setTotalMov(res.total);
      } else {
        const res = await fetchBitacoraSistema({
          page: p,
          pageSize,
          usuarioId: usuarioId ? Number(usuarioId) : undefined,
          tabla: tabla || undefined,
          operacion: operacion || undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
        });
        setSisRows(res.rows);
        setTotalSis(res.total);
      }

      setPage(p);
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.data?.mensaje ||
        e?.response?.data?.mensaje ||
        e?.message ||
        "Ocurrió un error al cargar la bitácora.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Primera carga
  useEffect(() => {
    loadData(1, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Buscar (aplicar filtros)
  function handleSearch(e?: FormEvent) {
    if (e) e.preventDefault();
    loadData(1, tab);
  }

  function handleClearFilters() {
    setUsuarioId("");
    setDesde("");
    setHasta("");
    setMetodo("");
    setExito("");
    setTipoMov("");
    setProductoId("");
    setAlmacenId("");
    setProveedorId("");
    setTabla("");
    setOperacion("");
    loadData(1, tab);
  }

  // Paginación
  function goPrevPage() {
    if (page > 1) {
      loadData(page - 1, tab);
    }
  }

  function goNextPage() {
    if (page < totalPages) {
      loadData(page + 1, tab);
    }
  }

  // =====================================================
  // Exportar CSV
  // =====================================================
  function exportCsv() {
    let rowsToExport: any[] = [];
    let fileName = "bitacora.csv";

    if (tab === "accesos") {
      rowsToExport = accRows;
      fileName = "bitacora_accesos.csv";
    } else if (tab === "movimientos") {
      rowsToExport = movRows;
      fileName = "bitacora_movimientos.csv";
    } else {
      rowsToExport = sisRows;
      fileName = "bitacora_sistema.csv";
    }

    if (!rowsToExport || rowsToExport.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }

    const headers = Object.keys(rowsToExport[0]);
    const csvRows = [
      headers.join(","), // encabezados
      ...rowsToExport.map((row) =>
        headers
          .map((h) => {
            const val = (row as any)[h];
            if (val === null || val === undefined) return "";
            if (typeof val === "object") {
              // Para JSON (snapshot, valores_antes, etc.)
              return `"${String(JSON.stringify(val)).replace(/"/g, '""')}"`;
            }
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(",")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    link.click();
    URL.revokeObjectURL(url);
  }

  // =====================================================
  // Diff Antes / Después (Sistema)
  // =====================================================
  function buildDiffRows(row: BitacoraSistema | null): DiffRow[] {
    if (!row) return [];
    const antes = (row.valores_antes || {}) as Record<string, any>;
    const despues = (row.valores_despues || {}) as Record<string, any>;

    const campos = new Set<string>([
      ...Object.keys(antes),
      ...Object.keys(despues),
    ]);

    const diffs: DiffRow[] = [];
    campos.forEach((campo) => {
      const vAntes = antes[campo];
      const vDespues = despues[campo];
      const cambiado =
        JSON.stringify(vAntes ?? null) !== JSON.stringify(vDespues ?? null);

      diffs.push({
        campo,
        antes: vAntes,
        despues: vDespues,
        cambiado,
      });
    });
    return diffs;
  }

  const diffRows: DiffRow[] = useMemo(
    () => buildDiffRows(diffModalRow),
    [diffModalRow]
  );

  // =====================================================
  // Render
  // =====================================================
  return (
    <>
      <PrivateNavbar />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header principal */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Bitácoras del sistema
            </h1>
            <p className="text-sm text-slate-500">
              Consulta accesos, movimientos de inventario y cambios en los
              registros del sistema.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={exportCsv}
              className="bg-emerald-600 text-white px-4 py-2 rounded-md shadow hover:bg-emerald-700 text-sm"
            >
              Exportar CSV
            </Button>
          </div>
        </header>

        {/* Tabs */}
        <section className="mb-4">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <TabButton
              active={tab === "accesos"}
              onClick={() => setTab("accesos")}
            >
              Accesos
            </TabButton>
            <TabButton
              active={tab === "movimientos"}
              onClick={() => setTab("movimientos")}
            >
              Movimientos
            </TabButton>
            <TabButton
              active={tab === "sistema"}
              onClick={() => setTab("sistema")}
            >
              Cambios de sistema
            </TabButton>
          </div>
        </section>

        {/* Resumen tipo dashboard */}
        <section className="grid gap-3 grid-cols-1 sm:grid-cols-3 mb-5">
          <ResumenCard
            label="Registros en página actual"
            value={
              tab === "accesos"
                ? accRows.length
                : tab === "movimientos"
                ? movRows.length
                : sisRows.length
            }
          />
          {tab === "accesos" && (
            <>
              <ResumenCard
                label="Accesos exitosos"
                value={resumenAccesos.ok}
                tone="green"
              />
              <ResumenCard
                label="Accesos fallidos"
                value={resumenAccesos.fail}
                tone="red"
              />
            </>
          )}
          {tab === "movimientos" && (
            <>
              <ResumenCard
                label="Entradas"
                value={resumenMovimientos.entradas}
                tone="indigo"
              />
              <ResumenCard
                label="Salidas"
                value={resumenMovimientos.salidas}
                tone="amber"
              />
            </>
          )}
          {tab === "sistema" && (
            <>
              <ResumenCard
                label="CREATE"
                value={resumenSistema.create}
                tone="indigo"
              />
              <ResumenCard
                label="UPDATE"
                value={resumenSistema.update}
                tone="amber"
              />
              <ResumenCard
                label="DELETE"
                value={resumenSistema.del}
                tone="red"
              />
            </>
          )}
        </section>

        {/* Filtros avanzados */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 mb-5">
          <form
            onSubmit={handleSearch}
            className="p-4 grid gap-3 md:grid-cols-3 lg:grid-cols-4 text-sm"
          >
            {/* Filtros comunes */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Usuario ID
              </label>
              <input
                type="number"
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value)}
                className="w-full border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej: 1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Desde (ISO)
              </label>
              <input
                type="text"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="2025-01-01T00:00:00Z"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Hasta (ISO)
              </label>
              <input
                type="text"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="2025-12-31T23:59:59Z"
              />
            </div>

            {/* Filtros específicos por pestaña */}
            {tab === "accesos" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Método
                  </label>
                  <input
                    type="text"
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    className="w-full border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="password, password+totp..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Éxito
                  </label>
                  <select
                    value={exito}
                    onChange={(e) => setExito(e.target.value as any)}
                    className="w-full border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Todos</option>
                    <option value="true">Solo exitosos</option>
                    <option value="false">Solo fallidos</option>
                  </select>
                </div>
              </>
            )}

            {tab === "movimientos" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tipo
                  </label>
                  <select
                    value={tipoMov}
                    onChange={(e) => setTipoMov(e.target.value as any)}
                    className="w-full border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Todos</option>
                    <option value="entrada">Entrada</option>
                    <option value="salida">Salida</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Producto ID
                  </label>
                  <input
                    type="number"
                    value={productoId}
                    onChange={(e) => setProductoId(e.target.value)}
                    className="w-full border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="ID producto"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Almacén ID
                  </label>
                  <input
                    type="number"
                    value={almacenId}
                    onChange={(e) => setAlmacenId(e.target.value)}
                    className="w-full border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="ID almacén"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Proveedor ID
                  </label>
                  <input
                    type="number"
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                    className="w-full border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="ID proveedor"
                  />
                </div>
              </>
            )}

            {tab === "sistema" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tabla
                  </label>
                  <input
                    type="text"
                    value={tabla}
                    onChange={(e) => setTabla(e.target.value)}
                    className="w-full border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="productos, movimientos..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Operación
                  </label>
                  <select
                    value={operacion}
                    onChange={(e) => setOperacion(e.target.value as any)}
                    className="w-full border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Todas</option>
                    <option value="CREATE">CREATE</option>
                    <option value="UPDATE">UPDATE</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              </>
            )}

            {/* Botones */}
            <div className="md:col-span-3 lg:col-span-4 flex justify-end gap-2 mt-2">
              <Button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 border border-slate-300 rounded-md text-sm"
              >
                Limpiar
              </Button>
              <Button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
                disabled={loading}
              >
                {loading ? "Buscando..." : "Aplicar filtros"}
              </Button>
            </div>
          </form>
        </section>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Tabla principal */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            {tab === "accesos" && (
              <TablaAccesos rows={accRows} loading={loading} />
            )}
            {tab === "movimientos" && (
              <TablaMovimientos rows={movRows} loading={loading} />
            )}
            {tab === "sistema" && (
              <TablaSistema
                rows={sisRows}
                loading={loading}
                onDiffClick={setDiffModalRow}
              />
            )}
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-600">
            <span>
              Página {page} de {totalPages} — total registros: {totalActual}
            </span>
            <div className="space-x-2">
              <Button
                onClick={goPrevPage}
                disabled={page <= 1 || loading}
                className="px-3 py-1 rounded border border-slate-300 disabled:opacity-50"
              >
                Anterior
              </Button>
              <Button
                onClick={goNextPage}
                disabled={page >= totalPages || loading}
                className="px-3 py-1 rounded border border-slate-300 disabled:opacity-50"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Modal de diff Antes / Después */}
      {diffModalRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] p-6 overflow-auto">
            <h2 className="text-lg font-bold mb-2">
              Cambios en registro #{diffModalRow.registro_id ?? "-"} de{" "}
              <span className="font-mono">{diffModalRow.tabla}</span>
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Operación: {diffModalRow.operacion} —{" "}
              {new Date(diffModalRow.fecha).toLocaleString()}
            </p>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Campo</th>
                    <th className="px-3 py-2 text-left">Antes</th>
                    <th className="px-3 py-2 text-left">Después</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-4 text-center text-slate-500"
                      >
                        No hay información para comparar.
                      </td>
                    </tr>
                  )}
                  {diffRows.map((d) => (
                    <tr
                      key={d.campo}
                      className={
                        d.cambiado
                          ? "bg-amber-50 border-t border-slate-100"
                          : "border-t border-slate-100"
                      }
                    >
                      <td className="px-3 py-1 font-mono text-[11px]">
                        {d.campo}
                      </td>
                      <td className="px-3 py-1 align-top">
                        <pre className="whitespace-pre-wrap text-[11px] text-slate-700">
                          {d.antes === undefined
                            ? "—"
                            : JSON.stringify(d.antes, null, 2)}
                        </pre>
                      </td>
                      <td className="px-3 py-1 align-top">
                        <pre className="whitespace-pre-wrap text-[11px] text-slate-700">
                          {d.despues === undefined
                            ? "—"
                            : JSON.stringify(d.despues, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => setDiffModalRow(null)}
                className="px-4 py-2 border border-slate-300 rounded-md text-sm"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ===========================================================
   Subcomponentes de UI
   =========================================================== */

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

interface ResumenCardProps {
  label: string;
  value: number;
  tone?: "green" | "red" | "indigo" | "amber";
}

function ResumenCard({ label, value, tone = "indigo" }: ResumenCardProps) {
  const toneClasses: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    indigo: "bg-indigo-50 text-indigo-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className={`rounded-lg border border-slate-200 p-3 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

/* =============================
   Tablas
   ============================= */

function TablaAccesos({
  rows,
  loading,
}: {
  rows: BitacoraAcceso[];
  loading: boolean;
}) {
  return (
    <table className="min-w-full text-xs md:text-sm">
      <thead className="bg-slate-50">
        <tr className="text-left text-slate-600">
          <th className="px-3 py-2 font-semibold">Fecha</th>
          <th className="px-3 py-2 font-semibold">Usuario ID</th>
          <th className="px-3 py-2 font-semibold">Método</th>
          <th className="px-3 py-2 font-semibold">Éxito</th>
          <th className="px-3 py-2 font-semibold">IP</th>
          <th className="px-3 py-2 font-semibold">User Agent</th>
          <th className="px-3 py-2 font-semibold">Detalle</th>
        </tr>
      </thead>
      <tbody>
        {loading && rows.length === 0 && (
          <tr>
            <td
              colSpan={7}
              className="px-3 py-4 text-center text-slate-500"
            >
              Cargando accesos...
            </td>
          </tr>
        )}
        {!loading && rows.length === 0 && (
          <tr>
            <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
              Sin registros para los filtros actuales.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-slate-100">
            <td className="px-3 py-2">
              {new Date(r.fecha).toLocaleString()}
            </td>
            <td className="px-3 py-2">
              {r.user_id ?? <span className="text-slate-400">—</span>}
            </td>
            <td className="px-3 py-2">{r.metodo || "—"}</td>
            <td className="px-3 py-2">
              {r.exito ? (
                <span className="text-emerald-700 font-semibold">OK</span>
              ) : (
                <span className="text-red-700 font-semibold">Fallo</span>
              )}
            </td>
            <td className="px-3 py-2">{r.ip || "—"}</td>
            <td className="px-3 py-2">
              <span className="line-clamp-2">{r.user_agent || "—"}</span>
            </td>
            <td className="px-3 py-2">
              <span className="line-clamp-2">{r.detalle || "—"}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TablaMovimientos({
  rows,
  loading,
}: {
  rows: BitacoraMovimiento[];
  loading: boolean;
}) {
  return (
    <table className="min-w-full text-xs md:text-sm">
      <thead className="bg-slate-50">
        <tr className="text-left text-slate-600">
          <th className="px-3 py-2 font-semibold">Fecha mov.</th>
          <th className="px-3 py-2 font-semibold">Usuario</th>
          <th className="px-3 py-2 font-semibold">Tipo</th>
          <th className="px-3 py-2 font-semibold">Producto</th>
          <th className="px-3 py-2 font-semibold">Cantidad</th>
          <th className="px-3 py-2 font-semibold">Almacén</th>
          <th className="px-3 py-2 font-semibold">Proveedor</th>
          <th className="px-3 py-2 font-semibold">Responsable</th>
          <th className="px-3 py-2 font-semibold">Documento</th>
        </tr>
      </thead>
      <tbody>
        {loading && rows.length === 0 && (
          <tr>
            <td
              colSpan={9}
              className="px-3 py-4 text-center text-slate-500"
            >
              Cargando movimientos...
            </td>
          </tr>
        )}
        {!loading && rows.length === 0 && (
          <tr>
            <td colSpan={9} className="px-3 py-4 text-center text-slate-500">
              Sin registros para los filtros actuales.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-slate-100">
            <td className="px-3 py-2">
              {new Date(r.fecha_mov).toLocaleString()}
            </td>
            <td className="px-3 py-2">
              {r.usuario_id ?? <span className="text-slate-400">—</span>}
            </td>
            <td className="px-3 py-2">
              {r.tipo === "entrada" ? "Entrada" : "Salida"}
            </td>
            <td className="px-3 py-2">{r.producto_id}</td>
            <td className="px-3 py-2">{r.cantidad}</td>
            <td className="px-3 py-2">
              {r.almacen_id ?? <span className="text-slate-400">—</span>}
            </td>
            <td className="px-3 py-2">
              {r.proveedor_id ?? <span className="text-slate-400">—</span>}
            </td>
            <td className="px-3 py-2">{r.responsable || "—"}</td>
            <td className="px-3 py-2">{r.documento || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TablaSistema({
  rows,
  loading,
  onDiffClick,
}: {
  rows: BitacoraSistema[];
  loading: boolean;
  onDiffClick: (row: BitacoraSistema) => void;
}) {
  return (
    <table className="min-w-full text-xs md:text-sm">
      <thead className="bg-slate-50">
        <tr className="text-left text-slate-600">
          <th className="px-3 py-2 font-semibold">Fecha</th>
          <th className="px-3 py-2 font-semibold">Usuario</th>
          <th className="px-3 py-2 font-semibold">Tabla</th>
          <th className="px-3 py-2 font-semibold">Registro</th>
          <th className="px-3 py-2 font-semibold">Operación</th>
          <th className="px-3 py-2 font-semibold">IP</th>
          <th className="px-3 py-2 font-semibold">User-Agent</th>
          <th className="px-3 py-2 font-semibold text-right">Detalle</th>
        </tr>
      </thead>
      <tbody>
        {loading && rows.length === 0 && (
          <tr>
            <td
              colSpan={8}
              className="px-3 py-4 text-center text-slate-500"
            >
              Cargando cambios de sistema...
            </td>
          </tr>
        )}
        {!loading && rows.length === 0 && (
          <tr>
            <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
              Sin registros para los filtros actuales.
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-slate-100">
            <td className="px-3 py-2">
              {new Date(r.fecha).toLocaleString()}
            </td>
            <td className="px-3 py-2">
              {r.usuario_id ?? <span className="text-slate-400">—</span>}
            </td>
            <td className="px-3 py-2">{r.tabla}</td>
            <td className="px-3 py-2">
              {r.registro_id ?? <span className="text-slate-400">—</span>}
            </td>
            <td className="px-3 py-2">{r.operacion}</td>
            <td className="px-3 py-2">{r.ip || "—"}</td>
            <td className="px-3 py-2">
              <span className="line-clamp-2">
                {r.user_agent || "—"}
              </span>
            </td>
            <td className="px-3 py-2 text-right">
              <Button
                type="button"
                onClick={() => onDiffClick(r)}
                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Ver cambios
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
