import http from "./http";

export interface PaginatedResult<T> {
  page: number;
  pageSize: number;
  total: number;
  rows: T[];
}

/* ================================
   Tipos de filas que devuelve el backend
   ================================ */

export interface BitacoraAcceso {
  id: number;
  user_id: number | null;
  fecha: string;
  ip: string | null;
  user_agent: string | null;
  metodo: string;
  exito: boolean;
  detalle: string | null;
}

export interface BitacoraMovimiento {
  id: number;
  movimiento_id: number;
  fecha_log: string;
  fecha_mov: string;
  usuario_id: number | null;
  tipo: "entrada" | "salida";
  producto_id: number;
  cantidad: string;
  documento: string | null;
  responsable: string | null;
  proveedor_id: number | null;
  almacen_id: number | null;
  snapshot: any;
}

export interface BitacoraSistema {
  id: number;
  fecha: string;
  usuario_id: number | null;
  tabla: string;
  registro_id: number | null;
  operacion: "CREATE" | "UPDATE" | "DELETE";
  ip: string | null;
  user_agent: string | null;
  valores_antes: any;
  valores_despues: any;
}

/* ================================
   Filtros (coinciden con los schemas Zod)
   ================================ */

export interface AccesosQuery {
  page?: number;
  pageSize?: number;
  userId?: number;
  email?: string;
  metodo?: string;
  exito?: boolean;
  desde?: string;
  hasta?: string;
}

export interface MovimientosQuery {
  page?: number;
  pageSize?: number;
  usuarioId?: number;
  tipo?: "entrada" | "salida";
  productoId?: number;
  almacenId?: number;
  proveedorId?: number;
  desde?: string;
  hasta?: string;
}

export interface SistemaQuery {
  page?: number;
  pageSize?: number;
  usuarioId?: number;
  tabla?: string;
  operacion?: "CREATE" | "UPDATE" | "DELETE";
  desde?: string;
  hasta?: string;
}

/* ================================
   Helpers para mapear filtros → querystring
   ================================ */

function buildParams(obj: Record<string, any>): Record<string, any> {
  const params: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "boolean") {
      params[k] = v ? "true" : "false";
    } else {
      params[k] = String(v);
    }
  }
  return params;
}

/* ================================
   Funciones API
   ================================ */

export async function fetchBitacoraAccesos(
  query: AccesosQuery = {}
): Promise<PaginatedResult<BitacoraAcceso>> {
  const params = buildParams(query);
  const { data } = await http.get("/bitacora/accesos", { params });
  return data.data as PaginatedResult<BitacoraAcceso>;
}

export async function fetchBitacoraMovimientos(
  query: MovimientosQuery = {}
): Promise<PaginatedResult<BitacoraMovimiento>> {
  const params = buildParams(query);
  const { data } = await http.get("/bitacora/movimientos", { params });
  return data.data as PaginatedResult<BitacoraMovimiento>;
}

export async function fetchBitacoraSistema(
  query: SistemaQuery = {}
): Promise<PaginatedResult<BitacoraSistema>> {
  const params = buildParams(query);
  const { data } = await http.get("/bitacora/sistema", { params });
  return data.data as PaginatedResult<BitacoraSistema>;
}
