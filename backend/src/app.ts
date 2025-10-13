// src/app.ts
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import usuarios from "./routes/usuarios.routes";
import auth from "./routes/auth.routes";
import productos from "./routes/productos.routes";
import movimientos from "./routes/movimientos.routes";
import proveedores from "./routes/proveedores.routes";

import spec from "../docs/openapi.json";
import { errorHandler } from "./middlewares/error-handler";

/** Augmentamos Request para guardar el body crudo (solo diagnóstico interno) */
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

const app: Application = express();

app.set("trust proxy", true);
app.use(cors());

/** Body parser JSON (guardamos el crudo para detectar comillas simples) */
app.use(
  express.json({
    limit: "1mb",
    strict: true,
    verify: (req: Request, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

/** Handler específico para JSON inválido (sin DETALLE; solo {codigo, mensaje}) */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Errores que lanza express.json() cuando el JSON es inválido
  if (err && err.type === "entity.parse.failed") {
    const raw = req.rawBody || "";
    const tieneComillasSimples = raw.includes("'"); // heurística simple

    return res.status(400).json({
      codigo: 100,
      mensaje: tieneComillasSimples
        ? 'JSON inválido: usa comillas dobles (") para strings; no se permiten comillas simples (\').'
        : "JSON inválido.",
    });
  }
  return next(err);
});

/** Rutas */
app.get("/health", (_req: Request, res: Response) =>
  res.json({ codigo: 0, mensaje: "OK" })
);

app.use("/auth", auth);
app.use("/usuarios", usuarios);
app.use("/productos", productos);
app.use("/movimientos", movimientos);
app.use("/proveedores", proveedores);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));

/** 404 consistente (solo {codigo, mensaje}) */
app.use((req: Request, res: Response) =>
  res.status(404).json({ codigo: 4, mensaje: "No encontrado" })
);

/** Error handler genérico (debe ir al final) */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Si tu errorHandler ya responde con {codigo, mensaje}, puedes delegar:
  // return errorHandler(err, _req, res, _next);
  // O mantener un fallback mínimo en español:

  // Si el error trae status HTTP razonable, úsalo; si no, 500
  const status = typeof err?.status === "number" ? err.status : 500;

  // Mensaje genérico en español; NO incluir detalle
  let mensaje = "Error interno.";
  if (status === 400) mensaje = "Solicitud inválida.";
  if (status === 401) mensaje = "No autorizado.";
  if (status === 403) mensaje = "Prohibido.";
  if (status === 404) mensaje = "No encontrado.";

  return res.status(status).json({
    codigo: status === 200 ? 0 : status, // éxito=0; para errores puedes mapear a tu tabla de AppCode
    mensaje,
  });
});

// Si prefieres usar SIEMPRE tu errorHandler centralizado, descomenta esta línea y elimina el bloque anterior:
// app.use(errorHandler);

export default app;
