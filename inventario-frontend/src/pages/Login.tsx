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

  // ✅ Intentar obtener el mensaje desde sessionStorage o desde state
  const [logoutMsg, setLogoutMsg] = useState<string | null>(
    location.state?.logoutMsg || sessionStorage.getItem("logoutMsg")
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // 🧹 Si hay mensaje de logout, borrarlo de sessionStorage después de mostrarlo
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

      // ✅ Login exitoso
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

      // OTP u otros casos
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

          {/* ✅ Mensaje persistente de cierre de sesión */}
          {logoutMsg && (
            <div className="mb-3">
              <Alert kind="success">{logoutMsg}</Alert>
            </div>
          )}

          {/* 🔴 Mensaje de error del backend */}
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

          <TextField
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

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
