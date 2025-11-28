import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { recoveryRequest } from "../api/auth";
import Alert from "../components/Alert";
import TextField from "../components/TextField";
import Button from "../components/Button";

export default function RecoveryRequest() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null); // Error de correo
  const [touched, setTouched] = useState(false); // Estado para verificar si el campo ha sido tocado
  const nav = useNavigate();

  // Expresión regular para el correo electrónico
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // Validación en tiempo real del correo electrónico
  useEffect(() => {
    if (!touched) return; // No validamos si el campo no ha sido tocado

    if (!email) {
      setEmailError("¡El correo electrónico es obligatorio!");
    } else if (!emailRegex.test(email)) {
      setEmailError("¡El correo electrónico no es válido! Asegúrate de usar un formato como ejemplo@dominio.com.");
    } else if (email.length < 5 || email.length > 100) {
      setEmailError("¡El correo electrónico debe tener entre 5 y 100 caracteres!");
    } else {
      setEmailError(null); // Si el correo es válido, quitar el error
    }
  }, [email, touched]); // Solo se ejecuta si el correo cambia y si el campo ha sido tocado

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);

    try {
      const { data } = await recoveryRequest(email.trim());
      setMsg(data?.mensaje || "Token enviado a tu correo 📩");

      // 🔹 Redirigir a /reset después de 2 segundos
      setTimeout(() => nav("/reset", { replace: true }), 2000);
    } catch (r: any) {
      setErr(r?.response?.data?.mensaje || "Error al enviar el correo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-white p-6 rounded-xl shadow"
      >
        <h1 className="text-2xl font-bold mb-2">Recuperar contraseña</h1>
        <p className="text-slate-600 mb-3">
          Ingresa tu correo. Te enviaremos un token temporal para restablecer tu contraseña.
        </p>

        {msg && (
          <div className="mb-3">
            <Alert kind="success">{msg}</Alert>
          </div>
        )}
        {err && (
          <div className="mb-3">
            <Alert>{err}</Alert>
          </div>
        )}

        <TextField
          label="Correo electrónico"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setTouched(true); // Marcamos el campo como tocado cuando el usuario empieza a escribir
          }}
          required
        />
        
        {/* Mostrar el error de correo si existe y si el campo ha sido tocado */}
        {touched && emailError && (
          <p className="text-xs text-red-600 mt-1">{emailError}</p>
        )}

        <Button
          disabled={loading || !!emailError} // Deshabilitar el botón si hay error
          className="w-full bg-indigo-600 text-white mt-3"
        >
          {loading ? "Enviando…" : "Enviar token"}
        </Button>
      </form>
    </div>
  );
}
