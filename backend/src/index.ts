// src/index.ts
import "dotenv/config";
import app from "./app";
import { pool, initDb } from "./db";
import { startEmailQueueWorker } from "./queueWorker";
import type { Request, Response, NextFunction } from "express";

const PORT = Number(process.env.PORT || 3000);

/* ========= Manejo de errores de parseo JSON =========
   - body-parser (express.json) lanza err.type = "entity.parse.failed" cuando el JSON es inválido.
   - Si el mensaje sugiere comillas simples, devolvemos un error explícito.
   - Este middleware debe registrarse ANTES de levantar el servidor y DESPUÉS de que app tenga sus rutas.
*/
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Solo atendemos errores de parseo de JSON
  const isEntityParseFailed = err && err.type === "entity.parse.failed";
  if (!isEntityParseFailed) return next(err);

  // Heurística: detectar comillas simples en el mensaje del parser
  // Ejemplos típicos: "Unexpected token ''', ... is not valid JSON" o "Unexpected token ' in JSON at position ..."
  const msg: string = typeof err.message === "string" ? err.message : "";
  const tieneComillasSimples =
    /Unexpected token\s*'{1}/i.test(msg) || /''',/.test(msg);

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
      message: msg
    },
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

async function bootstrap() {
  // 1) Asegurar esquema (crea BD si falta y aplica init.sql)
  await initDb();

  // 2) Prueba de conexión
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("✅ Conectado a la BD. Hora actual:", res.rows[0].now);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ Error al conectar a la BD:", msg);
    process.exit(1);
  }

  // 3) Iniciar worker de cola de correos (reintenta envíos cuando vuelva internet)
  try {
    startEmailQueueWorker();
    console.log(
      `📬 EmailQueue worker activo (cada ${process.env.EMAIL_QUEUE_INTERVAL_SECONDS || 60}s).`
    );
  } catch (err) {
    console.error("⚠️ No se pudo iniciar el EmailQueue worker:", err);
  }

  // 4) Arrancar servidor HTTP
  const server = app.listen(PORT, () => {
    console.log(`🚀 API ready on http://localhost:${PORT}`);
  });

  // 5) Apagado elegante
  const graceful = async (signal: string) => {
    try {
      console.log(`\n🛑 Recibido ${signal}. Cerrando servidor...`);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      console.log("🔌 Servidor cerrado. Cerrando pool de Postgres...");
      await pool.end();
      console.log("✅ Pool cerrado. Bye!");
      process.exit(0);
    } catch (e) {
      console.error("❌ Error durante el apagado:", e);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => graceful("SIGINT"));
  process.on("SIGTERM", () => graceful("SIGTERM"));

  // 6) Manejo básico de errores no controlados
  process.on("unhandledRejection", (reason) => {
    console.error("🪲 UnhandledRejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("💥 UncaughtException:", err);
    // opcional: decide si terminar el proceso o seguir
  });
}

bootstrap().catch((e) => {
  console.error("💣 Falló el bootstrap:", e);
  process.exit(1);
});
