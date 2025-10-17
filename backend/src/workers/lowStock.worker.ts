import { upsertActiveLowStockAlerts, notifyDueLowStockAlerts, resolveRecoveredAlerts } from "../services/lowStock.service";
import { pool } from "../db";

const LOCK_KEY = BigInt(0x6f6c5f73746b); // "ol_stk"

async function acquireLock(): Promise<boolean> {
  const { rows } = await pool.query<{ pg_try_advisory_lock: boolean }>(
    `SELECT pg_try_advisory_lock($1) AS pg_try_advisory_lock`,
    [LOCK_KEY]
  );
  return !!rows[0]?.pg_try_advisory_lock;
}

async function releaseLock() {
  await pool.query(`SELECT pg_advisory_unlock($1)`, [LOCK_KEY]);
}

export function startLowStockWorker() {
  let running = false;
  const TICK_EVERY_MS = Number(process.env.LOW_STOCK_TICK_MS ?? 60_000); // cada 1 min

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const hasLock = await acquireLock();
      if (!hasLock) return;

      await upsertActiveLowStockAlerts();
      await notifyDueLowStockAlerts();
      await resolveRecoveredAlerts();

      await releaseLock();
    } catch {
      // log opcional
    } finally {
      running = false;
    }
  };

  tick(); // primer disparo inmediato
  const handle = setInterval(tick, TICK_EVERY_MS);
  return () => clearInterval(handle);
}
