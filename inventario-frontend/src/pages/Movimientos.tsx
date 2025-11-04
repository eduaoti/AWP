import React, { useEffect, useState } from "react";
import PrivateNavbar from "../components/PrivateNavbar";
import Button from "../components/Button";
import TextField from "../components/TextField";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";
import { listarMovimientos, registrarMovimiento } from "../api/movimientos";
import type { Movimiento } from "../api/movimientos";

/* ===========================================================
   Página de gestión de movimientos
   =========================================================== */
export default function Movimientos() {
  const { user } = useAuth();
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);

  // Campos del formulario
  const [entrada, setEntrada] = useState<boolean>(true);
  const [productoClave, setProductoClave] = useState("");
  const [cantidad, setCantidad] = useState<number>(1);
  const [documento, setDocumento] = useState("");
  const [responsable, setResponsable] = useState("");
  const [proveedorId, setProveedorId] = useState<number | "">("");
  const [clienteId, setClienteId] = useState<number | "">("");

  // Estados de UI
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ===========================================================
     Cargar movimientos desde el backend
     =========================================================== */
  async function cargar() {
    try {
      const { data } = await listarMovimientos();

      // 🧩 El backend puede devolver data.data como array o como objeto con items
      const movimientosData =
        Array.isArray(data.data) ? data.data : data.data?.items || [];

      setMovimientos(movimientosData);
      setErr(null);
    } catch (r: any) {
      console.error("Error al cargar movimientos:", r);
      const backendMsg =
        r?.response?.data?.mensaje ||
        r?.data?.mensaje ||
        "Error al cargar movimientos";
      setErr(backendMsg);
      setMovimientos([]);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => cargar(), 200);
    return () => clearTimeout(timer);
  }, []);

  /* ===========================================================
     Registrar movimiento
     =========================================================== */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setLoading(true);

    try {
      const payload: any = {
        entrada,
        producto_clave: productoClave.trim(),
        cantidad: Number(cantidad),
        documento: documento.trim() || undefined,
        responsable: responsable.trim() || undefined,
      };

      if (entrada && proveedorId) payload.proveedor_id = Number(proveedorId);
      if (!entrada && clienteId) payload.cliente_id = Number(clienteId);

      const { data } = await registrarMovimiento(payload);

      setMsg(data?.mensaje || "Movimiento registrado con éxito ✅");
      setProductoClave("");
      setCantidad(1);
      setDocumento("");
      setResponsable("");
      setProveedorId("");
      setClienteId("");
      cargar();
    } catch (r: any) {
      console.error("Error al registrar movimiento:", r);
      const backendMsg =
        r?.response?.data?.mensaje ||
        r?.data?.mensaje ||
        "Error al registrar movimiento";
      setErr(backendMsg);
    } finally {
      setLoading(false);
    }
  }

  /* ===========================================================
     Renderizado de la interfaz
     =========================================================== */
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 🔹 Navbar protegida con nombre de usuario */}
<PrivateNavbar />

      {/* 🔹 Contenido principal */}
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">
          Registro y Consulta de Movimientos
        </h1>

        {/* ✅ Mensajes de éxito o error */}
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
            Formulario de registro de movimiento
           =========================================================== */}
        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white p-4 rounded-xl shadow-sm border mb-6"
        >
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">
              Tipo de Movimiento
            </span>
            <select
              value={entrada ? "entrada" : "salida"}
              onChange={(e) => setEntrada(e.target.value === "entrada")}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            >
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
            </select>
          </label>

          <TextField
            label="Clave del Producto"
            value={productoClave}
            onChange={(e) => setProductoClave(e.target.value)}
            required
          />

          <TextField
            label="Cantidad"
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            required
          />

          <TextField
            label="Documento (opcional)"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />

          <TextField
            label="Responsable (opcional)"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
          />

          {entrada ? (
            <TextField
              label="Proveedor ID (opcional)"
              type="number"
              value={proveedorId}
              onChange={(e) =>
                setProveedorId(e.target.value ? Number(e.target.value) : "")
              }
            />
          ) : (
            <TextField
              label="Cliente ID (requerido para salidas)"
              type="number"
              value={clienteId}
              onChange={(e) =>
                setClienteId(e.target.value ? Number(e.target.value) : "")
              }
              required={!entrada}
            />
          )}

          <div className="md:col-span-2 lg:col-span-3 flex gap-2 mt-2">
            <Button
              disabled={loading}
              className="bg-indigo-600 text-white px-6"
            >
              {loading ? "Procesando…" : "Registrar movimiento"}
            </Button>
          </div>
        </form>

        {/* ===========================================================
            Tabla de movimientos
           =========================================================== */}
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700 font-medium">
              <tr>
                <th className="p-2 border">ID</th>
                <th className="p-2 border">Fecha</th>
                <th className="p-2 border">Tipo</th>
                <th className="p-2 border">Producto</th>
                <th className="p-2 border">Cantidad</th>
                <th className="p-2 border">Responsable</th>
                <th className="p-2 border">Documento</th>
                <th className="p-2 border">Proveedor / Cliente</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id} className="text-center hover:bg-slate-50">
                  <td className="border p-2">{m.id}</td>
                  <td className="border p-2">
                    {new Date(m.fecha).toLocaleString()}
                  </td>
                  <td
                    className={`border p-2 font-semibold ${
                      m.tipo === "entrada" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {m.tipo}
                  </td>
                  <td className="border p-2">
                    {m.producto_nombre} ({m.producto_clave})
                  </td>
                  <td className="border p-2">{m.cantidad}</td>
                  <td className="border p-2">{m.responsable || "-"}</td>
                  <td className="border p-2">{m.documento || "-"}</td>
                  <td className="border p-2">
                    {m.proveedor_nombre || m.cliente_nombre || "-"}
                  </td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center p-4 text-slate-500 italic"
                  >
                    No hay movimientos registrados.
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
