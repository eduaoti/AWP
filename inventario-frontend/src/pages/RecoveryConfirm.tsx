import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { recoveryConfirm } from "../api/auth";
import Alert from "../components/Alert";
import TextField from "../components/TextField";
import Button from "../components/Button";

export default function RecoveryConfirm() {
  const nav = useNavigate();
  const [token, setToken] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [confirmPwdError, setConfirmPwdError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);  // Estado para mostrar/ocultar la contraseña
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);  // Estado para confirmar contraseña

  // Expresión regular para la contraseña
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;

  // Validación en tiempo real de la longitud del token y la contraseña
  useEffect(() => {
    // Validación del token (debe tener 48 caracteres hexadecimales)
    if (token && token.length !== 48) {
      setTokenError("El token debe tener exactamente 48 caracteres.");
    } else {
      setTokenError(null);
    }

    // Validaciones en tiempo real para la contraseña
    if (pwd && !passwordRegex.test(pwd)) {
      setPwdError("La contraseña debe tener entre 8 y 20 caracteres, una mayúscula, un número y un carácter especial.");
    } else {
      setPwdError(null);
    }

    // Validación para la confirmación de la contraseña
    if (confirmPwd && confirmPwd !== pwd) {
      setConfirmPwdError("Las contraseñas no coinciden.");
    } else {
      setConfirmPwdError(null);
    }
  }, [pwd, confirmPwd, token]);

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

    if (pwdError || confirmPwdError || tokenError) {
      setErr("Por favor, corrige los errores antes de continuar.");
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
        {/* Mostrar el error de token */}
        {tokenError && <p className="text-xs text-red-600 mt-1">{tokenError}</p>}

        <div className="mb-4 relative">
          <TextField
            label="Nueva contraseña"
            type={showPwd ? "text" : "password"}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPwd((prev) => !prev)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-600 hover:text-slate-800 focus:outline-none"
            aria-label="Mostrar u ocultar contraseña"
          >
            {showPwd ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.958-4.533M6.223 6.223A9.969 9.969 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.972 9.972 0 01-4.043 5.197M15 12a3 3 0 00-3-3m0 0a3 3 0 013 3m-3-3L3 3" />
              </svg>
            )}
          </button>
        </div>

        {/* Mostrar el error de contraseña */}
        {pwdError && <p className="text-xs text-red-600 mt-1">{pwdError}</p>}

        <div className="mb-4 relative">
          <TextField
            label="Confirmar contraseña"
            type={showConfirmPwd ? "text" : "password"}
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPwd((prev) => !prev)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-600 hover:text-slate-800 focus:outline-none"
            aria-label="Mostrar u ocultar confirmación"
          >
            {showConfirmPwd ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.958-4.533M6.223 6.223A9.969 9.969 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.972 9.972 0 01-4.043 5.197M15 12a3 3 0 00-3-3m0 0a3 3 0 013 3m-3-3L3 3" />
              </svg>
            )}
          </button>
        </div>

        {/* Mostrar el error de confirmación de contraseña */}
        {confirmPwdError && <p className="text-xs text-red-600 mt-1">{confirmPwdError}</p>}

        <Button
          disabled={loading || !!pwdError || !!confirmPwdError || !!tokenError || !token || !pwd || !confirmPwd}
          className="w-full bg-indigo-600 text-white mt-3"
        >
          {loading ? "Procesando…" : "Actualizar contraseña"}
        </Button>
      </form>
    </div>
  );
}
