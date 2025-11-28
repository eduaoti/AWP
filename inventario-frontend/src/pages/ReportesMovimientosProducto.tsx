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

/* ═════ Reglas de clave de producto ═════ */
const CLAVE_RE = /^[A-Za-z0-9]{2,8}$/;

function sanitizeClave(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export default function ReportesMovimientosProducto() {
  // Filtros
  const [productoClave, setProductoClave] = useState("");
  const [productoClaveError, setProductoClaveError] = useState<string | null>(
    null
  );
  const [desdeLocal, setDesdeLocal] = useState("");
  const [hastaLocal, setHastaLocal] = useState("");

  // Autocomplete productos
  const [sugerencias, setSugerencias] = useState<
    { clave: string; nombre: string }[]
  >([]);

  // Datos movimientos
  const [movimientos, setMovimientos] = useState<MovimientoProducto[]>([]);
  const [, setMetaMov] = useState<MovimientosProductoMeta | null>(null);

  // Datos ventas
  const [ventas, setVentas] = useState<VentaProducto[]>([]);

  // UI state
  const [loadingMov, setLoadingMov] = useState(false);
  const [loadingVentas, setLoadingVentas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ===========================
      Autocompletar productos
     =========================== */
  async function handleBuscarProducto(raw: string) {
    const clean = sanitizeClave(raw);
    setProductoClave(clean);
    setError(null);

    if (!clean) {
      setProductoClaveError("La clave es obligatoria para buscar.");
      setSugerencias([]);
      return;
    }

    if (clean.length < 2) {
      setProductoClaveError(
        "La clave debe tener al menos 2 caracteres (solo letras y números)."
      );
      setSugerencias([]);
      return;
    }

    if (!CLAVE_RE.test(clean)) {
      setProductoClaveError(
        "La clave debe tener entre 2 y 8 caracteres, solo letras y números (sin espacios ni símbolos)."
      );
      setSugerencias([]);
      return;
    }

    setProductoClaveError(null);

    try {
      const res = await buscarProductos(clean);
      setSugerencias(res.map((p) => ({ clave: p.clave, nombre: p.nombre })));
    } catch {
      setSugerencias([]);
    }
  }

  /* ===========================
      Cargar movimientos
     =========================== */
  async function loadMovimientos(offset = 0) {
    try {
      setLoadingMov(true);
      setError(null);

      const clave = productoClave.trim();
      const desdeIso = toIsoZ(desdeLocal);
      const hastaIso = toIsoZ(hastaLocal);

      if (!clave) {
        const msg = "Debes capturar la clave del producto.";
        setProductoClaveError(msg);
        setError(msg);
        return;
      }

      if (!CLAVE_RE.test(clave)) {
        const msg =
          "La clave debe tener entre 2 y 8 caracteres, solo letras y números (sin espacios ni símbolos).";
        setProductoClaveError(msg);
        setError(msg);
        return;
      }

      const res = await fetchMovimientosPorProducto({
        productoClave: clave,
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
    const clave = productoClave.trim();
    if (!CLAVE_RE.test(clave)) {
      setProductoClaveError(
        "La clave debe tener entre 2 y 8 caracteres, solo letras y números (sin espacios ni símbolos)."
      );
      return;
    }
    loadMovimientos(0);
    loadVentas();
  }

  /* ===========================
      Exportar PDF / Excel
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

  const claveValida = CLAVE_RE.test(productoClave.trim());

  /* ===========================
      Render
     =========================== */
  return (
    <>
      <PrivateNavbar />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <h1 className="text-2xl font-bold mb-4">
          Reportes Movimientos por Producto
        </h1>

        {/* Filtros */}
        <form onSubmit={handleBuscar} className="grid gap-4 md:grid-cols-4 mb-6">
          {/* CLAVE */}
          <div className="col-span-1 relative">
            <label className="block text-sm mb-1">
              Clave producto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={productoClave}
              onChange={(e) => handleBuscarProducto(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Ej. PLA006"
              autoComplete="off"
              maxLength={8}
            />
            {productoClaveError && (
              <p className="text-xs text-red-600 mt-1">{productoClaveError}</p>
            )}
            {sugerencias.length > 0 && (
              <div className="absolute z-10 bg-white border w-full rounded shadow text-sm mt-1">
                {sugerencias.map((s) => (
                  <div
                    key={s.clave}
                    className="px-3 py-2 hover:bg-slate-100 cursor-pointer"
                    onClick={() => {
                      setProductoClave(s.clave);
                      setProductoClaveError(null);
                      setSugerencias([]);
                    }}
                  >
                    <strong>{s.clave}</strong> — {s.nombre}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DESDE */}
          <div>
            <label className="block text-sm mb-1">Desde</label>
            <input
              type="datetime-local"
              value={desdeLocal}
              onChange={(e) => setDesdeLocal(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* HASTA */}
          <div>
            <label className="block text-sm mb-1">Hasta</label>
            <input
              type="datetime-local"
              value={hastaLocal}
              onChange={(e) => setHastaLocal(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {/* BOTÓN – con label invisible para alinear */}
          <div className="flex flex-col justify-end">
            <label className="block text-sm mb-1 invisible">Acción</label>
            <Button
              type="submit"
              className="w-full bg-indigo-600 text-white"
              disabled={!claveValida || loadingMov || loadingVentas}
              title={
                !claveValida
                  ? "La clave debe tener entre 2 y 8 caracteres, solo letras y números."
                  : ""
              }
            >
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
              <Button onClick={exportPDF} disabled={!movimientos.length}>
                PDF
              </Button>
              <Button onClick={exportExcel} disabled={!movimientos.length}>
                Excel
              </Button>
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
                    <td
                      colSpan={5}
                      className="text-center py-4 text-slate-500"
                    >
                      Sin datos
                    </td>
                  </tr>
                )}
                {movimientos.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2">
                      {new Date(m.fecha).toLocaleString()}
                    </td>
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
                    <td className="px-3 py-2 font-medium">
                      {v.total_vendido}
                    </td>
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
