import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "./Button";

export default function SecureNavbar() {
  const { isAuthed, logout, token } = useAuth();
  const nav = useNavigate();

  // Decodificar rol desde el token JWT (si lo contiene)
  function getRoleFromToken(): string | null {
    try {
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload?.rol || null;
    } catch {
      return null;
    }
  }

  const rol = getRoleFromToken();

  return (
    <nav className="bg-indigo-600 text-white px-6 py-3 flex justify-between items-center shadow">
      <div className="flex items-center gap-4">
        <h1
          onClick={() => nav("/dashboard")}
          className="text-lg font-semibold cursor-pointer"
        >
          Inventario
        </h1>

        {/* 🔹 Solo mostrar enlaces si el usuario está autenticado */}
        {isAuthed && (
          <div className="flex items-center gap-4 text-sm">
            <Link to="/dashboard" className="hover:underline">
              Dashboard
            </Link>

            {/* 🔹 Mostrar CRUD solo a admins */}
            {rol === "admin" && (
              <Link to="/admin/usuarios" className="hover:underline">
                Usuarios
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 🔹 Lado derecho */}
      <div>
        {isAuthed ? (
          <Button
            onClick={() => {
              logout();
              nav("/login");
            }}
            className="bg-red-500 text-white px-3 py-1 text-sm"
          >
            Cerrar sesión
          </Button>
        ) : (
          <div className="flex gap-3">
            <Link
              to="/login"
              className="bg-white text-indigo-600 px-3 py-1 rounded hover:bg-indigo-50 text-sm"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/registro"
              className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-700 text-sm"
            >
              Registrarse
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
