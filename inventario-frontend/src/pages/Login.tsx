import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import TextField from "../components/TextField";
import Button from "../components/Button";
import Alert from "../components/Alert";
import Navbar from "../components/Navbar";
import { loginPassword } from "../api/auth";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { setToken, setUser } = useAuth();

  // Mensaje persistente al cerrar sesión
  const [logoutMsg, setLogoutMsg] = useState<string | null>(
    location.state?.logoutMsg || sessionStorage.getItem("logoutMsg")
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 👁 Estado para mostrar/ocultar contraseña
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (logoutMsg) {
      sessionStorage.removeItem("logoutMsg");
      const timer = setTimeout(() => setLogoutMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [logoutMsg]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const { data } = await loginPassword(email.trim(), password);
      const preAuth = data?.data?.preAuth;
      const msg = data?.mensaje || "";

      if (data?.data?.usuario && data?.data?.token) {
        const usuario = data.data.usuario;
        const token = data.data.token;

        setUser(usuario);
        setToken(token);

        localStorage.setItem("usuario", JSON.stringify(usuario));
        localStorage.setItem("token", token);

        nav("/inicio", { replace: true });
        return;
      }

      if (data?.data?.needsEnrollment && preAuth) {
        nav(`/otp-setup?preAuth=${encodeURIComponent(preAuth)}`, {
          state: { fromMsg: msg },
        });
        return;
      }

      if (data?.data?.requiresOtp && preAuth && !data?.data?.offline) {
        nav(`/otp-verify?preAuth=${encodeURIComponent(preAuth)}`);
        return;
      }

      if (data?.data?.offline && preAuth) {
        const { offline } = data.data;
        nav(
          `/offline-pin?preAuth=${encodeURIComponent(
            preAuth
          )}&offlineJwt=${encodeURIComponent(offline.offlineJwt)}`,
          { state: { pin: offline.pin, expiresAt: offline.expiresAt } }
        );
        return;
      }

      setErr("No se recibió información válida del servidor.");
    } catch (r: any) {
      const backendMsg =
        r?.response?.data?.mensaje ||
        r?.response?.data?.error ||
        r?.mensaje ||
        "Error al iniciar sesión";
      setErr(backendMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <div className="flex-1 flex items-center justify-center p-4">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md bg-white p-6 rounded-xl shadow"
        >
          <h1 className="text-2xl font-bold mb-1">Iniciar sesión</h1>
          <p className="text-slate-600 mb-4">
            {import.meta.env.VITE_APP_BRAND || "Portal Inventario"}
          </p>

          {logoutMsg && (
            <div className="mb-3">
              <Alert kind="success">{logoutMsg}</Alert>
            </div>
          )}

          {err && (
            <div className="mb-3">
              <Alert>{err}</Alert>
            </div>
          )}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* 🔐 Campo contraseña con icono de ojo */}
          <div className="relative">
            <TextField
              label="Contraseña"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {/* Botón del ojo */}
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-9 text-slate-600 hover:text-slate-800"
            >
              {showPass ? (
                // 👁 Ojo abierto
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
                // 👁‍🗨 Ojo cerrado
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

          <div className="flex items-center justify-between mt-2 mb-4 text-sm">
            <a className="text-indigo-700 hover:underline" href="/recovery">
              ¿Olvidaste tu contraseña?
            </a>
            <a className="text-indigo-700 hover:underline" href="/registro">
              Crear cuenta
            </a>
          </div>

          <Button
            disabled={loading}
            className="w-full bg-indigo-600 text-white"
          >
            {loading ? "Verificando…" : "Continuar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
