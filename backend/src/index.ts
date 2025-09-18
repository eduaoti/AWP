import "dotenv/config";
import app from "./app";
import { pool } from "./db";

const PORT = process.env.PORT || 3000;

// 🔍 Validar conexión a la BD al iniciar
(async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("✅ Conectado a la BD. Hora actual:", res.rows[0].now);
  } catch (err) {
    console.error("❌ Error al conectar a la BD:", err);
    process.exit(1); // detener la app si no conecta
  }
})();

app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}`));
