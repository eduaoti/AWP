import express, { Application, Request, Response } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import usuarios from "./routes/usuarios.routes";
import auth from "./routes/auth.routes";
import spec from "../docs/openapi.json";

const app: Application = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_: Request, res: Response) => res.json({ ok: true }));
app.use("/usuarios", usuarios);
app.use("/auth", auth);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));

// 404 handler
app.use((req, res) => res.status(404).json({ error: "Not found", path: req.originalUrl }));

export default app;
