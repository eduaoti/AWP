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

// ==========================
// Reglas para clave de producto
// ==========================
const CLAVE_RE = /^[A-Za-z0-9]{2,8}$/;

const emptyForm: RegistrarMovimientoPayload = {
  entrada: true,
  producto_clave: "",
  cantidad: 0,
  documento: "",
  responsable: "",
};

type FieldErrors = {
  producto_clave?: string;
  cantidad?: string;
  documento?: string;
  responsable?: string;
  proveedor_id?: string;
  cliente_id?: string;
};

// bloquear teclas que permiten flotantes o exponentes
const blockNonIntegerKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
};

export default function Movimientos() {
  const [items, setItems] = useState<Movimiento[]>([]);
  const [meta, setMeta] = useState<MovimientosMeta | null>(null);
  const [loading, setLoading] = useState(false);

  // error general (solo backend)
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<RegistrarMovimientoPayload>(emptyForm);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
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
  // Validación del formulario
  // ==========================
  function validarForm(f: RegistrarMovimientoPayload): FieldErrors {
    const errs: FieldErrors = {};

    const clave = (f.producto_clave || "").trim();
    if (!clave) {
      errs.producto_clave = "La clave de producto es obligatoria.";
    } else if (!CLAVE_RE.test(clave)) {
      errs.producto_clave =
        "Debe tener entre 2 y 8 caracteres y solo letras o números.";
    }

    if (!f.cantidad || Number(f.cantidad) <= 0) {
      errs.cantidad = "La cantidad debe ser mayor a 0.";
    }

    const doc = (f.documento ?? "").trim();
    if (!doc) {
      errs.documento = "El documento es obligatorio.";
    } else {
      if (doc.length < 3) {
        errs.documento = "El documento debe tener al menos 3 caracteres.";
      } else if (doc.length > 40) {
        errs.documento = "El documento no debe exceder 40 caracteres.";
      } else if (!/^[A-Za-z0-9 ]+$/.test(doc)) {
        errs.documento =
          "El documento solo puede contener letras, números y espacios.";
      }
    }

    const resp = (f.responsable ?? "").trim();
    if (!resp) {
      errs.responsable = "El responsable es obligatorio.";
    } else {
      if (resp.length < 3) {
        errs.responsable = "El responsable debe tener al menos 3 caracteres.";
      } else if (resp.length > 20) {
        errs.responsable = "El responsable no debe exceder 20 caracteres.";
      } else if (!/^[A-Za-z ]+$/.test(resp)) {
        errs.responsable =
          "El responsable solo puede contener letras y espacios (sin números ni símbolos).";
      }
    }

    if (f.entrada) {
      if (!f.proveedor_id || Number(f.proveedor_id) <= 0) {
        errs.proveedor_id =
          "El ID de proveedor es obligatorio y debe ser numérico.";
      }
    } else {
      if (!f.cliente_id || Number(f.cliente_id) <= 0) {
        errs.cliente_id =
          "El ID de cliente es obligatorio y debe ser numérico.";
      }
    }

    return errs;
  }

  // ==========================
  // Handlers formulario
  // ==========================
  function openCreate() {
    setForm(emptyForm);
    setFormErrors({});
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(emptyForm);
    setFormErrors({});
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formNormalizado: RegistrarMovimientoPayload = {
      ...form,
      producto_clave: (form.producto_clave || "").trim(),
    };

    const errs = validarForm(formNormalizado);
    setFormErrors(errs);

    if (Object.keys(errs).length > 0) {
      // hay errores, no mandamos al backend
      return;
    }

    try {
      setLoading(true);

      const payload: RegistrarMovimientoPayload = {
        ...formNormalizado,
        cantidad: Number(formNormalizado.cantidad),
        proveedor_id: formNormalizado.entrada
          ? formNormalizado.proveedor_id
            ? Number(formNormalizado.proveedor_id)
            : undefined
          : undefined,
        cliente_id: formNormalizado.entrada
          ? undefined
          : formNormalizado.cliente_id
          ? Number(formNormalizado.cliente_id)
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

        {error && !showForm && (
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
<td className="px-4 py-2 font-semibold">{Number(m.cantidad)}</td>
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

            {error && (
              <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

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
                      onChange={() => {
                        setForm((f) => ({
                          ...f,
                          entrada: true,
                          proveedor_id: f.proveedor_id,
                          cliente_id: undefined,
                        }));
                        setFormErrors((prev) => ({
                          ...prev,
                          proveedor_id: undefined,
                          cliente_id: undefined,
                        }));
                      }}
                    />
                    <span>Entrada</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="tipo"
                      value="salida"
                      checked={form.entrada === false}
                      onChange={() => {
                        setForm((f) => ({
                          ...f,
                          entrada: false,
                          proveedor_id: undefined,
                          cliente_id: f.cliente_id,
                        }));
                        setFormErrors((prev) => ({
                          ...prev,
                          proveedor_id: undefined,
                          cliente_id: undefined,
                        }));
                      }}
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
                  maxLength={8}
                  onChange={(e) => {
                    const limpio = e.target.value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .toUpperCase()
                      .slice(0, 8);
                    setForm((f) => ({
                      ...f,
                      producto_clave: limpio,
                    }));
                    setFormErrors((prev) => ({
                      ...prev,
                      producto_clave: undefined,
                    }));
                  }}
                  placeholder="Ej: PLA0001"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Solo letras y números, entre 2 y 8 caracteres (sin espacios ni
                  símbolos).
                </p>
                {formErrors.producto_clave && (
                  <p className="text-xs text-red-600 mt-1">
                    {formErrors.producto_clave}
                  </p>
                )}
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
                  onKeyDown={blockNonIntegerKey}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.cantidad || ""}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    const num = digits ? Number(digits) : 0;
                    setForm((f) => ({
                      ...f,
                      cantidad: num,
                    }));
                    setFormErrors((prev) => ({
                      ...prev,
                      cantidad: undefined,
                    }));
                  }}
                  required
                />
                {formErrors.cantidad && (
                  <p className="text-xs text-red-600 mt-1">
                    {formErrors.cantidad}
                  </p>
                )}
              </div>

              {/* Documento */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Documento <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.documento ?? ""}
                  maxLength={40}
                  onChange={(e) => {
                    const v = e.target.value
                      .replace(/[^a-zA-Z0-9 ]/g, "")
                      .slice(0, 40);
                    setForm((f) => ({
                      ...f,
                      documento: v,
                    }));
                    setFormErrors((prev) => ({
                      ...prev,
                      documento: undefined,
                    }));
                  }}
                  placeholder="Factura, remisión, nota..."
                  required
                />
                {formErrors.documento && (
                  <p className="text-xs text-red-600 mt-1">
                    {formErrors.documento}
                  </p>
                )}
              </div>

              {/* Responsable */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Responsable <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.responsable ?? ""}
                  maxLength={20}
                  onChange={(e) => {
                    const v = e.target.value
                      .replace(/[^a-zA-Z ]/g, "")
                      .slice(0, 20);
                    setForm((f) => ({
                      ...f,
                      responsable: v,
                    }));
                    setFormErrors((prev) => ({
                      ...prev,
                      responsable: undefined,
                    }));
                  }}
                  placeholder="Nombre del responsable"
                  required
                />
                {formErrors.responsable && (
                  <p className="text-xs text-red-600 mt-1">
                    {formErrors.responsable}
                  </p>
                )}
              </div>

              {/* Proveedor / Cliente según tipo */}
              {form.entrada ? (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    ID de proveedor <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    onKeyDown={blockNonIntegerKey}
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.proveedor_id ?? ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      const num = digits ? Number(digits) : undefined;
                      setForm((f) => ({
                        ...f,
                        proveedor_id: num,
                      }));
                      setFormErrors((prev) => ({
                        ...prev,
                        proveedor_id: undefined,
                      }));
                    }}
                    placeholder="ID numérico del proveedor"
                    required
                  />
                  {formErrors.proveedor_id && (
                    <p className="text-xs text-red-600 mt-1">
                      {formErrors.proveedor_id}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    ID de cliente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    onKeyDown={blockNonIntegerKey}
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.cliente_id ?? ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      const num = digits ? Number(digits) : undefined;
                      setForm((f) => ({
                        ...f,
                        cliente_id: num,
                      }));
                      setFormErrors((prev) => ({
                        ...prev,
                        cliente_id: undefined,
                      }));
                    }}
                    placeholder="ID numérico del cliente"
                    required
                  />
                  {formErrors.cliente_id && (
                    <p className="text-xs text-red-600 mt-1">
                      {formErrors.cliente_id}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-endрать gap-3 pt-2">
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
