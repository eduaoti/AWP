import React, { useEffect, useMemo, useState } from "react";
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

/* ──────────────── Helpers numéricos ──────────────── */
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

/* ──────────────── Validaciones FRONT (igual que BACK) ──────────────── */

// Solo letras y números, entre 2 y 8 caracteres
const CLAVE_RE = /^[A-Za-z0-9]{2,8}$/;

function validarClave(v: string) {
  const val = v.trim();
  if (!val) return "La clave es obligatoria";
  if (!CLAVE_RE.test(val))
    return "La clave debe tener entre 2 y 8 caracteres y solo letras o números";
  return "";
}

function validarNombre(v: string, claveActual: string) {
  const val = v.trim();
  if (!val) return "El nombre es obligatorio";
  if (val.length < 3) return "Debe tener al menos 3 caracteres";
  if (/^[\d-]+$/.test(val))
    return "Debe contener letras (no solo dígitos/guiones)";
  if (val.toLowerCase() === claveActual.trim().toLowerCase())
    return "No debe ser idéntico a la clave";
  return "";
}

function validarPrecio(n: number) {
  if (!isFinite(n) || n <= 0) return "El precio debe ser mayor a 0";
  return "";
}

function validarStockMinimo(n: number) {
  if (!isFinite(n) || n < 0) return "El stock mínimo no puede ser negativo";
  return "";
}

function validarStockActual(n: number, min: number) {
  if (!isFinite(n) || n < 0) return "El stock actual no puede ser negativo";
  if (n < min) return "El stock actual no puede ser menor que el mínimo";
  return "";
}

/* ──────────────── Normalización / claves ──────────────── */
function normalizarTextoClave(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^A-Za-z0-9]/g, "") // solo letras y números
    .toUpperCase();
}

// Clave final para GUARDAR (máx. 8)
function generarClaveAuto(nombre: string, categoria: string, unidad: string) {
  const cat = normalizarTextoClave(categoria || "SIN").slice(0, 2); // 2 de categoría
  const uni = normalizarTextoClave(unidad || "PZ").slice(0, 2);     // 2 de unidad
  const nom = normalizarTextoClave(nombre || "").slice(0, 4);       // hasta 4 del nombre

  let base = (cat + uni + nom) || "PR01";
  base = base.slice(0, 8); // máximo 8

  if (base.length < 2) base = (base + "XX").slice(0, 2); // mínimo 2

  return base;
}

// Prefijo para BUSCAR (no recortamos a 8, solo para coincidencias)
function construirPrefijoClave(
  nombreParcial: string,
  categoria: string,
  unidad: string
) {
  const cat = normalizarTextoClave(categoria).slice(0, 2);
  const uni = normalizarTextoClave(unidad).slice(0, 2);
  const nom = normalizarTextoClave(nombreParcial);
  return (cat + uni + nom).toUpperCase();
}

