// src/dto/estadisticas.dto.ts
import { z } from "zod";

/* ===========================================================
   Esquemas base
   =========================================================== */
const ISO_Z_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export const IsoStrictRequired = z
  .string()
  .trim()
  .min(1, "No puede estar vacío")
  .regex(ISO_Z_REGEX, "Fecha inválida: usa ISO-8601 con Z (ej. 2025-01-01T00:00:00Z)")
  .transform((v) => new Date(v).toISOString());

export const RangoFechasSchema = z
  .object({
    desde: IsoStrictRequired,
    hasta: IsoStrictRequired,
  })
  .strict()
  .superRefine((val, ctx) => {
    const { desde, hasta } = val;
    const now = new Date().toISOString();

    if (desde > now)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["desde"], message: "Rango inválido: 'desde' no puede ser futura" });
    if (hasta > now)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["hasta"], message: "Rango inválido: 'hasta' no puede ser futura" });
    if (hasta <= desde)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["hasta"], message: "'hasta' debe ser mayor que 'desde'" });

    const deltaMs = new Date(hasta).getTime() - new Date(desde).getTime();
    if (deltaMs < 1000)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["hasta"], message: "La ventana debe ser de al menos 1 segundo" });
    const dias = deltaMs / (1000 * 60 * 60 * 24);
    if (dias > 366)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["hasta"], message: "La ventana no debe exceder 366 días" });
  });

export const LimiteOpt = z
  .coerce.number()
  .int("limite → Debe ser entero")
  .positive("limite → Debe ser ≥ 1")
  .max(100000, "limite → Demasiado grande")
  .optional();

export const TopOpt = z
  .coerce.number()
  .int("top → Debe ser entero")
  .positive("top → Debe ser ≥ 1")
  .max(100000, "top → Demasiado grande")
  .optional();

/* ===========================================================
   Schemas específicos  (usa safeExtend por superRefine en RangoFechasSchema)
   =========================================================== */
export const VentasPorProductoSchema = RangoFechasSchema;
export const ProductosMenorVentaSchema = RangoFechasSchema.safeExtend({ limite: LimiteOpt });
export const ProductosExtremosSchema = RangoFechasSchema.safeExtend({ top: TopOpt });

/* ===========================================================
   Tipos TypeScript
   =========================================================== */
export type VentasPorProductoDTO = z.infer<typeof VentasPorProductoSchema>;
export type ProductosMenorVentaDTO = z.infer<typeof ProductosMenorVentaSchema>;
export type ProductosExtremosDTO = z.infer<typeof ProductosExtremosSchema>;

/* ===========================================================
   Función auxiliar genérica
   =========================================================== */
function result<T>(parsed: ReturnType<typeof z.ZodSchema.prototype.safeParse>):
  { ok: true; data: T } | { ok: false; errores: string[] } {
  if ((parsed as any).success) return { ok: true, data: (parsed as any).data as T };
  return { ok: false, errores: (parsed as any).error.issues.map((i: any) => i.message) };
}

/* ===========================================================
   Validadores tipados
   =========================================================== */
export const validarVentasPorProducto = (body: unknown):
  { ok: true; data: VentasPorProductoDTO } | { ok: false; errores: string[] } =>
  result<VentasPorProductoDTO>(VentasPorProductoSchema.safeParse(body));

export const validarProductosMenorVenta = (body: unknown):
  { ok: true; data: ProductosMenorVentaDTO } | { ok: false; errores: string[] } =>
  result<ProductosMenorVentaDTO>(ProductosMenorVentaSchema.safeParse(body));

export const validarProductosExtremos = (body: unknown):
  { ok: true; data: ProductosExtremosDTO } | { ok: false; errores: string[] } =>
  result<ProductosExtremosDTO>(ProductosExtremosSchema.safeParse(body));
