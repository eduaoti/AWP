import React, { useEffect, useState } from "react";
import PrivateNavbar from "../components/PrivateNavbar";
import Button from "../components/Button";
import TextField from "../components/TextField";
import Alert from "../components/Alert";
import {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  type Categoria,
} from "../api/categorias";

/* ===========================================================
   Validaciones
   =========================================================== */

function validarNombreCategoria(v: string) {
  const val = v.trim();
  if (!val) return "El nombre es obligatorio";
  if (val.length < 3) return "Debe tener al menos 3 caracteres";
  if (val.length > 40) return "No debe exceder 40 caracteres";
  if (!/^[A-Za-z0-9 ]+$/.test(val))
    return "Solo se permiten letras, números y espacios (sin caracteres especiales)";
  return "";
}

function validarDescripcionCategoria(v: string) {
  const val = v.trim();
  if (!val) return "";
  if (val.length > 120) return "La descripción no debe exceder 120 caracteres";
  return "";
}

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editing, setEditing] = useState<Categoria | null>(null);

  // Campos del formulario
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // Errores por campo
  const [errors, setErrors] = useState<{ nombre?: string; descripcion?: string }>(
    {}
  );

  // UI
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ===========================================================
     Cargar categorías
     =========================================================== */
  async function cargar() {
    try {
      const { data } = await listarCategorias();
      // el backend devuelve: { codigo, mensaje, data }
      setCategorias(data.data || data);
    } catch (e: any) {
      setErr(e?.response?.data?.mensaje || "Error al cargar categorías");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  /* ===========================================================
     Guardar (crear o actualizar)
     =========================================================== */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setLoading(true);

    // Validar antes de mandar al backend
    const errNombre = validarNombreCategoria(nombre);
    const errDesc = validarDescripcionCategoria(descripcion);

    const nuevosErrores: { nombre?: string; descripcion?: string } = {};
    if (errNombre) nuevosErrores.nombre = errNombre;
    if (errDesc) nuevosErrores.descripcion = errDesc;

    setErrors(nuevosErrores);

    if (Object.keys(nuevosErrores).length > 0) {
      setLoading(false);
      return;
    }

    try {
      if (editing) {
        await actualizarCategoria(editing.id, {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
        });
        setMsg("Categoría actualizada con éxito ✅");
      } else {
        await crearCategoria({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
        });
        setMsg("Categoría creada con éxito 🎉");
      }

      resetForm();
      setEditing(null);
      cargar();
    } catch (e: any) {
      setErr(e?.response?.data?.mensaje || "Error al guardar categoría");
    } finally {
      setLoading(false);
    }
  }

  /* ===========================================================
     Editar / Eliminar / Reset
     =========================================================== */
  function handleEdit(cat: Categoria) {
    setEditing(cat);
    setNombre(cat.nombre);
    setDescripcion(cat.descripcion || "");
    // revalidar al cargar en edición
    setErrors({
      nombre: validarNombreCategoria(cat.nombre),
      descripcion: validarDescripcionCategoria(cat.descripcion || ""),
    });
  }

  async function handleDelete(cat: Categoria) {
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"?`)) return;
    try {
      await eliminarCategoria(cat.id);
      setMsg("Categoría eliminada con éxito 🗑️");
      cargar();
    } catch (e: any) {
      setErr(e?.response?.data?.mensaje || "Error al eliminar categoría");
    }
  }

  function resetForm() {
    setNombre("");
    setDescripcion("");
    setErrors({});
  }

  const formInvalido =
    !!errors.nombre || !!errors.descripcion || !nombre.trim() || loading;

  /* ===========================================================
     Render UI
     =========================================================== */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <PrivateNavbar />

      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4 text-slate-800">
          Gestión de Categorías
        </h1>

        {/* Mensajes */}
        {msg && (
          <div className="mb-3">
            <Alert kind="success">{msg}</Alert>
          </div>
        )}
        {err && (
          <div className="mb-3">
            <Alert>{err}</Alert>
          </div>
        )}

        {/* ===========================================================
            Formulario de creación / edición
           =========================================================== */}
        <form
          onSubmit={onSubmit}
          className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-xl shadow-sm border"
        >
          {/* Nombre */}
          <div>
            <TextField
              label="Nombre"
              value={nombre}
              maxLength={40}
              onChange={(e) => {
                const v = e.target.value
                  .replace(/[^a-zA-Z0-9 ]/g, "") // solo letras, números y espacio
                  .slice(0, 40); // máximo 40
                setNombre(v);
                setErrors((prev) => ({
                  ...prev,
                  nombre: validarNombreCategoria(v),
                }));
              }}
              required
            />
            {errors.nombre && (
              <p className="text-red-600 text-xs mt-1">{errors.nombre}</p>
            )}
          </div>

          {/* Descripción */}
          <div>
            <TextField
              label="Descripción"
              value={descripcion}
              maxLength={120}
              onChange={(e) => {
                const v = e.target.value.slice(0, 120); // solo limitamos por longitud
                setDescripcion(v);
                setErrors((prev) => ({
                  ...prev,
                  descripcion: validarDescripcionCategoria(v),
                }));
              }}
            />
            {errors.descripcion && (
              <p className="text-red-600 text-xs mt-1">
                {errors.descripcion}
              </p>
            )}
          </div>

          <div className="md:col-span-2 flex gap-2 mt-2">
            <Button
              disabled={formInvalido}
              className="bg-indigo-600 text-white px-6"
              title={
                formInvalido
                  ? "Corrige los errores antes de guardar"
                  : undefined
              }
            >
              {loading
                ? "Procesando…"
                : editing
                ? "Actualizar"
                : "Registrar"}
            </Button>

            {editing && (
              <Button
                type="button"
                className="bg-gray-500 text-white"
                onClick={() => {
                  setEditing(null);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>

        {/* ===========================================================
            Tabla de categorías
           =========================================================== */}
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 font-medium">
              <tr>
                <th className="p-2 border">ID</th>
                <th className="p-2 border">Nombre</th>
                <th className="p-2 border">Descripción</th>
                <th className="p-2 border">Creado en</th>
                <th className="p-2 border">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((cat) => (
                <tr
                  key={cat.id}
                  className="text-center hover:bg-slate-50 transition"
                >
                  <td className="border p-2">{cat.id}</td>
                  <td className="border p-2">{cat.nombre}</td>
                  <td className="border p-2">{cat.descripcion || "-"}</td>
                  <td className="border p-2">
                    {cat.creado_en
                      ? new Date(cat.creado_en).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="border p-2 space-x-2">
                    <Button
                      className="bg-yellow-500 text-white px-3 py-1"
                      type="button"
                      onClick={() => handleEdit(cat)}
                    >
                      Editar
                    </Button>
                    <Button
                      className="bg-red-600 text-white px-3 py-1"
                      type="button"
                      onClick={() => handleDelete(cat)}
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
              {categorias.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center p-4 text-slate-500 italic"
                  >
                    No hay categorías registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
