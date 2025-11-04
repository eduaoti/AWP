import React, { useState } from "react";
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
  const nav = useNavigate();

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
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Button disabled={loading} className="w-full bg-indigo-600 text-white mt-3">
          {loading ? "Enviando…" : "Enviar token"}
        </Button>
      </form>
    </div>
  );
}
