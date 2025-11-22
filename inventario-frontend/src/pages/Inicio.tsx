import { useNavigate } from "react-router-dom";
import PrivateNavbar from "../components/PrivateNavbar";
import { useAuth } from "../context/AuthContext";

export default function Inicio() {
  const { user } = useAuth();
  const nav = useNavigate(); // 👈 para navegación SPA sin recargar

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <PrivateNavbar />

      <main className="flex flex-col items-center justify-center flex-1 text-center p-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          Bienvenido al Sistema de Inventario
        </h1>

        <p className="text-slate-600 max-w-xl mb-6">
          Hola{" "}
          <span className="font-semibold text-indigo-600">
            {user?.nombre || "usuario"}
          </span>
          , ahora puedes administrar tus <b>productos</b>, <b>proveedores</b>,{" "}
          <b>movimientos</b>, <b>almacenes</b> y <b>estadísticas</b> desde el menú superior.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={() => nav("/productos")}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow hover:bg-indigo-700 transition"
          >
            Ir a Productos
          </button>

          <button
            onClick={() => nav("/bitacora")}
            className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg shadow hover:bg-slate-300 transition"
          >
            Ver Bitácoras
          </button>
        </div>
      </main>

      <footer className="text-center py-4 text-slate-500 text-sm">
        © {new Date().getFullYear()} Sistema de Inventario – Todos los derechos reservados
      </footer>
    </div>
  );
}
