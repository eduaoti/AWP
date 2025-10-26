import "dotenv/config";
import app from "./app";
import { pool, initDb } from "./db";
import { startEmailQueueWorker } from "./queueWorker";
import {
  upsertActiveLowStockAlerts,
  notifyDueLowStockAlerts,
  resolveRecoveredAlerts,
} from "./services/system/lowStock";

const PORT = Number(process.env.PORT || 3000);

// Configuración del worker de bajo stock
const LOW_STOCK_INTERVAL_MS = Number(process.env.LOW_STOCK_INTERVAL_MS ?? 5 * 60 * 1000);
const LOW_STOCK_LOCK_KEY = 987_654_321;

/** ===============================
 *  Ciclo principal del Worker de bajo stock
 *  =============================== */
async function runLowStockCycle() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ pg_try_advisory_lock: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS pg_try_advisory_lock",
      [LOW_STOCK_LOCK_KEY]
    );

    if (!rows[0]?.pg_try_advisory_lock) return; // otra réplica lo ejecuta

    await upsertActiveLowStockAlerts().catch(console.error);
    await notifyDueLowStockAlerts().catch(console.error);
    await resolveRecoveredAlerts().catch(console.error);
  } catch (e) {
    console.error("⚠️ Ciclo bajo stock falló:", e);
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [LOW_STOCK_LOCK_KEY]);
    } catch {}
    client.release();
  }
}

/** Inicializa el worker programado */
function startLowStockWorker() {
  runLowStockCycle();
  setInterval(runLowStockCycle, LOW_STOCK_INTERVAL_MS);
  console.log(`📉 LowStock worker activo (cada ${Math.round(LOW_STOCK_INTERVAL_MS / 1000)}s).`);
}

/** Bootstrap principal del servidor */
async function bootstrap() {
  await initDb();

  try {
    const res = await pool.query("SELECT NOW()");
    console.log("✅ Conectado a la BD. Hora actual:", res.rows[0].now);
  } catch (err) {
    console.error("❌ Error al conectar a la BD:", err);
    process.exit(1);
  }

  try {
    startEmailQueueWorker();
    console.log(
      `📬 EmailQueue worker activo (intervalo: ${process.env.EMAIL_QUEUE_INTERVAL_SECONDS || 60}s).`
    );
  } catch (err) {
    console.error("⚠️ No se pudo iniciar EmailQueue worker:", err);
  }

  try {
    startLowStockWorker();
  } catch (err) {
    console.error("⚠️ No se pudo iniciar LowStock worker:", err);
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 API lista en http://localhost:${PORT}`);
  });

  const graceful = async (signal: string) => {
    console.log(`\n🛑 Recibido ${signal}. Cerrando servidor...`);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
    console.log("✅ Pool cerrado. Bye!");
    process.exit(0);
  };

  process.on("SIGINT", () => graceful("SIGINT"));
  process.on("SIGTERM", () => graceful("SIGTERM"));

  process.on("unhandledRejection", (reason) => console.error("🪲 UnhandledRejection:", reason));
  process.on("uncaughtException", (err) => console.error("💥 UncaughtException:", err));
}

bootstrap().catch((e) => {
  console.error("💣 Falló el bootstrap:", e);
  process.exit(1);
});
