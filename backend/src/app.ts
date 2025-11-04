import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import usuarios from "./routes/usuarios.routes";
import auth from "./routes/auth.routes";
import productos from "./routes/productos.routes";
import movimientos from "./routes/movimientos.routes";
import proveedores from "./routes/proveedores.routes";
import almacenes from "./routes/almacenes.routes";
import estadisticas from "./routes/estadisticas.routes";
import categorias from "./routes/categorias.routes"; // ✅ NUEVO: módulo de categorías

import spec from "../docs/openapi.json";
import { ok as okCode, sendCode } from "./status/respond";
import { AppCode } from "./status/codes";
import { jsonSyntaxErrorHandler, bodyHygieneGuard } from "./middlewares/validation/errors";
import { requireJson } from "./middlewares/security/require-json";

/** Extensión de Express.Request para diagnosticar cuerpo crudo (debug interno) */
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

const app: Application = express();
app.set("trust proxy", true);

// ———————————————————————————————————————
// Seguridad y configuración general
// ———————————————————————————————————————
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: "*", methods: "GET,POST,PUT,DELETE,OPTIONS" }));

// ———————————————————————————————————————
// Body parser con captura de rawBody
// ———————————————————————————————————————
app.use(
  express.json({
    limit: "1mb",
    strict: true,
    verify: (req: Request, _res, buf) => {
      req.rawBody = buf?.toString("utf8") ?? "";
    },
  })
);

// ———————————————————————————————————————
// Middlewares globales
// ———————————————————————————————————————
app.use(jsonSyntaxErrorHandler);
app.use(requireJson);
app.use(bodyHygieneGuard);

// ———————————————————————————————————————
// Endpoints base y API pública
// ———————————————————————————————————————
app.get("/health", (req: Request, res: Response) => okCode(req, res));

// ———————————————————————————————————————
// Rutas API (Controller → Service → Model)
// ———————————————————————————————————————
app.use("/auth", auth);
app.use("/usuarios", usuarios);
app.use("/productos", productos);
app.use("/movimientos", movimientos);
app.use("/proveedores", proveedores);
app.use("/almacenes", almacenes);
app.use("/estadisticas", estadisticas);
app.use("/categorias", categorias); // ✅ NUEVO: endpoint para CRUD de categorías

// ———————————————————————————————————————
// Swagger UI (Documentación API)
// ———————————————————————————————————————
app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));

// ———————————————————————————————————————
// 404 global
// ———————————————————————————————————————
app.use((req: Request, res: Response) =>
  sendCode(req, res, AppCode.NOT_FOUND, null, {
    message: "Recurso no encontrado",
    httpStatus: 404,
  })
);

// ———————————————————————————————————————
// Error handler global (último middleware)
// ———————————————————————————————————————
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  if (typeof err?.appCode === "number") {
    return sendCode(req, res, err.appCode, null, {
      httpStatus: err.httpStatus,
      message: err.message,
      detalle: err.detail ?? err.detalle,
    });
  }

  const mapStatus = (status: number): AppCode => {
    switch (status) {
      case 400: return AppCode.VALIDATION_FAILED;
      case 401: return AppCode.UNAUTHORIZED;
      case 403: return AppCode.FORBIDDEN;
      case 404: return AppCode.NOT_FOUND;
      default: return AppCode.INTERNAL_ERROR;
    }
  };

  return sendCode(req, res, mapStatus(err?.status ?? 500), null, {
    httpStatus: err?.status ?? 500,
    message: err?.message || "Error interno del servidor",
    detalle:
      process.env.NODE_ENV === "production"
        ? undefined
        : { error: String(err?.message || err) },
  });
});

export default app;
