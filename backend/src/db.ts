import { Pool } from "pg";
import fs from "node:fs/promises";
import path from "node:path";

// --- Config (sin credenciales hardcodeadas) ---
const APP_DB_NAME = process.env.APP_DB_NAME?.trim() || "seguridad";
const ADMIN_DATABASE_URL = process.env.ADMIN_DATABASE_URL;
const DATABASE_URL = process.env.DATABASE_URL;
const DB_SSL =
  process.env.DB_SSL === "true"
    ? ({ rejectUnauthorized: false } as const)
    : false;

// Validación estricta del nombre de BD
function assertSafeDbName(name: string) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error("APP_DB_NAME contiene caracteres inválidos. Usa solo [A-Za-z0-9_].");
  }
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DB_SSL,
  max: 8,
});

function assertEnv() {
  if (!ADMIN_DATABASE_URL)
    throw new Error("Falta ADMIN_DATABASE_URL (usa variables de entorno).");
  if (!DATABASE_URL)
    throw new Error("Falta DATABASE_URL (cadena de conexión a la BD de la app).");
}

/**
 * Inicializa la base de datos:
 * - Crea la BD si no existe.
 * - Aplica el script `db/init.sql`.
 */
export async function initDb() {
  assertEnv();
  assertSafeDbName(APP_DB_NAME);

  const admin = new Pool({ connectionString: ADMIN_DATABASE_URL, ssl: DB_SSL });

  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [APP_DB_NAME]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${APP_DB_NAME}"`);
      console.log(`✅ Base de datos "${APP_DB_NAME}" creada.`);
    } else {
      console.log(`ℹ️ Base de datos "${APP_DB_NAME}" ya existe.`);
    }
  } catch (err) {
    console.error("⚠️ Error verificando/creando la BD:", err);
  } finally {
    await admin.end();
  }

  try {
    const initPath = path.join(process.cwd(), "db", "init.sql");
    const sql = await fs.readFile(initPath, "utf8");
    if (sql.trim()) {
      await pool.query(sql);
      console.log("✅ Esquema inicial listo (init.sql).");
    } else {
      console.log("ℹ️ init.sql vacío: no se aplicaron cambios.");
    }
  } catch (err) {
    console.error("⚠️ Error aplicando init.sql:", err);
  }
}

process.on("SIGINT", async () => {
  try {
    await pool.end();
    console.log("🔌 Pool cerrado correctamente.");
  } finally {
    process.exit(0);
  }
});
