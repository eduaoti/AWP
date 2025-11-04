import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { recoveryConfirm } from "../api/auth";
import Alert from "../components/Alert";
import TextField from "../components/TextField";
import Button from "../components/Button";

export default function RecoveryConfirm() {
  const nav = useNavigate();
  const [token, setToken] = useState("");
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);

    if (!token.trim()) {
      setErr("Debes ingresar el token que recibiste por correo.");
      setLoading(false);
      return;
    }

    try {
      const { data } = await recoveryConfirm(token.trim(), pwd.trim());
      setMsg(data?.mensaje || "Contraseña restablecida con éxito ✅");

      // 🔹 Redirigir al login después de 2 segundos
      setTimeout(() => nav("/login", { replace: true }), 2000);
    } catch (r: any) {
      setErr(r?.response?.data?.mensaje || "Error al actualizar contraseña");
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
        <h1 className="text-2xl font-bold mb-2">Restablecer contraseña</h1>
        <p className="text-slate-600 mb-4">
          Ingresa el token que recibiste por correo y tu nueva contraseña.
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
          label="Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
        />

        <TextField
          label="Nueva contraseña"
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          required
        />

        <Button
          disabled={loading}
          className="w-full bg-indigo-600 text-white mt-3"
        >
          {loading ? "Procesando…" : "Actualizar contraseña"}
        </Button>
      </form>
    </div>
  );
}
