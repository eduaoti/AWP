import React from "react";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";
import { msUntilExp, decodeExp } from "../utils/jwt";
import SecureNavbar from "../components/SecureNavbar";

export default function Dashboard() {
  const { token, logout } = useAuth();
  const exp = decodeExp(token);
  const ms = msUntilExp(exp);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* 🔹 Navbar dinámica con logout y detección de rol */}
      <SecureNavbar />

      {/* 🔹 Contenido principal */}
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Panel principal</h1>
          <Button
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={logout}
          >
            Cerrar sesión
          </Button>
        </div>

        <p className="mt-3 text-slate-600">
          Sesión expira en:{" "}
          <span className="font-medium text-indigo-600">
            {ms ? Math.ceil(ms / 1000) : "—"} segundos
          </span>
        </p>

        <div className="mt-6 rounded-lg border p-6 bg-white shadow-sm">
          <h2 className="text-xl font-semibold mb-2 text-slate-700">
            Bienvenido 🎉
          </h2>
          <p className="text-slate-600">
            Tu autenticación funciona correctamente.  
            Desde aquí puedes acceder a tus módulos disponibles según tu rol.
          </p>
        </div>
      </main>
    </div>
  );
}
