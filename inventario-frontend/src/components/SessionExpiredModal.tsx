// src/components/SessionExpiredModal.tsx
import React from "react";
import Button from "./Button";

export default function SessionExpiredModal({
  visible,
  secondsLeft,
  onLogout,
  onExtend,
}: {
  visible: boolean;
  secondsLeft: number | null;
  onLogout: () => void;
  onExtend: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm text-center">
        <h2 className="text-xl font-bold mb-3">Sesión por expirar</h2>

        <p className="text-slate-600 mb-4">
          Tu sesión expira en{" "}
          <span className="font-bold text-red-600">
            {secondsLeft ?? 0}
          </span>{" "}
          segundos.
        </p>

        <p className="text-slate-600 mb-5">
          ¿Deseas salir o extender tu sesión?
        </p>

        <div className="flex gap-3 justify-center">
          <Button
            onClick={onLogout}
            className="bg-red-600 text-white px-4 py-2"
          >
            Salir
          </Button>

          <Button
            onClick={onExtend}
            className="bg-indigo-600 text-white px-4 py-2"
          >
            Extender
          </Button>
        </div>
      </div>
    </div>
  );
}
