import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="bg-indigo-600 text-white p-4 flex justify-between items-center">
      <h1 className="text-xl font-bold tracking-wide">Inventario</h1>
      <div className="space-x-4">
        <Link
          to="/login"
          className="hover:bg-indigo-500 px-3 py-1 rounded transition"
        >
          Iniciar sesión
        </Link>
        <Link
          to="/registro"
          className="bg-white text-indigo-600 px-3 py-1 rounded hover:bg-slate-100 transition"
        >
          Registrarse
        </Link>
      </div>
    </nav>
  );
}
