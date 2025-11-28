import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { crearUsuario, validarUsuario } from "../api/usuarios";

type FieldErrors = {
  nombre?: string;
  email?: string;
  password?: string;
  confirm?: string;
};

export default function RegistroUsuario() {
  const nav = useNavigate();

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [errores, setErrores] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Solo letras (incluye acentos/ñ/ü) y espacios
  const nombreRegex = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/;

  // Normaliza espacios: evita "  Juan   Perez "
  function normalizarNombre(v: string) {
    return v.normalize("NFKC").replace(/\s+/g, " ").trim();
  }

  // ---------- Validación local ----------
  function validarLocal(): FieldErrors {
    const e: FieldErrors = {};
    const nombreTrim = normalizarNombre(nombre);

    if (nombreTrim.length > 0 && nombreTrim.length < 3) {
      e.nombre = "El nombre debe tener al menos 3 caracteres";
    } else if (nombreTrim.length > 0 && !nombreRegex.test(nombreTrim)) {
      e.nombre = "El nombre solo puede contener letras y espacios";
    }

    if (email.trim().length > 0 && !/\S+@\S+\.\S+/.test(email)) {
      e.email = "Formato de correo inválido";
    }

    if (password.length > 0 && password.length < 8) {
      e.password = "La contraseña debe tener al menos 8 caracteres";
    }

    if (confirm.length > 0 && password !== confirm) {
      e.confirm = "No coincide con la contraseña";
    }

    return e;
  }

  // ---------- Debounce para backend ----------
  const debouncedPayload = useMemo(
    () => ({
      nombre: normalizarNombre(nombre),
      email: email.trim(),
      password,
    }),
    [nombre, email, password]
  );

  useEffect(() => {
    setError(null);
    setSuccess(null);

    // 1) valida local primero
    const localErrs = validarLocal();
    setErrores(localErrs);

    // si hay errores locales, no consultes backend
    if (Object.keys(localErrs).length > 0) return;

    // 2) valida backend si pasó local
    const t = setTimeout(async () => {
      try {
        const res = await validarUsuario(debouncedPayload);
        if (res.data?.ok) {
          setErrores({});
        } else {
          setErrores(res.data?.errores || {});
        }
      } catch {
        console.warn("validarUsuario() falló, usando local");
      }
    }, 400);

    return () => clearTimeout(t);
  }, [debouncedPayload]);

  // ---------- Submit ----------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const localErrs = validarLocal();
    if (Object.keys(localErrs).length > 0) {
      setErrores(localErrs);
      return;
    }

    if (Object.keys(errores).length > 0) return;

    try {
      setLoading(true);

      const res = await crearUsuario(
        normalizarNombre(nombre),
        email.trim(),
        password,
        "lector"
      );

      if (res?.data?.codigo !== 0) {
        throw new Error(res?.data?.mensaje || "Error al registrar usuario");
      }

      setSuccess("Registro exitoso. Redirigiendo al inicio de sesión...");
      setTimeout(() => nav("/login"), 2000);
    } catch (err: any) {
      const msg =
        err?.response?.data?.mensaje ||
        err?.response?.data?.error ||
        err?.message ||
        "Error al registrar usuario";

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
          autoComplete="off"  // 🔧 evita que el navegador juegue raro
          noValidate          // 🔧 desactiva validación nativa
        >
          <h2 className="text-2xl font-bold mb-4 text-center text-slate-800">
            Crear cuenta
          </h2>

          {error && (
            <div className="mb-3 bg-red-100 text-red-700 border border-red-300 p-2 rounded text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-3 bg-green-100 text-green-700 border border-green-300 p-2 rounded text-sm">
              {success}
            </div>
          )}

          {/* Nombre */}
          <label className="block mb-2">
            <span className="text-gray-700">Nombre completo</span>
            <input
              type="text"
              value={nombre}
              onChange={(e) => {
                // filtra en vivo: solo letras y espacios
                const limpio = e.target.value.replace(
                  /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g,
                  ""
                );
                setNombre(limpio);
              }}
              className={`mt-1 w-full border rounded-md px-3 py-2 ${
                errores.nombre ? "border-red-400" : ""
              }`}
              placeholder="Ej. Ana Pérez"
              required
              autoComplete="name"   // ✅ nombre real
            />
            {errores.nombre && (
              <p className="text-xs text-red-600 mt-1">{errores.nombre}</p>
            )}
          </label>

          {/* Email */}
          <label className="block mb-2">
            <span className="text-gray-700">Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`mt-1 w-full border rounded-md px-3 py-2 ${
                errores.email ? "border-red-400" : ""
              }`}
              placeholder="ejemplo@correo.com"
              required
              autoComplete="email"  // ✅ campo correo
            />
            {errores.email && (
              <p className="text-xs text-red-600 mt-1">{errores.email}</p>
            )}
          </label>

          {/* Contraseña */}
          <label className="block mb-2">
            <span className="text-gray-700">Contraseña</span>

            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`mt-1 w-full border rounded-md px-3 py-2 pr-10 ${
                  errores.password ? "border-red-400" : ""
                }`}
                placeholder="Mínimo 8 caracteres"
                required
                autoComplete="new-password"  // ✅ para registro
              />

              {/* Ojo original */}
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-3 text-slate-600 hover:text-slate-800 focus:outline-none"
                aria-label="Mostrar u ocultar contraseña"
              >
                {showPass ? (
                  // Ojo abierto
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                ) : (
                  // Ojo cerrado
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.958-4.533M6.223 6.223A9.969 9.969 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.972 9.972 0 01-4.043 5.197M15 12a3 3 0 00-3-3m0 0a3 3 0 013 3m-3-3L3 3"
                    />
                  </svg>
                )}
              </button>
            </div>

            {errores.password && (
              <p className="text-xs text-red-600 mt-1">{errores.password}</p>
            )}
          </label>

          {/* Confirmar contraseña */}
          <label className="block mb-4">
            <span className="text-gray-700">Confirmar contraseña</span>

            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`mt-1 w-full border rounded-md px-3 py-2 pr-10 ${
                  errores.confirm ? "border-red-400" : ""
                }`}
                placeholder="Repite tu contraseña"
                required
                autoComplete="new-password"  // ✅ también como nueva
              />

              {/* Ojo original */}
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-3 text-slate-600 hover:text-slate-800 focus:outline-none"
                aria-label="Mostrar u ocultar confirmación"
              >
                {showConfirm ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.958-4.533M6.223 6.223A9.969 9.969 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.972 9.972 0 01-4.043 5.197M15 12a3 3 0 00-3-3m0 0a3 3 0 013 3m-3-3L3 3"
                    />
                  </svg>
                )}
              </button>
            </div>

            {errores.confirm && (
              <p className="text-xs text-red-600 mt-1">{errores.confirm}</p>
            )}
          </label>

          {/* Botón */}
          <button
            type="submit"
            disabled={loading || Object.keys(errores).length > 0}
            className={`w-full py-2 rounded-md text-white font-medium transition ${
              loading || Object.keys(errores).length > 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {loading ? "Registrando..." : "Registrarse"}
          </button>

          <p className="text-center text-sm text-gray-600 mt-4">
            ¿Ya tienes una cuenta?{" "}
            <Link to="/login" className="text-indigo-600 hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
