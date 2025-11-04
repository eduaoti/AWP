import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TextField from "../components/TextField";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { verificarOtpOffline } from "../api/auth";
import { useAuth } from "../context/AuthContext";

function useQuery() {
  const l = useLocation();
  return new URLSearchParams(l.search);
}

export default function OfflinePin() {
  const nav = useNavigate();
  const q = useQuery();
  const preAuth = q.get("preAuth") || "";
  const offlineJwt = q.get("offlineJwt") || "";
  const state = (useLocation() as any).state as
    | { pin?: string; expiresAt?: string }
    | undefined;
  const [pin, setPin] = useState<string>("");
  const [deviceId, setDeviceId] = useState(navigator.userAgent.slice(0, 40));
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setToken } = useAuth();

  const hint = useMemo(
    () =>
      state?.pin
        ? `PIN sugerido (modo sin internet): ${state.pin}`
        : undefined,
    [state]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { data } = await verificarOtpOffline(preAuth, offlineJwt, pin.trim(), deviceId.trim());
      const token = data?.data?.token;
      if (!token) throw new Error("Sin token");
      setToken(token);
      nav("/");
    } catch (r: any) {
      setErr(r?.data?.mensaje || "PIN inválido o expirado");
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
        <h1 className="text-2xl font-bold mb-1">PIN offline</h1>
        <p className="text-slate-600 mb-2">Ingresa el PIN de un solo uso.</p>
        {hint && (
          <div className="mb-3">
            <Alert kind="info">{hint}</Alert>
          </div>
        )}
        {err && (
          <div className="mb-3">
            <Alert>{err}</Alert>
          </div>
        )}
        <TextField
          label="PIN"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
        />
        <TextField
          label="ID del dispositivo (opcional)"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
        />
        <Button disabled={loading} className="w-full bg-indigo-600 text-white">
          {loading ? "Verificando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
