// src/db.ts
import { Pool } from "pg";
import fs from "fs";
import path from "path";

// BD de la app
const APP_DB_NAME = process.env.APP_DB_NAME || "seguridad";
// URL admin (para crear la BD si no existe). Ajusta user/pass si no usas el default.
const ADMIN_DATABASE_URL =
  process.env.ADMIN_DATABASE_URL ||
  "postgresql://postgres:passwd123@localhost:5432/postgres";

// Pool que usará la app (apunta a seguridad)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // ej: postgresql://postgres:passwd123@localhost:5432/seguridad
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 8,
});

/**
 * Verifica/crea la BD y aplica db/init.sql
 */
export async function initDb() {
  // 1) Asegurar que la BD exista
  const admin = new Pool({
  connectionString: ADMIN_DATABASE_URL,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});


  try {
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [APP_DB_NAME]
    );
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${APP_DB_NAME}`);
      console.log(`✅ Base de datos ${APP_DB_NAME} creada`);
    } else {
      console.log(`ℹ️ Base de datos ${APP_DB_NAME} ya existe`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("⚠️ Error verificando/creando la BD:", msg);
  } finally {
    await admin.end();
  }

  // 2) Aplicar init.sql (creación de tablas)
  try {
    const initPath = path.join(__dirname, "../db/init.sql");
    const sql = fs.readFileSync(initPath, "utf-8");
    if (sql.trim()) {
      await pool.query(sql);
      console.log("✅ Esquema inicial listo (init.sql)");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("⚠️ Error aplicando init.sql:", msg);
  }
}
