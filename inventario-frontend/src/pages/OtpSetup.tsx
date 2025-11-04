import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import TextField from "../components/TextField";
import Button from "../components/Button";
import { otpSetupStart, otpSetupConfirm } from "../api/auth";

function useQuery() {
  const l = useLocation();
  return new URLSearchParams(l.search);
}

export default function OtpSetup() {
  const nav = useNavigate();
  const q = useQuery();
  const preAuth = q.get("preAuth") || "";
  const [htmlMsg, setHtmlMsg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string>("");
  const [qrcode, setQrcode] = useState<string>("");
  const [code, setCode] = useState("");
  const [deviceId, setDeviceId] = useState(navigator.userAgent.slice(0, 40));
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // 🚀 Cargar los datos iniciales del OTP
  useEffect(() => {
    (async () => {
      try {
        const { data } = await otpSetupStart(preAuth);
        setSecret(data?.data?.secret || "");
        setQrcode(data?.data?.qrcode_png || "");
        setHtmlMsg((window.history.state?.usr as any)?.fromMsg || null);
      } catch (r: any) {
        setErr(r?.data?.mensaje || "No fue posible iniciar el setup OTP");
      }
    })();
  }, [preAuth]);

  // ✅ Confirmar OTP y redirigir al login tras éxito
  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const { data } = await otpSetupConfirm(preAuth, secret, code.trim(), deviceId.trim());
      const backups: string[] = data?.data?.backup_codes || [];

      setOkMsg("OTP configurado correctamente. Guarda tus códigos de respaldo:");

      if (backups.length)
        setHtmlMsg(
          `<ul class='list-disc pl-5'>${backups
            .map((c) => `<li><code>${c}</code></li>`)
            .join("")}</ul>`
        );

      // ⏳ Espera 2 segundos y redirige al login
      setTimeout(() => {
        nav("/login");
      }, 2000);

    } catch (r: any) {
      setErr(r?.data?.mensaje || "OTP inválido");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-2">Configurar OTP</h1>

        {err && (
          <div className="mb-3">
            <Alert>{err}</Alert>
          </div>
        )}

        {okMsg && (
          <div className="mb-3">
            <Alert kind="success">{okMsg}</Alert>
          </div>
        )}

        {htmlMsg && (
          <div
            className="mb-3 text-sm"
            dangerouslySetInnerHTML={{ __html: htmlMsg }}
          />
        )}

        {qrcode && (
          <img
            src={qrcode}
            alt="QR OTP"
            className="rounded border mb-4"
          />
        )}

        <p className="text-sm text-slate-600 mb-3">
          Secreto:{" "}
          <code className="bg-slate-100 px-2 py-1 rounded">{secret}</code>
        </p>

        <form onSubmit={onConfirm}>
          <TextField
            label="Código OTP"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <TextField
            label="ID del dispositivo (opcional)"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          />
          <div className="flex gap-2">
            <Button className="bg-indigo-600 text-white">Confirmar</Button>
            <Button
              type="button"
              onClick={() =>
                nav(`/otp-verify?preAuth=${encodeURIComponent(preAuth)}`)
              }
            >
              Ya tengo OTP
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
