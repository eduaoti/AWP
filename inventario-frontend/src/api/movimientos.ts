
// src/api/movimientos.ts
import api from "./http";

/* ===========================================================
   Tipos
   =========================================================== */
export interface Movimiento {
  id: number;
  fecha: string;
  tipo: "entrada" | "salida";
  producto_clave: string;
  producto_nombre: string;
  cantidad: number;
  documento?: string | null;
  responsable?: string | null;
  proveedor_nombre?: string | null;
  cliente_nombre?: string | null;
}

/* ===========================================================
   Registrar un movimiento (entrada o salida)
   =========================================================== */
export function registrarMovimiento(data: {
  entrada: boolean;
  producto_clave: string;
  cantidad: number;
  documento?: string;
  responsable?: string;
  proveedor_id?: number;
  cliente_id?: number;
}) {
  // ⚠️ Importante: el backend exige Content-Type: application/json
  // y un cuerpo con campos válidos según MovimientoSchema
  return api.post("/movimientos", data);
}

/* ===========================================================
   Listar movimientos con límites defensivos
   =========================================================== */
export function listarMovimientos(limit = 50, offset = 0) {
  return api.get("/movimientos", {
    params: { limit, offset },
  });
}
