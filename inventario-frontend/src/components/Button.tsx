import React from "react";

export default function Button({
  children,
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 border border-slate-300 shadow-sm hover:shadow transition disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
