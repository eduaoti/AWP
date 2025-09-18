import "dotenv/config";
import app from "./app";
import { pool, initDb } from "./db";

const PORT = process.env.PORT || 3000;

(async () => {
  // Crea la BD (si falta) y aplica init.sql
  await initDb();

  // Prueba de conexión
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("✅ Conectado a la BD. Hora actual:", res.rows[0].now);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ Error al conectar a la BD:", msg);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`API ready on http://localhost:${PORT}`);
  });
})();
