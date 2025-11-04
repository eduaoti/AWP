import React, { useEffect, useState } from "react";
import PrivateNavbar from "../components/PrivateNavbar";
import Button from "../components/Button";
import TextField from "../components/TextField";
import Alert from "../components/Alert";
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  type Producto,
} from "../api/productos";
import { listarCategorias, type Categoria } from "../api/categorias";

export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editing, setEditing] = useState<Producto | null>(null);

  // Campos del formulario
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState("pieza");
  const [precio, setPrecio] = useState(0);
  const [categoria, setCategoria] = useState("");
  const [stockMin, setStockMin] = useState(0);
  const [stockActual, setStockActual] = useState(0);
  const [descripcion, setDescripcion] = useState("");

  // UI
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ===========================================================
     Cargar datos
     =========================================================== */
  async function cargarProductos() {
    try {
      const { data } = await listarProductos();
      setProductos(data.data.items || data.data || []);
    } catch (e: any) {
      setErr(e?.response?.data?.mensaje || "Error al cargar productos");
    }
  }

  async function cargarCategorias() {
    try {
      const { data } = await listarCategorias();
      setCategorias(data.data || data);
    } catch (e: any) {
      console.error(e);
    }
  }

  useEffect(() => {
    cargarCategorias();
    cargarProductos();
  }, []);

  /* ===========================================================
     Guardar producto
     =========================================================== */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setLoading(true);

    // ✅ No incluir "clave" en el body al actualizar (el backend no lo acepta)
    const payloadBase = {
      nombre: nombre.trim(),
      unidad: unidad.trim(),
      precio: Number(precio),
      categoria: categoria || undefined,
      stock_minimo: Number(stockMin),
      stock_actual: Number(stockActual),
      descripcion: descripcion.trim() || undefined,
    };

    try {
      if (editing) {
        // 🔹 PUT /productos/codigo/:codigo — la clave va en la URL
        await actualizarProducto(editing.clave, payloadBase);
        setMsg("Producto actualizado con éxito ✅");
      } else {
        // 🔹 POST /productos — la clave sí va en el body
        await crearProducto({ ...payloadBase, clave: clave.trim() });
        setMsg("Producto creado con éxito ✅");
      }

      resetForm();
      setEditing(null);
      cargarProductos();
    } catch (e: any) {
      setErr(e?.response?.data?.mensaje || "Error al guardar el producto");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setClave("");
    setNombre("");
    setUnidad("pieza");
    setPrecio(0);
    setCategoria("");
    setStockMin(0);
    setStockActual(0);
    setDescripcion("");
  }

  async function handleDelete(p: Producto) {
    if (!confirm(`¿Eliminar producto ${p.nombre}?`)) return;
    try {
      await eliminarProducto(p.clave);
      setMsg("Producto eliminado con éxito");
      cargarProductos();
    } catch (e: any) {
      setErr(e?.response?.data?.mensaje || "Error al eliminar");
    }
  }

  function handleEdit(p: Producto) {
    setEditing(p);
    setClave(p.clave);
    setNombre(p.nombre);
    setUnidad(p.unidad);
    setPrecio(Number(p.precio));
    setCategoria(p.categoria || "");
    setStockMin(Number(p.stock_minimo));
    setStockActual(Number(p.stock_actual));
    setDescripcion(p.descripcion || "");
  }

  /* ===========================================================
     Render UI
     =========================================================== */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <PrivateNavbar />

      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4 text-slate-800">
          Gestión de Productos
        </h1>

        {msg && <Alert kind="success">{msg}</Alert>}
        {err && <Alert>{err}</Alert>}

        {/* Formulario */}
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white p-4 rounded-xl shadow mb-6"
        >
          <TextField
            label="Clave"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            required={!editing} // ✅ Solo obligatoria al crear
            disabled={!!editing} // ✅ Deshabilitada al editar
          />

          <TextField
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />

          <TextField
            label="Unidad"
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
          />

          <TextField
            label="Precio"
            type="number"
            value={precio}
            onChange={(e) => setPrecio(Number(e.target.value))}
          />

          {/* ✅ Selector de Categoría */}
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">
              Categoría
            </span>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            >
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>

          <TextField
            label="Stock mínimo"
            type="number"
            value={stockMin}
            onChange={(e) => setStockMin(Number(e.target.value))}
          />

          <TextField
            label="Stock actual"
            type="number"
            value={stockActual}
            onChange={(e) => setStockActual(Number(e.target.value))}
          />

          <TextField
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />

          <div className="md:col-span-2 lg:col-span-3 flex gap-2 mt-2">
            <Button disabled={loading} className="bg-indigo-600 text-white">
              {loading
                ? "Procesando…"
                : editing
                ? "Actualizar producto"
                : "Crear producto"}
            </Button>
            {editing && (
              <Button
                type="button"
                className="bg-gray-400"
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

        {/* Tabla */}
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 font-medium">
              <tr>
                <th className="p-2 border">Clave</th>
                <th className="p-2 border">Nombre</th>
                <th className="p-2 border">Categoría</th>
                <th className="p-2 border">Precio</th>
                <th className="p-2 border">Stock</th>
                <th className="p-2 border">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id} className="text-center hover:bg-slate-50">
                  <td className="border p-2">{p.clave}</td>
                  <td className="border p-2">{p.nombre}</td>
                  <td className="border p-2">{p.categoria || "-"}</td>
                  <td className="border p-2">${Number(p.precio).toFixed(2)}</td>
                  <td className="border p-2">
                    {p.stock_actual} / min {p.stock_minimo}
                  </td>
                  <td className="border p-2">
                    <Button
                      className="bg-yellow-500 text-white mr-2"
                      onClick={() => handleEdit(p)}
                    >
                      Editar
                    </Button>
                    <Button
                      className="bg-red-600 text-white"
                      onClick={() => handleDelete(p)}
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
              {productos.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-slate-500 italic">
                    No hay productos registrados.
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
