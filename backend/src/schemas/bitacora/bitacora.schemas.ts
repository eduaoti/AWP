// src/schemas/bitacora/bitacora.schemas.ts
import { z } from "zod";

/* ===========================================================
   📄 Esquema base para paginación
   =========================================================== */
const PaginacionSchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .default("1")
    .transform((v) => {
      const n = Number(v);
      return n < 1 ? 1 : n;
    }),

  pageSize: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .default("20")
    .transform((v) => {
      const n = Number(v);
      if (n < 1) return 1;
      if (n > 200) return 200;
      return n;
    }),
});

/* ===========================================================
   🧾 /bitacora/accesos
   Filtros: userId, email, metodo, exito, rango de fechas
   =========================================================== */
export const BitacoraAccesosQuerySchema = PaginacionSchema.extend({
  userId: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),
  email: z
    .string()
    .trim()
    .min(3)
    .max(180)
    .optional(),
  metodo: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .optional(),
  exito: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  desde: z
    .string()
    .datetime()
    .optional(),
  hasta: z
    .string()
    .datetime()
    .optional(),
}).strict();

/* ===========================================================
   📦 /bitacora/movimientos
   Filtros: usuario, tipo, producto, almacén, proveedor, fechas
   =========================================================== */
export const BitacoraMovimientosQuerySchema = PaginacionSchema.extend({
  usuarioId: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),
  tipo: z.enum(["entrada", "salida"]).optional(),
  productoId: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),
  almacenId: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),
  proveedorId: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),
  desde: z
    .string()
    .datetime()
    .optional(),
  hasta: z
    .string()
    .datetime()
    .optional(),
}).strict();

/* ===========================================================
   🛠 /bitacora/sistema
   Filtros: usuario, tabla, operacion, fechas
   =========================================================== */
export const BitacoraSistemaQuerySchema = PaginacionSchema.extend({
  usuarioId: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional(),
  tabla: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .optional(),
  operacion: z
    .enum(["CREATE", "UPDATE", "DELETE"])
    .optional(),
  desde: z
    .string()
    .datetime()
    .optional(),
  hasta: z
    .string()
    .datetime()
    .optional(),
}).strict();
