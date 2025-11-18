// src/components/PrivateNavbar.tsx
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logout as logoutApi } from "../api/auth";

export default function PrivateNavbar() {
  const nav = useNavigate();
  const { user, logout: logoutCtx } = useAuth();

  async function handleLogout() {
    try {
      await logoutApi();
    } catch (error) {
      console.warn("⚠️ No se pudo cerrar sesión en backend (token expirado o sin conexión)");
    } finally {
      await logoutCtx();
      sessionStorage.setItem("logoutMsg", "Se cerró sesión correctamente ✅");
      nav("/login", { replace: true });
    }
  }

  return (
    <nav className="bg-indigo-600 text-white p-4 flex justify-between items-center">
      <div className="flex items-center space-x-6">
        {/* Logo / título clickable */}
        <span
          className="font-bold text-lg cursor-pointer"
          onClick={() => nav("/inicio")}
        >
          Inventario
        </span>

        {/* Links principales */}
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

        {/* 📊 Reportes (movimientos por producto) */}
        <Link to="/reportes/movimientos-producto" className="hover:underline">
          Reportes
        </Link>

        {/* 📝 Bitácora (tabs con accesos / movimientos / sistema) */}
        <Link to="/bitacora" className="hover:underline">
          Bitácora
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
