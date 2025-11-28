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

type Touched = {
  nombre: boolean;
  email: boolean;
  password: boolean;
  confirm: boolean;
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

  const [touched, setTouched] = useState<Touched>({
    nombre: false,
    email: false,
    password: false,
    confirm: false,
  });

  const nombreRegex = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/;
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  function normalizarNombre(v: string) {
    return v.normalize("NFKC").replace(/\s+/g, " ").trim();
  }

  // Validación en tiempo real
  function validarLocal(): FieldErrors {
    const e: FieldErrors = {};
    const nombreTrim = normalizarNombre(nombre);
    const passwordTrim = password.trim(); // Eliminar espacios al inicio y final
    const confirmTrim = confirm.trim(); // Eliminar espacios al inicio y final

    // Validación nombre
    if (nombreTrim.length === 0) {
      e.nombre = "¡El nombre es obligatorio! Por favor, ingresa tu nombre completo.";
    } else if (nombreTrim.length < 3) {
      e.nombre = "¡El nombre debe tener al menos 3 caracteres! Usa tu nombre completo si es necesario.";
    } else if (nombreTrim.length > 100) {
      e.nombre = "¡El nombre no puede tener más de 100 caracteres! Usa un nombre más corto.";
    } else if (!nombreRegex.test(nombreTrim)) {
      e.nombre = "¡El nombre solo puede contener letras y espacios! Asegúrate de no usar números ni caracteres especiales.";
    }

    // Validación correo electrónico
    if (email.trim().length === 0) {
      e.email = "¡El correo electrónico es obligatorio! Por favor, ingresa un correo válido.";
    } else if (!emailRegex.test(email)) {
      e.email = "¡El correo electrónico no es válido! Asegúrate de usar un formato como ejemplo@dominio.com.";
    } else if (email.trim().length < 5 || email.trim().length > 100) {
      e.email = "¡El correo electrónico debe tener entre 5 y 100 caracteres!";
    }

    // Validación contraseña
    if (passwordTrim.length === 0) {
      e.password = "¡La contraseña es obligatoria! Debes crear una contraseña segura.";
    } else if (passwordTrim.length < 8 || passwordTrim.length > 20) {
      e.password = "¡La contraseña debe tener entre 8 y 20 caracteres!";
    } else if (!passwordRegex.test(passwordTrim)) {
      e.password =
        "¡La contraseña debe tener al menos una mayúscula, un número y un carácter especial (por ejemplo, @, $, !).";
    }

    // Validación confirmación de contraseña
    if (confirmTrim.length === 0) {
      e.confirm = "¡Debes confirmar la contraseña! Asegúrate de escribirla igual.";
    } else if (confirmTrim !== passwordTrim) {
      e.confirm = "¡Las contraseñas no coinciden! Asegúrate de que ambas contraseñas sean iguales.";
    } else if (confirmTrim.length < 8 || confirmTrim.length > 20) {
      e.confirm = "¡La confirmación de contraseña debe tener entre 8 y 20 caracteres!";
    }

    return e;
  }

  // Debounced input para evitar múltiples validaciones en el servidor
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

    // Validación local en tiempo real
    const localErrs = validarLocal();
    setErrores(localErrs);

    if (Object.keys(localErrs).length > 0) return;

    const t = setTimeout(async () => {
      try {
        const res = await validarUsuario(debouncedPayload);
        if (res.data?.ok) {
          setErrores({});
        } else {
          setErrores(res.data?.errores || {});
        }
      } catch {
        console.warn("validarUsuario() falló, usando validación local");
      }
    }, 400);

    return () => clearTimeout(t);
  }, [debouncedPayload]);

  // Validar confirmación de la contraseña al cambiarla
  useEffect(() => {
    if (confirm !== password) {
      setErrores((prev) => ({
        ...prev,
        confirm: "¡Las contraseñas no coinciden! Asegúrate de que ambas contraseñas sean iguales.",
      }));
    } else {
      setErrores((prev) => {
        const { confirm, ...rest } = prev;
        return rest;
      });
    }
  }, [confirm, password]);

  const handleChange = (field: keyof Touched, value: string) => {
    if (!touched[field]) {
      setTouched((prev) => ({ ...prev, [field]: true }));
    }
    if (field === "nombre") setNombre(value);
    if (field === "email") setEmail(value);
    if (field === "password") setPassword(value);
    if (field === "confirm") setConfirm(value);
  };

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
        throw new Error(res?.data?.mensaje || "¡Hubo un problema al registrar tu cuenta! Intenta nuevamente.");
      }

      setSuccess("¡Registro exitoso! Te redirigiremos al inicio de sesión...");
      setTimeout(() => nav("/login"), 2000);
    } catch (err: any) {
      const msg =
        err?.response?.data?.mensaje ||
        err?.response?.data?.error ||
        err?.message ||
        "¡Error al registrar usuario! Por favor, intenta nuevamente.";

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
              onChange={(e) => handleChange("nombre", e.target.value)}
              className={`mt-1 w-full border rounded-md px-3 py-2 ${
                touched.nombre && errores.nombre ? "border-red-400" : ""
              }`}
              placeholder="Ej. Ana Pérez"
              required
            />
            {touched.nombre && errores.nombre && (
              <p className="text-xs text-red-600 mt-1">{errores.nombre}</p>
            )}
          </label>

          {/* Email */}
          <label className="block mb-2">
            <span className="text-gray-700">Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(e) => handleChange("email", e.target.value)}
              className={`mt-1 w-full border rounded-md px-3 py-2 ${
                touched.email && errores.email ? "border-red-400" : ""
              }`}
              placeholder="ejemplo@correo.com"
              required
            />
            {touched.email && errores.email && (
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
                onChange={(e) => handleChange("password", e.target.value)}
                className={`mt-1 w-full border rounded-md px-3 py-2 pr-10 ${
                  touched.password && errores.password ? "border-red-400" : ""
                }`}
                placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número, 1 carácter especial"
                required
              />

              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-3 text-slate-600 hover:text-slate-800 focus:outline-none"
                aria-label="Mostrar u ocultar contraseña"
              >
                {showPass ? (
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

            {touched.password && errores.password && (
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
                onChange={(e) => handleChange("confirm", e.target.value)}
                className={`mt-1 w-full border rounded-md px-3 py-2 pr-10 ${
                  touched.confirm && errores.confirm ? "border-red-400" : ""
                }`}
                placeholder="Repite tu contraseña"
                required
              />

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

            {touched.confirm && errores.confirm && (
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
