// src/index.ts
import "dotenv/config";
import app from "./app";
import { pool, initDb } from "./db";
import { startEmailQueueWorker } from "./queueWorker";
import type { Request, Response, NextFunction } from "express";

// 👇 NUEVO: servicios de bajo stock
import {
  upsertActiveLowStockAlerts,
  notifyDueLowStockAlerts,
  resolveRecoveredAlerts,
} from "./services/lowStock";

const PORT = Number(process.env.PORT || 3000);

// === Middleware de error JSON ===
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const isEntityParseFailed = err && err.type === "entity.parse.failed";
  if (!isEntityParseFailed) return next(err);

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
      message: msg,
    },
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

/** ===============================
 *  Worker de Bajo Stock (Scheduler)
 *  - Usa advisory lock para ejecutar en una sola réplica
 *  - Corre cada 5 minutos (ajustable)
 *  =============================== */
const LOW_STOCK_INTERVAL_MS = Number(process.env.LOW_STOCK_INTERVAL_MS ?? 5 * 60 * 1000);
// Clave arbitraria para el lock global (debe ser constante)
const LOW_STOCK_LOCK_KEY = 987_654_321;

async function runLowStockCycle() {
  const client = await pool.connect();
  try {
    // Intento no bloqueante de tomar el lock
    const { rows } = await client.query<{ pg_try_advisory_lock: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS pg_try_advisory_lock",
      [LOW_STOCK_LOCK_KEY]
    );
    const gotLock = rows[0]?.pg_try_advisory_lock === true;
    if (!gotLock) {
      // Otra réplica ya está trabajando, salimos silenciosamente
      return;
    }

    // --- Trabajo protegido por el lock ---
    // 1) Reconciliación inicial (por si hubo huecos)
    await upsertActiveLowStockAlerts().catch(() => {});
    // 2) Notificar vencidas
    await notifyDueLowStockAlerts().catch(() => {});
    // 3) Resolver alertas cuando se repone stock
    await resolveRecoveredAlerts().catch(() => {});
  } catch (e) {
    console.error("⚠️ Ciclo bajo stock falló:", e);
  } finally {
    // Libera lock si lo tomaste (pg_advisory_unlock no truena si no eras dueño)
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [LOW_STOCK_LOCK_KEY]);
    } catch {}
    client.release();
  }
}

function startLowStockWorker() {
  // Primer ciclo al arrancar (no esperamos al interval)
  runLowStockCycle();
  // Luego, cada N ms
  setInterval(runLowStockCycle, LOW_STOCK_INTERVAL_MS);
  console.log(
    `📉 LowStock worker activo (cada ${Math.round(LOW_STOCK_INTERVAL_MS / 1000)}s).`
  );
}

async function bootstrap() {
  // 1) Asegurar esquema
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

  // 3) Iniciar worker de cola de correos
  try {
    startEmailQueueWorker();
    console.log(
      `📬 EmailQueue worker activo (cada ${process.env.EMAIL_QUEUE_INTERVAL_SECONDS || 60}s).`
    );
  } catch (err) {
    console.error("⚠️ No se pudo iniciar el EmailQueue worker:", err);
  }

  // 4) Iniciar worker de bajo stock (scheduler con advisory lock)
  try {
    startLowStockWorker();
  } catch (err) {
    console.error("⚠️ No se pudo iniciar el LowStock worker:", err);
  }

  // 5) Arrancar servidor HTTP
  const server = app.listen(PORT, () => {
    console.log(`🚀 API ready on http://localhost:${PORT}`);
  });

  // 6) Apagado elegante
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

  // 7) Manejo básico de errores no controlados
  process.on("unhandledRejection", (reason) => {
    console.error("🪲 UnhandledRejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("💥 UncaughtException:", err);
  });
}

bootstrap().catch((e) => {
  console.error("💣 Falló el bootstrap:", e);
  process.exit(1);
});
