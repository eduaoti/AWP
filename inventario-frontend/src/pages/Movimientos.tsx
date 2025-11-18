// src/pages/Movimientos.tsx
import React, { useEffect, useState } from "react";
import PrivateNavbar from "../components/PrivateNavbar";
import Button from "../components/Button";
import {
  listarMovimientos,
  registrarMovimiento,
} from "../api/movimientos";
import type {
  Movimiento,
  MovimientosMeta,
  RegistrarMovimientoPayload,
} from "../api/movimientos";

const emptyForm: RegistrarMovimientoPayload = {
  entrada: true,
  producto_clave: "",
  cantidad: 0,
  documento: "",
  responsable: "",
};

export default function Movimientos() {
  const [items, setItems] = useState<Movimiento[]>([]);
  const [meta, setMeta] = useState<MovimientosMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<RegistrarMovimientoPayload>(emptyForm);
  const [showForm, setShowForm] = useState(false);

  // ==========================
  // Cargar datos
  // ==========================
  async function loadMovimientos(offset = 0) {
    try {
      setLoading(true);
      setError(null);
      const { items, meta } = await listarMovimientos({ limit: 10, offset });
      setItems(items);
      setMeta(meta);
    } catch (e: any) {
      console.error(e);
      setError("No se pudieron cargar los movimientos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMovimientos(0);
  }, []);

  // ==========================
  // Handlers formulario
  // ==========================
  function openCreate() {
    setForm(emptyForm);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      if (!form.producto_clave.trim()) {
        setError("La clave de producto es obligatoria.");
        return;
      }
      if (!form.cantidad || Number(form.cantidad) <= 0) {
        setError("La cantidad debe ser mayor a 0.");
        return;
      }

      const payload: RegistrarMovimientoPayload = {
        ...form,
        cantidad: Number(form.cantidad),
        proveedor_id: form.entrada
          ? form.proveedor_id
            ? Number(form.proveedor_id)
            : undefined
          : undefined,
        cliente_id: form.entrada
          ? undefined
          : form.cliente_id
          ? Number(form.cliente_id)
          : undefined,
      };

      await registrarMovimiento(payload);

      closeForm();
      await loadMovimientos(meta?.offset ?? 0);
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.detalle?.message ||
        e?.response?.data?.mensaje ||
        e?.message ||
        "Ocurrió un error al registrar el movimiento.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ==========================
  // Paginación (similar a Almacenes)
  // ==========================
  function goPrev() {
    if (!meta) return;
    if (meta.offset <= 0) return;
    const prevOffset = Math.max(0, meta.offset - meta.limit);
    loadMovimientos(prevOffset);
  }

  function goNext() {
    if (!meta) return;
    // Heurística: si vino la página llena (count === limit), asumimos que hay más
    if (meta.count < meta.limit) return;
    const nextOffset = meta.offset + meta.limit;
    loadMovimientos(nextOffset);
  }

  const hasPrev = !!meta && meta.offset > 0;
  const hasNext = !!meta && meta.count === meta.limit;

  // ==========================
  // Vista
  // ==========================
  return (
    <>
      <PrivateNavbar />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Administración de Movimientos
            </h1>
            <p className="text-sm text-slate-500">
              Registra y consulta las entradas y salidas de inventario.
            </p>
          </div>

          <Button
            onClick={openCreate}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700"
          >
            Nuevo movimiento
          </Button>
        </header>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-600">
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-4 py-3 font-semibold">Cantidad</th>
                  <th className="px-4 py-3 font-semibold">Documento</th>
                  <th className="px-4 py-3 font-semibold">Responsable</th>
                  <th className="px-4 py-3 font-semibold">Proveedor</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      Cargando movimientos...
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No hay movimientos registrados.
                    </td>
                  </tr>
                )}

                {items.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-2">{m.id}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(m.fecha).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          m.tipo === "entrada"
                            ? "inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                            : "inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700"
                        }
                      >
                        {m.tipo === "entrada" ? "Entrada" : "Salida"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800">
                          {m.producto_nombre}
                        </span>
                        <span className="text-xs text-slate-400">
                          {m.producto_clave}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 font-semibold">{m.cantidad}</td>
                    <td className="px-4 py-2">
                      {m.documento ? (
                        m.documento
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {m.responsable ? (
                        m.responsable
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {m.proveedor_nombre ? (
                        m.proveedor_nombre
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {m.cliente_nombre ? (
                        m.cliente_nombre
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación similar a Almacenes */}
          {meta && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-600">
              <span>
                Mostrando {meta.count} movimientos (límite {meta.limit}, offset{" "}
                {meta.offset})
              </span>
              <div className="space-x-2">
                <Button
                  onClick={goPrev}
                  disabled={!hasPrev}
                  className="px-3 py-1 rounded border border-slate-300 disabled:opacity-50"
                >
                  Anterior
                </Button>
                <Button
                  onClick={goNext}
                  disabled={!hasNext}
                  className="px-3 py-1 rounded border border-slate-300 disabled:opacity-50"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ==========================
          MODAL FORMULARIO
      =========================== */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Nuevo movimiento</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo de movimiento */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tipo de movimiento <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="tipo"
                      value="entrada"
                      checked={form.entrada === true}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          entrada: true,
                          proveedor_id: f.proveedor_id,
                          cliente_id: undefined,
                        }))
                      }
                    />
                    <span>Entrada</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="tipo"
                      value="salida"
                      checked={form.entrada === false}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          entrada: false,
                          proveedor_id: undefined,
                          cliente_id: f.cliente_id,
                        }))
                      }
                    />
                    <span>Salida</span>
                  </label>
                </div>
              </div>

              {/* Clave de producto */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Clave de producto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.producto_clave}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      producto_clave: e.target.value,
                    }))
                  }
                  placeholder="Ej: P-0001"
                  required
                />
              </div>

              {/* Cantidad */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Cantidad <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.cantidad}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cantidad: Number(e.target.value),
                    }))
                  }
                  required
                />
              </div>

              {/* Documento (opcional) */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Documento (opcional)
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.documento ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      documento: e.target.value || "",
                    }))
                  }
                  placeholder="Factura, remisión, nota..."
                />
              </div>

              {/* Responsable (opcional) */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Responsable (opcional)
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.responsable ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      responsable: e.target.value || "",
                    }))
                  }
                  placeholder="Nombre del responsable"
                />
              </div>

              {/* Proveedor / Cliente según tipo */}
              {form.entrada ? (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    ID de proveedor (opcional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.proveedor_id ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        proveedor_id: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                    placeholder="ID numérico del proveedor"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    ID de cliente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.cliente_id ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        cliente_id: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                    placeholder="ID numérico del cliente"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 border border-slate-300 rounded-md text-sm"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
                >
                  Registrar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