/* ──────────────── Componente ──────────────── */
export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // para no mostrar nada al inicio
  const [hasSearched, setHasSearched] = useState(false);

  // búsqueda
  const [busquedaNombre, setBusquedaNombre] = useState("");
  const [buscaClaveCategoria, setBuscaClaveCategoria] = useState("");
  const [buscaClaveUnidad, setBuscaClaveUnidad] = useState("");
  const [buscaClaveTexto, setBuscaClaveTexto] = useState("");

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

  // indica si el usuario ya tocó la clave manualmente
  const [claveManual, setClaveManual] = useState(false);

  // errores por campo
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* ──────────────── Carga inicial ──────────────── */
  useEffect(() => {
    cargarCategorias();
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
      const items = (data?.data?.items || data?.data || data || []).map(
        (p: any) => ({
          ...p,
          precio: Number(p.precio) || 0,
        })
      );
      setProductos(items);
    } catch {
      setErr("Error al cargar productos");
    }
  }

  /* ──────────────── Buscar / Limpiar ──────────────── */
  async function onBuscar() {
    await cargarProductos();
    setHasSearched(true);
    setPagina(1);
  }

  function onLimpiar() {
    setBusquedaNombre("");
    setBuscaClaveCategoria("");
    setBuscaClaveUnidad("");
    setBuscaClaveTexto("");

    setPrecioDesde("");
    setPrecioHasta("");
    setPagina(1);

    setProductos([]);
    setHasSearched(false);
  }

  /* ──────────────── Autogenerar clave al crear ──────────────── */
  useEffect(() => {
    if (!showCreate) return;
    if (claveManual) return; // si el usuario ya la modificó, no la pisamos

    const auto = generarClaveAuto(nombre, categoria, unidad);
    setClave(auto);
  }, [nombre, categoria, unidad, showCreate, claveManual]);

  /* ──────────────── Validaciones tiempo real ──────────────── */
  function validateAllRealtime(next?: Partial<{
    clave: string;
    nombre: string;
    precio: number;
    stockMinimo: number;
    stock: number;
  }>) {
    const current = {
      clave,
      nombre,
      precio,
      stockMinimo,
      stock,
      ...next,
    };

    const e: Record<string, string> = {};
    e.clave = validarClave(current.clave);
    e.nombre = validarNombre(current.nombre, current.clave);
    e.precio = validarPrecio(current.precio);
    e.stock_minimo = validarStockMinimo(current.stockMinimo);
    e.stock_actual = validarStockActual(current.stock, current.stockMinimo);

    Object.keys(e).forEach((k) => {
      if (!e[k]) delete e[k];
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  useEffect(() => {
    if (showCreate || showEdit) validateAllRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, nombre, precio, stockMinimo, stock, showCreate, showEdit]);

  const formOk = useMemo(() => Object.keys(errors).length === 0, [errors]);

  /* ──────────────── Crear ──────────────── */
  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (!validateAllRealtime()) return;

    try {
      const resp = await crearProducto({
        clave: clave.trim(),
        nombre: nombre.trim(),
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
      await cargarProductos();
      setHasSearched(true);
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
    setClaveManual(true); // en edición no queremos autogenerar
    setShowEdit(true);
  }

  async function handleEditar(e: React.FormEvent) {
    e.preventDefault();
    if (!productoEdit) return;
    setErrors({});
    if (!validateAllRealtime()) return;

    try {
      await actualizarProducto(productoEdit.clave, {
        nombre: nombre.trim(),
        categoria,
        precio,
        unidad,
        stock_minimo: stockMinimo,
        stock_actual: stock,
      });

      setMsg("Producto actualizado correctamente");
      setShowEdit(false);
      resetForm();
      await cargarProductos();
      setHasSearched(true);
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
      await cargarProductos();
      setHasSearched(true);
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
    setClaveManual(false);
  }

  /* ──────────────── Filtros + Paginación ──────────────── */
  const productosFiltrados = hasSearched
    ? productos.filter((p) => {
        // 1) Filtro por NOMBRE
        let coincideNombre = true;
        if (busquedaNombre.trim()) {
          coincideNombre = p.nombre
            .toLowerCase()
            .includes(busquedaNombre.trim().toLowerCase());
        }

        // 2) Filtro por CLAVE (prefijo construido)
        let coincideClave = true;
        const tieneBusquedaClave =
          buscaClaveCategoria ||
          buscaClaveUnidad ||
          buscaClaveTexto.trim();

        if (tieneBusquedaClave) {
          const prefijo = construirPrefijoClave(
            buscaClaveTexto,
            buscaClaveCategoria,
            buscaClaveUnidad
          );
          if (prefijo) {
            coincideClave = p.clave.toUpperCase().startsWith(prefijo);
          }
        }

        // 3) Filtro de precio
        const coincidePrecio =
          (!precioDesde || p.precio >= precioDesde) &&
          (!precioHasta || p.precio <= precioHasta);

        return coincideNombre && coincideClave && coincidePrecio;
      })
    : [];

  const totalPaginas = Math.ceil(productosFiltrados.length / ITEMS_POR_PAGINA);
  const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
  const productosPagina = productosFiltrados.slice(
    inicio,
    inicio + ITEMS_POR_PAGINA
  );

  /* ──────────────── Render ──────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      <PrivateNavbar />
      <main className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-slate-800">
          Gestión de Productos
        </h1>

        {msg && (
          <Toast message={msg} type="success" onClose={() => setMsg(null)} />
        )}
        {err && (
          <Toast message={err} type="error" onClose={() => setErr(null)} />
        )}

        {/* 🔍 Filtros */}
        <div className="bg-white border p-4 rounded-lg mb-6 shadow-sm space-y-4">
          {/* Fila 1: Nombre y Clave */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Buscar por NOMBRE */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Buscar por nombre
              </label>
            <input
  type="text"
  value={busquedaNombre}
  onChange={(e) =>
    setBusquedaNombre(
      e.target.value
        .replace(/[^a-zA-Z0-9 ]/g, "") // ❌ elimina caracteres especiales
        .slice(0, 20) // ❌ máximo 20 caracteres
    )
  }
  placeholder="Ej: Coca, Madera, Clavo..."
  className="w-full border border-slate-300 rounded-lg px-3 py-2"
/>

            </div>

            {/* Buscar por CLAVE (cat + unidad + letras) */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Buscar por clave (Categoría + Unidad + letras)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {/* Categoría */}
                <select
                  value={buscaClaveCategoria}
                  onChange={(e) => setBuscaClaveCategoria(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="">Categoría</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.nombre}>
                      {c.nombre}
                    </option>
                  ))}
                </select>

                {/* Unidad */}
                <select
                  value={buscaClaveUnidad}
                  onChange={(e) => setBuscaClaveUnidad(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="">Unidad</option>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>

                {/* Texto del nombre para la clave */}
                <input
                  type="text"
                  value={buscaClaveTexto}
                  onChange={(e) =>
                    setBuscaClaveTexto(
                      e.target.value
                        .replace(/[^a-zA-Z0-9]/g, "") // solo letras/números
                        .slice(0, 8) // máx 8
                    )
                  }
                  placeholder="Letras del nombre"
                  className="border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Se buscarán productos cuya clave empiece con esta combinación.
              </p>
            </div>
          </div>

          {/* Fila 2: Precio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
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
                  onChange={(e) =>
                    setPrecioDesde(clampNonNegative(e.target.value))
                  }
                  onKeyDown={BlockMinusAndExp}
                  className="w-1/2 border border-slate-300 rounded-lg px-2 py-1"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Hasta"
                  value={precioHasta}
                  onChange={(e) =>
                    setPrecioHasta(clampNonNegative(e.target.value))
                  }
                  onKeyDown={BlockMinusAndExp}
                  className="w-1/2 border border-slate-300 rounded-lg px-2 py-1"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button
              className="bg-blue-600 text-white px-4 py-2"
              onClick={onBuscar}
            >
              Buscar
            </Button>
            <Button
              className="bg-gray-500 text-white px-4 py-2"
              onClick={onLimpiar}
            >
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
            <Button
              disabled={pagina === 1}
              onClick={() => setPagina(pagina - 1)}
            >
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
                  maxLength={8} // límite de 8 caracteres
                  onChange={(e) => {
                    const v = e.target.value
                      .replace(/[^a-zA-Z0-9]/g, "") // solo letras/números
                      .slice(0, 8); // máx 8
                    setClave(v);
                    setClaveManual(true); // el usuario decide escribirla
                  }}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Se genera automáticamente a partir del nombre, categoría y
                  unidad. Puedes ajustarla si lo necesitas (solo letras y
                  números, máx. 8 caracteres).
                </p>
                {errors.clave && (
                  <p className="text-red-600 text-xs mt-1">{errors.clave}</p>
                )}
              </div>
            )}

            <div>
              <TextField
                label="Nombre"
                value={nombre}
                maxLength={40} // límite de longitud para nombre
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
                onChange={(e) => {
                  setCategoria(e.target.value);
                  if (!isEdit) setClaveManual(false);
                }}
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
                onChange={(e) => {
                  setUnidad(e.target.value);
                  if (!isEdit) setClaveManual(false);
                }}
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
                onChange={(e) =>
                  setStockMinimo(clampNonNegative(e.target.value))
                }
              />
              {errors.stock_minimo && (
                <p className="text-red-600 text-xs mt-1">
                  {errors.stock_minimo}
                </p>
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
                <p className="text-red-600 text-xs mt-1">
                  {errors.stock_actual}
                </p>
              )}
            </div>

            <div>
              <TextField
                label="Precio"
                type="number"
                value={precio}
                onKeyDown={BlockMinusAndExp}
                onChange={(e) =>
                  setPrecio(clampPositiveMoney(e.target.value))
                }
              />
              {errors.precio && (
                <p className="text-red-600 text-xs mt-1">{errors.precio}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                type="submit"
                className="bg-green-600 text-white"
                disabled={!formOk}
                title={!formOk ? "Corrige los errores para guardar" : ""}
              >
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
