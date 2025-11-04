import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TextField from "../components/TextField";
import Button from "../components/Button";
import Alert from "../components/Alert";
import Navbar from "../components/Navbar"; // ✅ Para mantener coherencia visual
import { verificarOtpLogin } from "../api/auth";
import { useAuth } from "../context/AuthContext";

// ✅ Hook auxiliar para leer parámetros del query (preAuth)
function useQuery() {
  const l = useLocation();
  return new URLSearchParams(l.search);
}

export default function OtpVerify() {
  const nav = useNavigate();
  const q = useQuery();
  const preAuth = q.get("preAuth") || "";
  const [code, setCode] = useState("");
  const [deviceId, setDeviceId] = useState(navigator.userAgent.slice(0, 40));
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setToken } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const { data } = await verificarOtpLogin(preAuth, code.trim(), deviceId.trim());
      console.log("Respuesta OTP:", data);

      const token = data?.data?.token;
      if (!token) throw new Error("No se recibió token del servidor");

      // ✅ Guardar token y redirigir a la página protegida
      localStorage.setItem("token", token);
      setToken(token);
      nav("/inicio", { replace: true }); // ⬅️ Redirige correctamente al dashboard protegido
    } catch (r: any) {
      console.error("Error al verificar OTP:", r);
      const backendMsg =
        r?.response?.data?.mensaje ||
        r?.data?.mensaje ||
        "Código OTP incorrecto o expirado";
      setErr(backendMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* 🔹 Navbar pública (igual que en Login y Registro) */}
      <Navbar />

      {/* 🔹 Contenido principal centrado */}
      <div className="flex-1 flex items-center justify-center p-4">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md bg-white p-6 rounded-xl shadow"
        >
          <h1 className="text-2xl font-bold mb-1">Verificación OTP</h1>
          <p className="text-slate-600 mb-4">
            Ingresa el código de tu aplicación o correo electrónico (válido por
            30 segundos).
          </p>

          {/* 🔴 Mensaje de error si el OTP falla */}
          {err && (
            <div className="mb-3">
              <Alert>{err}</Alert>
            </div>
          )}

          {/* 🧩 Campo OTP */}
          <TextField
            label="Código OTP"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />

          {/* 🖥️ Device ID opcional */}
          <TextField
            label="ID del dispositivo (opcional)"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          />

          {/* 🔘 Botón de envío */}
          <Button
            disabled={loading}
            className="w-full bg-indigo-600 text-white mt-4"
          >
            {loading ? "Verificando…" : "Confirmar acceso"}
          </Button>
        </form>
      </div>
    </div>
  );
}
