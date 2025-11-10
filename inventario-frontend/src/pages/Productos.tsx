import React, { useEffect, useState } from "react";
import PrivateNavbar from "../components/PrivateNavbar";
import Button from "../components/Button";
import TextField from "../components/TextField";
import Toast from "../components/Toast";
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  type Producto,
} from "../api/productos";
import { listarCategorias, type Categoria } from "../api/categorias";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";

/* ──────────────── Helpers ──────────────── */
const BlockMinusAndExp = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (["-", "e", "E"].includes(e.key)) e.preventDefault();
};
const clampNonNegative = (v: string | number) => {
  const n = Number(v);
  return !isFinite(n) || n < 0 ? 0 : n;
};
const clampPositiveMoney = (v: string | number) => {
  const n = Number(v);
  return !isFinite(n) || n <= 0 ? 0.01 : Math.round(n * 100) / 100;
};
const parseBackendFieldMessage = (msg?: string) => {
  if (!msg) return null;
  const arrow = msg.split("→");
  if (arrow.length >= 2)
    return { campo: arrow[0].trim(), mensaje: arrow.slice(1).join("→").trim() };
  return null;
};

/* ──────────────── Componente ──────────────── */
export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // búsqueda y filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroUnidad, setFiltroUnidad] = useState("");
  const [precioDesde, setPrecioDesde] = useState<number | "">("");
  const [precioHasta, setPrecioHasta] = useState<number | "">("");

  const [pagina, setPagina] = useState(1);
  const ITEMS_POR_PAGINA = 10;
  const UNIDADES = [
    "pieza",
    "caja",
    "litro",
    "metro",
    "kilogramo",
    "paquete",
    "botella",
    "bolsa",
  ];

  // modales
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [productoEdit, setProductoEdit] = useState<Producto | null>(null);

  // formulario
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [precio, setPrecio] = useState(0);
  const [unidad, setUnidad] = useState("pieza");
  const [stockMinimo, setStockMinimo] = useState(1);
  const [stock, setStock] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* ──────────────── Carga inicial ──────────────── */
  useEffect(() => {
    cargarCategorias();
    cargarProductos();
  }, []);

  async function cargarCategorias() {
    try {
      const { data } = await listarCategorias();
      setCategorias(data?.data || data || []);
    } catch {
      console.warn("⚠️ Error al cargar categorías");
    }
  }

  async function cargarProductos() {
    try {
      const { data } = await listarProductos();
      const items = (data?.data?.items || data?.data || data || []).map((p: any) => ({
        ...p,
        precio: Number(p.precio) || 0,
      }));
      setProductos(items);
    } catch {
      setErr("Error al cargar productos");
    }
  }

  /* ──────────────── Buscar / Limpiar ──────────────── */
  async function onBuscar() {
    await cargarProductos();
  }

  function onLimpiar() {
    setBusqueda("");
    setFiltroCategoria("");
    setFiltroUnidad("");
    setPrecioDesde("");
    setPrecioHasta("");
    setPagina(1);
    cargarProductos();
  }

  /* ──────────────── Validaciones ──────────────── */
  function validarCampos() {
    const e: Record<string, string> = {};
    if (!clave.trim()) e.clave = "La clave es obligatoria";
    if (!nombre.trim()) e.nombre = "El nombre es obligatorio";
    else if (nombre.trim().length < 3)
      e.nombre = "nombre → Debe tener al menos 3 caracteres";
    if (precio <= 0) e.precio = "precio → Debe ser mayor a 0";
    if (stockMinimo < 0) e.stock_minimo = "El stock mínimo no puede ser negativo";
    if (stock < 0) e.stock_actual = "El stock actual no puede ser negativo";
    if (stock < stockMinimo)
      e.stock_actual = "El stock actual no puede ser menor que el mínimo";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* ──────────────── Crear ──────────────── */
  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (!validarCampos()) return;

    try {
      const resp = await crearProducto({
        clave,
        nombre,
        categoria,
        precio,
        unidad,
        stock_minimo: stockMinimo,
        stock_actual: stock,
      });
      const parsed = parseBackendFieldMessage(resp?.data?.mensaje);
      if (parsed) {
        setErrors({ [parsed.campo]: parsed.mensaje });
        return;
      }
      setMsg("Producto creado con éxito");
      setShowCreate(false);
      resetForm();
      cargarProductos();
    } catch (e: any) {
      const m =
        e?.response?.data?.mensaje ||
        e?.response?.data?.message ||
        e?.message ||
        "";
      const parsed = parseBackendFieldMessage(m);
      parsed ? setErrors({ [parsed.campo]: parsed.mensaje }) : setErr(m);
    }
  }

  /* ──────────────── Editar ──────────────── */
  function openEdit(p: Producto) {
    setProductoEdit(p);
    setClave(p.clave);
    setNombre(p.nombre);
    setCategoria(p.categoria || "");
    setPrecio(p.precio);
    setUnidad(p.unidad);
    setStockMinimo(p.stock_minimo);
    setStock(p.stock_actual);
    setShowEdit(true);
  }

  async function handleEditar(e: React.FormEvent) {
    e.preventDefault();
    if (!productoEdit) return;
    setErrors({});
    if (!validarCampos()) return;

    try {
      await actualizarProducto(productoEdit.clave, {
        nombre,
        categoria,
        precio,
        unidad,
        stock_minimo: stockMinimo,
        stock_actual: stock,
      });
      setMsg("Producto actualizado correctamente");
      setShowEdit(false);
      resetForm();
      cargarProductos();
    } catch (e: any) {
      const m =
        e?.response?.data?.mensaje ||
        e?.response?.data?.message ||
        e?.message ||
        "";
      const parsed = parseBackendFieldMessage(m);
      parsed ? setErrors({ [parsed.campo]: parsed.mensaje }) : setErr(m);
    }
  }

  /* ──────────────── Eliminar ──────────────── */
  async function handleEliminar(p: Producto) {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    try {
      await eliminarProducto(p.clave);
      setMsg("Producto eliminado correctamente");
      cargarProductos();
    } catch (e: any) {
      const m =
        e?.response?.data?.mensaje ||
        e?.response?.data?.message ||
        e?.message ||
        "";
      setErr(m);
    }
  }

  /* ──────────────── Helpers ──────────────── */
  function resetForm() {
    setClave("");
    setNombre("");
    setCategoria("");
    setPrecio(0);
    setUnidad("pieza");
    setStockMinimo(1);
    setStock(0);
    setErrors({});
  }

  /* ──────────────── Filtros + Paginación ──────────────── */
  const productosFiltrados = productos.filter((p) => {
    const coincideTexto =
      !busqueda ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.clave.toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = !filtroCategoria || p.categoria === filtroCategoria;
    const coincideUnidad = !filtroUnidad || p.unidad === filtroUnidad;
    const coincidePrecio =
      (!precioDesde || p.precio >= precioDesde) &&
      (!precioHasta || p.precio <= precioHasta);

    return coincideTexto && coincideCategoria && coincideUnidad && coincidePrecio;
  });

  const totalPaginas = Math.ceil(productosFiltrados.length / ITEMS_POR_PAGINA);
  const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
  const productosPagina = productosFiltrados.slice(inicio, inicio + ITEMS_POR_PAGINA);

  /* ──────────────── Render ──────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      <PrivateNavbar />
      <main className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-slate-800">Gestión de Productos</h1>

        {msg && <Toast message={msg} type="success" onClose={() => setMsg(null)} />}
        {err && <Toast message={err} type="error" onClose={() => setErr(null)} />}

        {/* 🔍 Filtros */}
        <div className="bg-white border p-4 rounded-lg mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Buscar producto
              </label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Por nombre o clave"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Categoría
              </label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              >
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Unidad
              </label>
              <select
                value={filtroUnidad}
                onChange={(e) => setFiltroUnidad(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              >
                <option value="">Todas</option>
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Precio (de / a)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Desde"
                  value={precioDesde}
                  onChange={(e) => setPrecioDesde(clampNonNegative(e.target.value))}
                  onKeyDown={BlockMinusAndExp}
                  className="w-1/2 border border-slate-300 rounded-lg px-2 py-1"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Hasta"
                  value={precioHasta}
                  onChange={(e) => setPrecioHasta(clampNonNegative(e.target.value))}
                  onKeyDown={BlockMinusAndExp}
                  className="w-1/2 border border-slate-300 rounded-lg px-2 py-1"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button className="bg-blue-600 text-white px-4 py-2" onClick={onBuscar}>
              Buscar
            </Button>
            <Button className="bg-gray-500 text-white px-4 py-2" onClick={onLimpiar}>
              Limpiar
            </Button>
            <Button
              className="bg-green-600 text-white flex items-center gap-2 px-4 py-2"
              onClick={() => {
                resetForm();
                setShowCreate(true);
              }}
            >
              <PlusCircle size={18} /> Crear producto
            </Button>
          </div>
        </div>

        {/* 🧾 Tabla */}
        <div className="overflow-x-auto bg-white border rounded-xl shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 font-medium">
              <tr>
                <th className="p-2 border">Clave</th>
                <th className="p-2 border">Nombre</th>
                <th className="p-2 border">Categoría</th>
                <th className="p-2 border">Unidad</th>
                <th className="p-2 border">Precio</th>
                <th className="p-2 border">Stock</th>
                <th className="p-2 border">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosPagina.map((p) => (
                <tr key={p.id} className="text-center hover:bg-slate-50">
                  <td className="border p-2">{p.clave}</td>
                  <td className="border p-2">{p.nombre}</td>
                  <td className="border p-2">{p.categoria || "-"}</td>
                  <td className="border p-2">{p.unidad}</td>
                  <td className="border p-2">${p.precio.toFixed(2)}</td>
                  <td className="border p-2">
                    {p.stock_actual} / min {p.stock_minimo}
                  </td>
                  <td className="border p-2 flex justify-center gap-2">
                    <Button
                      className="bg-yellow-500 text-white p-2"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      className="bg-red-600 text-white p-2"
                      onClick={() => handleEliminar(p)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
              {!productosPagina.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-4 text-center text-slate-500 italic"
                  >
                    No se encontraron productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 🔢 Paginación */}
        {productosFiltrados.length > ITEMS_POR_PAGINA && (
          <div className="flex justify-center mt-4 gap-3 items-center">
            <Button disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>
              ◀
            </Button>
            <span>
              Página {pagina} de {totalPaginas}
            </span>
            <Button
              disabled={pagina === totalPaginas}
              onClick={() => setPagina(pagina + 1)}
            >
              ▶
            </Button>
          </div>
        )}

        {/* Modal Crear */}
        {showCreate && renderModal("Crear producto", handleCrear, setShowCreate)}

        {/* Modal Editar */}
        {showEdit &&
          renderModal("Editar producto", handleEditar, setShowEdit, true)}
      </main>
    </div>
  );

  /* ──────────────── Modal ──────────────── */
  function renderModal(
    titulo: string,
    onSubmit: (e: React.FormEvent) => void,
    onClose: (b: boolean) => void,
    isEdit = false
  ) {
    return (
      <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl w-[420px]">
          <h2 className="text-lg font-semibold mb-4">{titulo}</h2>
          <form onSubmit={onSubmit} className="space-y-3">
            {!isEdit && (
              <div>
                <TextField
                  label="Clave"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  required
                />
                {errors.clave && (
                  <p className="text-red-600 text-xs mt-1">{errors.clave}</p>
                )}
              </div>
            )}

            <div>
              <TextField
                label="Nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
              {errors.nombre && (
                <p className="text-red-600 text-xs mt-1">{errors.nombre}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Categoría
              </label>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Unidad
              </label>
              <select
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <TextField
                label="Stock mínimo"
                type="number"
                value={stockMinimo}
                onKeyDown={BlockMinusAndExp}
                onChange={(e) => setStockMinimo(clampNonNegative(e.target.value))}
              />
              {errors.stock_minimo && (
                <p className="text-red-600 text-xs mt-1">{errors.stock_minimo}</p>
              )}
            </div>

            <div>
              <TextField
                label="Stock actual"
                type="number"
                value={stock}
                onKeyDown={BlockMinusAndExp}
                onChange={(e) => setStock(clampNonNegative(e.target.value))}
              />
              {errors.stock_actual && (
                <p className="text-red-600 text-xs mt-1">{errors.stock_actual}</p>
              )}
            </div>

            <div>
              <TextField
                label="Precio"
                type="number"
                value={precio}
                onKeyDown={BlockMinusAndExp}
                onChange={(e) => setPrecio(clampPositiveMoney(e.target.value))}
              />
              {errors.precio && (
                <p className="text-red-600 text-xs mt-1">{errors.precio}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button type="submit" className="bg-green-600 text-white">
                Guardar
              </Button>
              <Button className="bg-gray-400" onClick={() => onClose(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
