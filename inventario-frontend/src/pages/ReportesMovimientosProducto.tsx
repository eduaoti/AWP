// src/pages/ReportesMovimientosProducto.tsx
import React, { useEffect, useState } from "react";
import PrivateNavbar from "../components/PrivateNavbar";
import Button from "../components/Button";

import {
  fetchMovimientosPorProducto,
  fetchVentasPorProducto,
  toIsoZ,
  type MovimientoProducto,
  type MovimientosProductoMeta,
  type VentaProducto,
} from "../api/reportes";

import { buscarProductos } from "../api/productos";

// PDF & Excel
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// Recharts
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function ReportesMovimientosProducto() {
  // Filtros
  const [productoClave, setProductoClave] = useState("");
  const [desdeLocal, setDesdeLocal] = useState("");
  const [hastaLocal, setHastaLocal] = useState("");

  // Autocomplete productos
  const [sugerencias, setSugerencias] = useState<{ clave: string; nombre: string }[]>([]);

  // Datos movimientos
  const [movimientos, setMovimientos] = useState<MovimientoProducto[]>([]);
  const [metaMov, setMetaMov] = useState<MovimientosProductoMeta | null>(null);

  // Datos ventas
  const [ventas, setVentas] = useState<VentaProducto[]>([]);

  // UI state
  const [loadingMov, setLoadingMov] = useState(false);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ===========================
      Autocompletar productos
     =========================== */
  async function handleBuscarProducto(q: string) {
    setProductoClave(q);
    if (q.trim().length < 2) {
      setSugerencias([]);
      return;
    }
    try {
      const res = await buscarProductos(q.trim());
      setSugerencias(res.map((p) => ({ clave: p.clave, nombre: p.nombre })));
    } catch (_) {}
  }

  /* ===========================
      Cargar movimientos
     =========================== */
  async function loadMovimientos(offset = 0) {
    try {
      setLoadingMov(true);
      setError(null);

      const desdeIso = toIsoZ(desdeLocal);
      const hastaIso = toIsoZ(hastaLocal);

      if (!productoClave.trim()) {
        setError("Debes capturar la clave del producto.");
        return;
      }

      const res = await fetchMovimientosPorProducto({
        productoClave: productoClave.trim(),
        limit: 20,
        offset,
        desdeIso,
        hastaIso,
      });

      setMovimientos(res.items);
      setMetaMov(res.meta);
    } catch (e: any) {
      setError(
        e?.response?.data?.mensaje ||
        "No se pudieron cargar los movimientos del producto."
      );
    } finally {
      setLoadingMov(false);
    }
  }

  /* ===========================
      Cargar ventas (ranking)
     =========================== */
  async function loadVentas() {
    try {
      setLoadingVentas(true);
      setError(null);

      const desdeIso = toIsoZ(desdeLocal);
      const hastaIso = toIsoZ(hastaLocal);

      if (!desdeIso || !hastaIso) {
        setError("Debes seleccionar un rango de fechas válido.");
        return;
      }

      const res = await fetchVentasPorProducto({ desdeIso, hastaIso });
      setVentas(res.items);
    } catch (e: any) {
      setError(
        e?.response?.data?.mensaje ||
        "No se pudieron cargar las ventas por producto."
      );
    } finally {
      setLoadingVentas(false);
    }
  }

  /* ===========================
      Buscar ambos
     =========================== */
  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    loadMovimientos(0);
    loadVentas();
  }

  /* ===========================
      Exportar PDF
     =========================== */
  function exportPDF() {
    const doc = new jsPDF();
    doc.text("Movimientos del producto " + productoClave, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Fecha", "Tipo", "Cant.", "Doc.", "Resp."]],
      body: movimientos.map((m) => [
        new Date(m.fecha).toLocaleString(),
        m.tipo,
        m.cantidad,
        m.documento ?? "",
        m.responsable ?? "",
      ]),
    });
    doc.save(`movimientos_${productoClave}_${Date.now()}.pdf`);
  }

  /* ===========================
      Exportar Excel
     =========================== */
  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(movimientos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
    XLSX.writeFile(wb, `movimientos_${productoClave}_${Date.now()}.xlsx`);
  }

  /* ===========================
      Inicializar fechas últimos 7 días
     =========================== */
  useEffect(() => {
    const now = new Date();
    const before = new Date();
    before.setDate(now.getDate() - 7);

    const toLocal = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

    setDesdeLocal(toLocal(before));
    setHastaLocal(toLocal(now));
  }, []);

  const barData = [
    {
      name: "Movimientos",
      Entradas: movimientos.filter((m) => m.tipo === "entrada").length,
      Salidas: movimientos.filter((m) => m.tipo === "salida").length,
    },
  ];

  /* ===========================
      Render
     =========================== */
  return (
    <>
      <PrivateNavbar />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <h1 className="text-2xl font-bold mb-4">Reportes Movimientos por Producto</h1>

        {/* Filtros */}
        <form onSubmit={handleBuscar} className="grid gap-4 md:grid-cols-4 mb-6">
          <div className="col-span-1 relative">
            <label className="block text-sm mb-1">Clave producto</label>
            <input
              type="text"
              value={productoClave}
              onChange={(e) => handleBuscarProducto(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Ej. PLA006"
              autoComplete="off"
            />
            {sugerencias.length > 0 && (
              <div className="absolute z-10 bg-white border w-full rounded shadow text-sm">
                {sugerencias.map((s) => (
                  <div
                    key={s.clave}
                    className="px-3 py-2 hover:bg-slate-100 cursor-pointer"
                    onClick={() => {
                      setProductoClave(s.clave);
                      setSugerencias([]);
                    }}
                  >
                    <strong>{s.clave}</strong> — {s.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm mb-1">Desde</label>
            <input
              type="datetime-local"
              value={desdeLocal}
              onChange={(e) => setDesdeLocal(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Hasta</label>
            <input
              type="datetime-lowhYELLOWl"
              value={hastaLocal}
              onChange={(e) => setHastaLocal(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <Button type="submit" className="w-full bg-indigo-600 text-white">
              {loadingMov || loadingVentas ? "Consultando..." : "Consultar"}
            </Button>
          </div>
        </form>

        {error && <p className="text-red-600 mb-4">{error}</p>}

        {/* Gráfica entradas vs salidas */}
        <section className="bg-white border rounded p-4 mb-6">
          <h2 className="font-semibold mb-2 text-sm">Entradas vs Salidas</h2>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Entradas" fill="#4ade80" />
                <Bar dataKey="Salidas" fill="#f87171" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Tabla movimientos */}
        <section className="bg-white border rounded p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold text-sm">Movimientos</h2>
            <div className="flex gap-2">
              <Button onClick={exportPDF}>PDF</Button>
              <Button onClick={exportExcel}>Excel</Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Cantidad</th>
                  <th className="px-3 py-2">Documento</th>
                  <th className="px-3 py-2">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {!loadingMov && movimientos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-slate-500">
                      Sin datos
                    </td>
                  </tr>
                )}
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2">{new Date(m.fecha).toLocaleString()}</td>
                    <td className="px-3 py-2">{m.tipo}</td>
                    <td className="px-3 py-2 font-medium">{m.cantidad}</td>
                    <td className="px-3 py-2">{m.documento ?? "—"}</td>
                    <td className="px-3 py-2">{m.responsable ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ranking ventas */}
        <section className="bg-white border rounded p-4">
          <h2 className="font-semibold text-sm mb-2">Ventas Ranking</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Clave</th>
                  <th className="px-3 py-2">Total vendido</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.producto_id} className="border-t">
                    <td className="px-3 py-2">{v.nombre}</td>
                    <td className="px-3 py-2">{v.clave}</td>
                    <td className="px-3 py-2 font-medium">{v.total_vendido}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
