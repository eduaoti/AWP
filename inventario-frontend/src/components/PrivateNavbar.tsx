// src/components/PrivateNavbar.tsx
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logout as apiLogout } from "../api/auth";

export default function PrivateNavbar() {
  const nav = useNavigate();
  const { user, logout: logoutCtx } = useAuth();

  async function handleLogout() {
    try {
      // Intento de logout en backend (puede fallar con 401 si token ya expiró)
      await apiLogout();
    } catch (error) {
      console.warn("⚠️ Error cerrando sesión en backend:", error);
    } finally {
      // SIEMPRE cerrar sesión local y redirigir
      await logoutCtx(); // limpia token, usuario, modal, timers
      sessionStorage.setItem("logoutMsg", "Se cerró sesión correctamente ✅");
      nav("/login", { replace: true });
    }
  }

  return (
    <nav className="bg-indigo-600 text-white p-4 flex justify-between items-center">
      <div className="flex items-center space-x-6">
        <span
          className="font-bold text-lg cursor-pointer"
          onClick={() => nav("/inicio")}
        >
          Inventario
        </span>

        <Link to="/inicio" className="hover:underline">
          Inicio
        </Link>
        <Link to="/productos" className="hover:underline">
          Productos
        </Link>
        <Link to="/categorias" className="hover:underline">
          Categorías
        </Link>
        <Link to="/usuarios" className="hover:underline">
          Usuarios
        </Link>
        <Link to="/movimientos" className="hover:underline">
          Movimientos
        </Link>
        <Link to="/proveedores" className="hover:underline">
          Proveedores
        </Link>
        <Link to="/almacenes" className="hover:underline">
          Almacenes
        </Link>
        <Link to="/estadisticas" className="hover:underline">
          Estadísticas
        </Link>
      </div>

      <div className="flex items-center space-x-4">
        {user && <span className="font-medium">{user.nombre}</span>}
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-white"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
