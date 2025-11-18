import React, { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}

export default function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const baseStyle =
    "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-6 py-3 rounded-lg shadow-xl text-white text-sm font-medium animate-fade-in z-50";

  const colorStyle =
    type === "success"
      ? "bg-slate-600/90 backdrop-blur-sm"
      : "bg-red-600/90 backdrop-blur-sm";

  return (
    <div className={`${baseStyle} ${colorStyle}`} role="alert">
      {message}
    </div>
  );
}
