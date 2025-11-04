import React from "react";

export default function TextField({
  label,
  error,
  ...inputProps
}: {
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </span>
      <input
        {...inputProps}
        className={`w-full rounded-lg border px-3 py-2 outline-none focus:ring focus:ring-indigo-200 ${
          error ? "border-red-400" : "border-slate-300"
        }`}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
