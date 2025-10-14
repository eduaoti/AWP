// src/app.ts
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import usuarios from "./routes/usuarios.routes";
import auth from "./routes/auth.routes";
import productos from "./routes/productos.routes";
import movimientos from "./routes/movimientos.routes";
import proveedores from "./routes/proveedores.routes";
// ➕ nuevos
import clientes from "./routes/clientes.routes";
import estadisticas from "./routes/estadisticas.routes";

import spec from "../docs/openapi.json";
// Si quieres usar tu manejador global, puedes mantenerlo importado
// import { errorHandler } from "./middlewares/error-handler";
import { ok as okCode, sendCode } from "./status/respond";
import { AppCode } from "./status/codes";

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

/** Handler específico para JSON inválido */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err && err.type === "entity.parse.failed") {
    const raw = req.rawBody || "";
    const tieneComillasSimples = raw.includes("'");
    return sendCode(req, res, AppCode.VALIDATION_FAILED, null, {
      httpStatus: 400,
      message: tieneComillasSimples
        ? 'JSON inválido: usa comillas dobles (") para strings; no se permiten comillas simples (\').'
        : "JSON inválido."
    });
  }
  return next(err);
});

/** Rutas */
app.get("/health", (req: Request, res: Response) =>
  okCode(req, res) // => { codigo:0, mensaje:"OK", path, timestamp }
);

app.use("/auth", auth);
app.use("/usuarios", usuarios);
app.use("/productos", productos);
app.use("/movimientos", movimientos);
app.use("/proveedores", proveedores);
// ➕ montar nuevos módulos
app.use("/clientes", clientes);
app.use("/estadisticas", estadisticas);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));

/** 404 consistente */
app.use((req: Request, res: Response) =>
  sendCode(req, res, AppCode.NOT_FOUND)
);

/** Error handler genérico (debe ir al final) */
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  // Si tu error ya trae un AppCode mapeado, puedes respetarlo:
  if (typeof err?.appCode === "number") {
    return sendCode(req, res, err.appCode, null, {
      httpStatus: err.httpStatus,
      message: err.message,
      detalle: err.detail ?? err.detalle
    });
  }

  // Si viene un status HTTP, intenta mapear:
  if (err?.status === 400) return sendCode(req, res, AppCode.VALIDATION_FAILED, null, { message: err.message });
  if (err?.status === 401) return sendCode(req, res, AppCode.UNAUTHORIZED, null, { message: err.message });
  if (err?.status === 403) return sendCode(req, res, AppCode.FORBIDDEN, null, { message: err.message });
  if (err?.status === 404) return sendCode(req, res, AppCode.NOT_FOUND, null, { message: err.message });
  if (err?.code === "23505") return sendCode(req, res, AppCode.DB_CONSTRAINT, null, { message: "Restricción única violada" });

  // Fallback
  return sendCode(req, res, AppCode.INTERNAL_ERROR, null, {
    message: "Error interno del servidor",
    detalle: process.env.NODE_ENV === "production" ? undefined : { error: String(err?.message || err) }
  });
});

// Si prefieres usar SIEMPRE tu errorHandler centralizado, descomenta esta línea y elimina el bloque anterior:
// app.use(errorHandler);

export default app;
