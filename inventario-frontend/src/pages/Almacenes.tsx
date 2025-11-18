// src/pages/Almacenes.tsx
import React, { useEffect, useState } from "react";
import PrivateNavbar from "../components/PrivateNavbar";
import Button from "../components/Button";
import {
  listarAlmacenes,
  crearAlmacen,
  actualizarAlmacen,
  eliminarAlmacen,
  type Almacen,
  type AlmacenesMeta,
} from "../api/almacenes";

type FormMode = "create" | "edit";

const emptyForm = {
  id: 0,
  nombre: "",
  telefono: "",
  contacto: "",
};

export default function Almacenes() {
  const [items, setItems] = useState<Almacen[]>([]);
  const [meta, setMeta] = useState<AlmacenesMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState<FormMode>("create");
  const [showForm, setShowForm] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Almacen | null>(null);

  // ==========================
  // Cargar datos
  // ==========================
  async function loadAlmacenes(offset = 0) {
    try {
      setLoading(true);
      setError(null);
      const res = await listarAlmacenes({ limit: 10, offset });
      setItems(res.items);
      setMeta(res.meta);
    } catch (e: any) {
      console.error(e);
      setError("No se pudieron cargar los almacenes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlmacenes(0);
  }, []);

  // ==========================
  // Handlers formulario
  // ==========================
  function openCreate() {
    setMode("create");
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(a: Almacen) {
    setMode("edit");
    setForm({
      id: a.id,
      nombre: a.nombre,
      telefono: a.telefono ?? "",
      contacto: a.contacto ?? "",
    });
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

      if (!form.nombre.trim()) {
        setError("El nombre es obligatorio.");
        return;
      }

      if (mode === "create") {
        await crearAlmacen({
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          contacto: form.contacto || undefined,
        });
      } else {
        await actualizarAlmacen({
          id: form.id,
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          contacto: form.contacto || undefined,
        });
      }

      closeForm();
      await loadAlmacenes(meta?.offset ?? 0);
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.detalle?.message ||
        e?.response?.data?.mensaje ||
        "Ocurrió un error al guardar el almacén.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ==========================
  // Eliminar
  // ==========================
  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setLoading(true);
      setError(null);
      await eliminarAlmacen(deleteTarget.id);
      setDeleteTarget(null);
      await loadAlmacenes(meta?.offset ?? 0);
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.response?.data?.detalle?.message ||
        e?.response?.data?.mensaje ||
        "Ocurrió un error al eliminar el almacén.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ==========================
  // Paginación
  // ==========================
  function goPrev() {
    if (meta?.hasPrev && meta.prevOffset != null) {
      loadAlmacenes(meta.prevOffset);
    }
  }

  function goNext() {
    if (meta?.hasNext && meta.nextOffset != null) {
      loadAlmacenes(meta.nextOffset);
    }
  }

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
              Administración de Almacenes
            </h1>
            <p className="text-sm text-slate-500">
              Registra, edita, consulta y elimina almacenes del sistema de
              inventario.
            </p>
          </div>

          <Button
            onClick={openCreate}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700"
          >
            Nuevo almacén
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
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Teléfono</th>
                  <th className="px-4 py-3 font-semibold">Contacto</th>
                  <th className="px-4 py-3 font-semibold">Creado</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      Cargando almacenes...
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No hay almacenes registrados.
                    </td>
                  </tr>
                )}

                {items.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-2">{a.id}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">
                      {a.nombre}
                    </td>
                    <td className="px-4 py-2">
                      {a.telefono ? a.telefono : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      {a.contacto ? a.contacto : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(a.creado_en).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <Button
                        onClick={() => openEdit(a)}
                        className="px-3 py-1 text-xs bg-amber-500 text-white rounded-md hover:bg-amber-600"
                      >
                        Editar
                      </Button>
                      <Button
                        onClick={() => setDeleteTarget(a)}
                        className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600"
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {meta && meta.total > meta.limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-600">
              <span>
                Mostrando {meta.returned} de {meta.total} almacenes
              </span>
              <div className="space-x-2">
                <Button
                  onClick={goPrev}
                  disabled={!meta.hasPrev}
                  className="px-3 py-1 rounded border border-slate-300 disabled:opacity-50"
                >
                  Anterior
                </Button>
                <Button
                  onClick={goNext}
                  disabled={!meta.hasNext}
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
            <h2 className="text-lg font-bold mb-4">
              {mode === "create" ? "Nuevo almacén" : "Editar almacén"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Teléfono (opcional)
                </label>
                <input
                  type="tel"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.telefono}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, telefono: e.target.value }))
                  }
                  placeholder="Solo dígitos"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Contacto (opcional)
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.contacto}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contacto: e.target.value }))
                  }
                />
              </div>

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
                  {mode === "create" ? "Guardar" : "Actualizar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================
          MODAL ELIMINAR
      =========================== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <h2 className="text-lg font-bold mb-3">Eliminar almacén</h2>
            <p className="text-sm text-slate-600 mb-4">
              ¿Seguro que deseas eliminar el almacén{" "}
              <span className="font-semibold">{deleteTarget.nombre}</span>? Esta
              acción no se puede deshacer.
            </p>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-slate-300 rounded-md text-sm"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
