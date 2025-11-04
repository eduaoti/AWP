import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { crearUsuario } from "../api/usuarios";

export default function RegistroUsuario() {
  const nav = useNavigate();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // 🔍 Validaciones del frontend (rápidas, antes del backend)
    if (nombre.trim().length < 2) return setError("El nombre debe tener al menos 2 caracteres");
    if (!/\S+@\S+\.\S+/.test(email)) return setError("Formato de email inválido");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres");
    if (password !== confirm) return setError("Las contraseñas no coinciden");

    try {
      setLoading(true);
      const res = await crearUsuario(nombre, email, password, "lector");

      // 📬 Backend devuelve código y mensaje estandarizado
      if (res.data?.codigo && res.data?.codigo !== 0) {
        throw new Error(res.data.mensaje || "Error al registrar usuario");
      }

      setSuccess("Registro exitoso. Redirigiendo al inicio de sesión...");
      setTimeout(() => nav("/login"), 2000);
    } catch (err: any) {
      const msg =
        err.response?.data?.mensaje ||
        err.message ||
        "Error inesperado al registrar usuario";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-white shadow-lg rounded-xl p-6"
        >
          <h2 className="text-2xl font-bold mb-4 text-center text-slate-800">
            Crear cuenta
          </h2>

          {error && (
            <div className="mb-3 bg-red-100 text-red-700 border border-red-300 p-2 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-3 bg-green-100 text-green-700 border border-green-300 p-2 rounded">
              {success}
            </div>
          )}

          <label className="block mb-2">
            <span className="text-gray-700">Nombre completo</span>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2"
              required
            />
          </label>

          <label className="block mb-2">
            <span className="text-gray-700">Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2"
              required
            />
          </label>

          <label className="block mb-2">
            <span className="text-gray-700">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2"
              required
            />
          </label>

          <label className="block mb-4">
            <span className="text-gray-700">Confirmar contraseña</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2"
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded-md text-white ${
              loading ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {loading ? "Registrando..." : "Registrarse"}
          </button>

          <p className="text-center text-sm text-gray-600 mt-4">
            ¿Ya tienes una cuenta?{" "}
            <a href="/login" className="text-indigo-600 hover:underline">
              Inicia sesión
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
