// src/pages/Proveedores.tsx
import React, { useEffect, useState } from "react";
import PrivateNavbar from "../components/PrivateNavbar";
import Button from "../components/Button";
import {
  listarProveedores,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
  type Proveedor,
  type ProveedoresMeta,
} from "../api/proveedores";

type FormMode = "create" | "edit";

const emptyForm = {
  id: 0,
  nombre: "",
  telefono: "",
  contacto: "",
};

export default function Proveedores() {
  const [items, setItems] = useState<Proveedor[]>([]);
  const [meta, setMeta] = useState<ProveedoresMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState<FormMode>("create");
  const [showForm, setShowForm] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Proveedor | null>(null);

  // ==========================
  // Cargar datos
  // ==========================
  async function loadProveedores(offset = 0) {
    try {
      setLoading(true);
      setError(null);
      const res = await listarProveedores({ limit: 10, offset });
      setItems(res.items);
      setMeta(res.meta);
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.data?.detalle?.message ||
        e?.data?.mensaje ||
        "No se pudieron cargar los proveedores.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProveedores(0);
  }, []);

  // ==========================
  // Handlers formulario
  // ==========================
  function openCreate() {
    setMode("create");
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(p: Proveedor) {
    setMode("edit");
    setForm({
      id: p.id,
      nombre: p.nombre,
      telefono: p.telefono ?? "",
      contacto: p.contacto ?? "",
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
        await crearProveedor({
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          contacto: form.contacto || undefined,
        });
      } else {
        await actualizarProveedor({
          id: form.id,
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          contacto: form.contacto || undefined,
        });
      }

      closeForm();
      await loadProveedores(meta?.offset ?? 0);
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.data?.detalle?.message ||
        e?.data?.mensaje ||
        "Ocurrió un error al guardar el proveedor.";
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
      await eliminarProveedor(deleteTarget.id);
      setDeleteTarget(null);
      await loadProveedores(meta?.offset ?? 0);
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.data?.detalle?.message ||
        e?.data?.mensaje ||
        "Ocurrió un error al eliminar el proveedor.";
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
      loadProveedores(meta.prevOffset);
    }
  }

  function goNext() {
    if (meta?.hasNext && meta.nextOffset != null) {
      loadProveedores(meta.nextOffset);
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
              Administración de Proveedores
            </h1>
            <p className="text-sm text-slate-500">
              Registra, edita, consulta y elimina proveedores del sistema de
              inventario.
            </p>
          </div>

          <Button
            onClick={openCreate}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700"
          >
            Nuevo proveedor
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
                      Cargando proveedores...
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No hay proveedores registrados.
                    </td>
                  </tr>
                )}

                {items.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-2">{p.id}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">
                      {p.nombre}
                    </td>
                    <td className="px-4 py-2">
                      {p.telefono ? (
                        p.telefono
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {p.contacto ? (
                        p.contacto
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(p.creado_en).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <Button
                        onClick={() => openEdit(p)}
                        className="px-3 py-1 text-xs bg-amber-500 text-white rounded-md hover:bg-amber-600"
                      >
                        Editar
                      </Button>
                      <Button
                        onClick={() => setDeleteTarget(p)}
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
                Mostrando {meta.returned} de {meta.total} proveedores
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
              {mode === "create" ? "Nuevo proveedor" : "Editar proveedor"}
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
            <h2 className="text-lg font-bold mb-3">Eliminar proveedor</h2>
            <p className="text-sm text-slate-600 mb-4">
              ¿Seguro que deseas eliminar al proveedor{" "}
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
