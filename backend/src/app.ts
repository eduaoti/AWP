import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import usuarios from "./routes/usuarios.routes";
import auth from "./routes/auth.routes";
import productos from "./routes/productos.routes";
import movimientos from "./routes/movimientos.routes";
import proveedores from "./routes/proveedores.routes";
import clientes from "./routes/clientes.routes";
import estadisticas from "./routes/estadisticas.routes";

import spec from "../docs/openapi.json";
import { ok as okCode, sendCode } from "./status/respond";
import { AppCode } from "./status/codes";
import { jsonSyntaxErrorHandler, bodyHygieneGuard } from "./middlewares/errors";
import { requireJson } from "./middlewares/require-json";

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

// Seguridad y CORS
app.use(helmet());
app.use(cors());

/** Body parser JSON (captura rawBody) */
app.use(
  express.json({
    limit: "1mb",
    strict: true,
    verify: (req: Request, _res, buf) => {
      try { req.rawBody = buf.toString("utf8"); } catch { req.rawBody = ""; }
    },
  })
);

/** Handler específico de SINTAXIS JSON (debe ir justo después) */
app.use(jsonSyntaxErrorHandler);

/** Content-Type: application/json global para métodos con body */
app.use(requireJson);

/** Guardias de higiene/seguridad del body ya parseado */
app.use(bodyHygieneGuard);

/** Rutas */
app.get("/health", (req: Request, res: Response) => okCode(req, res));

app.use("/auth", auth);
app.use("/usuarios", usuarios);
app.use("/productos", productos);
app.use("/movimientos", movimientos);
app.use("/proveedores", proveedores);
app.use("/clientes", clientes);
app.use("/estadisticas", estadisticas);

/** Swagger UI */
app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));

/** 404 consistente */
app.use((req: Request, res: Response) => sendCode(req, res, AppCode.NOT_FOUND));

/** Error handler genérico (final) */
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  if (typeof err?.appCode === "number") {
    return sendCode(req, res, err.appCode, null, {
      httpStatus: err.httpStatus,
      message: err.message,
      detalle: err.detail ?? err.detalle,
    });
  }
  if (err?.status === 400)
    return sendCode(req, res, AppCode.VALIDATION_FAILED, null, { message: err.message });
  if (err?.status === 401)
    return sendCode(req, res, AppCode.UNAUTHORIZED, null, { message: err.message });
  if (err?.status === 403)
    return sendCode(req, res, AppCode.FORBIDDEN, null, { message: err.message });
  if (err?.status === 404)
    return sendCode(req, res, AppCode.NOT_FOUND, null, { message: err.message });
  if (err?.code === "23505")
    return sendCode(req, res, AppCode.DB_CONSTRAINT, null, { message: "Restricción única violada" });

  return sendCode(req, res, AppCode.INTERNAL_ERROR, null, {
    message: "Error interno del servidor",
    detalle: process.env.NODE_ENV === "production" ? undefined : { error: String(err?.message || err) },
  });
});

export default app;
