// src/app.ts
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import usuarios from "./routes/usuarios.routes";
import auth from "./routes/auth.routes";
import spec from "../docs/openapi.json";
import { errorHandler } from "./middlewares/error-handler";
import productos from "./routes/productos.routes";
import movimientos from "./routes/movimientos.routes";
import proveedores from "./routes/proveedores.routes";

/** Augmentamos Request para guardar el body crudo */
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

/** Guarda el body crudo para diagnosticar comillas simples */
app.use(express.json({
  limit: "1mb",
  verify: (req: Request, _res, buf) => {
    req.rawBody = buf.toString();
  }
}));

/** Rutas */
app.get("/health", (_: Request, res: Response) => res.json({ ok: true }));
app.use("/usuarios", usuarios);
app.use("/auth", auth);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
app.use("/productos", productos);
app.use("/movimientos", movimientos);
app.use("/proveedores", proveedores);

/** Handler específico para JSON inválido (incluye comillas simples) */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // express.json lanza este tipo cuando el JSON es inválido
  if (err && err.type === "entity.parse.failed") {
    const raw = req.rawBody || "";
    const parserMsg: string = typeof err.message === "string" ? err.message : "";
    const tieneComillasSimples = /'/.test(raw); // heurística simple

    return res.status(400).json({
      codigo: 100,
      mensaje: tieneComillasSimples
        ? 'JSON inválido: usa comillas dobles (") para strings; no se permiten comillas simples (\').'
        : "JSON inválido.",
      detalle: {
        expose: true,
        statusCode: 400,
        status: 400,
        type: "entity.parse.failed",
        parserMessage: parserMsg,
        body: raw.length ? raw : undefined
      },
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }
  return next(err);
});

/** 404 */
app.use((req, res) => res.status(404).json({ error: "Not found", path: req.originalUrl }));

/** Error handler genérico (debe ir al final) */
app.use(errorHandler);

export default app;
