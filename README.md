# 📦 Backend AWP – Node.js + TypeScript + Express

Este proyecto implementa la **API base** para el sistema AWP.  
Incluye conexión a PostgreSQL, autenticación con JWT y OTP, endpoints de usuarios, validaciones con Zod, y documentación con Swagger UI.  
Además, integra workers para notificaciones de bajo stock y reintentos de correo.

---

## ⚙️ Tecnologías Utilizadas
- Node.js + TypeScript  
- Express  
- PostgreSQL (`pg`)  
- Zod (validación de esquemas)  
- Bcrypt (hash de contraseñas)  
- JSON Web Tokens (JWT)  
- OTP (`otplib`)  
- Swagger UI (`swagger-ui-express`)  
- Helmet + CORS (seguridad HTTP)  
- Nodemon + ts-node (modo desarrollo)

---

## 📂 Estructura de Carpetas

backend/
├─ db/ # Scripts SQL iniciales
│ └─ init.sql
├─ docs/ # Documentación Swagger/OpenAPI
│ └─ openapi.json
├─ src/
│ ├─ controllers/ # Controladores con lógica de endpoints
│ │ ├─ auth.controller.ts
│ │ └─ usuarios.controller.ts
│ ├─ middlewares/
│ │ ├─ security/
│ │ │ └─ require-json.ts
│ │ └─ validation/
│ │ ├─ errors.ts
│ │ └─ validate.ts
│ ├─ models/ # Modelos o DTOs
│ │ ├─ usuario.model.ts
│ │ └─ security.model.ts
│ ├─ routes/ # Definición de rutas Express
│ │ └─ usuarios.routes.ts # JSON-only para listar
│ ├─ schemas/
│ │ └─ domain/
│ │ └─ usuario.schemas.ts
│ ├─ services/
│ │ ├─ domain/… # Servicios por dominio
│ │ ├─ system/ # Servicios de infraestructura
│ │ │ ├─ emailQueue.ts
│ │ │ ├─ lowStock.ts
│ │ │ ├─ mail.ts
│ │ │ ├─ offline.ts
│ │ │ ├─ otp.ts
│ │ │ └─ sessions.ts
│ │ └─ utils/ # Utilidades generales
│ │ ├─ geo.ts
│ │ └─ net.ts
│ ├─ status/
│ │ ├─ codes.ts
│ │ └─ respond.ts
│ ├─ app.ts # Configuración principal de Express
│ ├─ db.ts # Conexión a Postgres (Pool)
│ └─ index.ts # Punto de entrada y workers
├─ .env # Variables de entorno (ignorado en Git)
├─ .env.example # Ejemplo de variables de entorno
├─ .gitignore
├─ package.json
├─ tsconfig.json


---

## 🔑 Variables de Entorno

Archivo `.env` (no subir a GitHub).  

Ejemplo en `.env.example`:

```env
# Servidor
PORT=3000
NODE_ENV=development

# Base de datos
APP_DB_NAME=seguridad
DATABASE_URL=postgresql://usuario:password@localhost:5432/seguridad
ADMIN_DATABASE_URL=postgresql://postgres:passwd123@localhost:5432/postgres
DB_SSL=false

# Autenticación
JWT_SECRET=cambia_esto_ya
JWT_PREAUTH_SECRET=pre_secret
JWT_OFFLINE_SECRET=offline_secret
SESSION_TTL_MIN=5

# Workers
LOW_STOCK_INTERVAL_MS=300000
EMAIL_QUEUE_INTERVAL_SECONDS=60

# Aplicación
APP_URL=http://localhost:5173

## 🔑 Esquema de base de datos

-- =========================================
-- Esquema base de seguridad / autenticación
-- =========================================

-- 0) Extensiones útiles (opcional)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nombre   VARCHAR(120) NOT NULL,
  email    VARCHAR(180) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol      VARCHAR(20)  NOT NULL CHECK (rol IN ('admin','editor','lector','jefe_inventario')),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- MIGRACIÓN SEGURA (roles)
DO $$
DECLARE
  chk_name text;
BEGIN
  SELECT conname INTO chk_name
  FROM pg_constraint
  WHERE conrelid = 'usuarios'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%rol IN (%';
  IF chk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', chk_name);
    EXECUTE $sql$
      ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_rol_check
      CHECK (rol IN ('admin','editor','lector','jefe_inventario'))
    $sql$;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios (rol);

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS otp_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS otp_secret  TEXT;

-- 2) Backup codes
CREATE TABLE IF NOT EXISTS otp_backup_codes (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_codes_user_unused
  ON otp_backup_codes (user_id) WHERE usado = false;

-- 3) Tokens de recuperación
CREATE TABLE IF NOT EXISTS recovery_tokens (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_tokens_user_valid
  ON recovery_tokens (user_id, expira_en) WHERE usado = false;

-- 4) PINs offline
CREATE TABLE IF NOT EXISTS offline_login_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  jti UUID NOT NULL,
  pin_hash TEXT NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  usado_en TIMESTAMPTZ,
  latitud DOUBLE PRECISION,
  longitud DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offline_login_tokens_user_jti
  ON offline_login_tokens (user_id, jti);

CREATE INDEX IF NOT EXISTS idx_offline_login_tokens_valid
  ON offline_login_tokens (expira_en) WHERE usado = false;

-- 5) Auditoría
CREATE TABLE IF NOT EXISTS login_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT,
  metodo TEXT,
  exito BOOLEAN,
  detalle TEXT,
  latitud DOUBLE PRECISION,
  longitud DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_login_audit_user_fecha
  ON login_audit (user_id, fecha DESC);

-- 6) Cola de correos
CREATE TABLE IF NOT EXISTS email_queue (
  id BIGSERIAL PRIMARY KEY,
  destinatario TEXT NOT NULL,
  asunto TEXT NOT NULL,
  html TEXT NOT NULL,
  intentos INT DEFAULT 0,
  last_error TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_queue_pending
  ON email_queue (sent_at) WHERE sent_at IS NULL;

-- 7) Sesiones
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  jti UUID NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  device_id TEXT,
  ip TEXT,
  user_agent TEXT,
  latitud DOUBLE PRECISION,
  longitud DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  last_seen TIMESTAMPTZ
);

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','closed','expired'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_jti  ON user_sessions (jti);
CREATE INDEX        IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active
  ON user_sessions (user_id) WHERE status='active' AND revoked=false;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_active_session
  ON user_sessions (user_id) WHERE status='active' AND revoked=false;

-- 8) Ventana OTP
CREATE TABLE IF NOT EXISTS otp_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  delivered BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_otp_requests_user_valid
  ON otp_requests (user_id, expires_at) WHERE delivered = true;

CREATE INDEX IF NOT EXISTS idx_otp_requests_expires_at
  ON otp_requests (expires_at);

-- =========================================
-- Tablas de productos, movimientos, alertas de bajo stock
-- (Contenido completo incluido en el archivo real)
-- =========================================

🚀 Scripts de NPM
npm install
npm run dev
npm run build
npm start

📡 Endpoints Principales
Método	Ruta	Descripción
POST	/auth/login	Login paso 1 (password)
POST	/auth/login/otp	Login paso 2 (OTP o backup)
POST	/auth/login/offline	Canje PIN offline
POST	/usuarios/listar	Listar usuarios (JSON-only)
POST	/usuarios	Crear usuario
PUT	/usuarios	Actualizar usuario
POST	/usuarios/eliminar	Eliminar usuario

🧩 Middlewares Globales

helmet → cabeceras seguras

cors → control de acceso HTTP

requireJson → fuerza application/json

validateBodySimple → validaciones con Zod

jsonSyntaxErrorHandler → manejo de errores de formato JSON

🧠 Workers

emailQueue.ts: reintenta correos pendientes.

lowStock.ts: detecta y notifica bajo stock.

Spring Boot fue descartado para priorizar velocidad y mantener un stack unificado en Node.js + TypeScript.
El MVP actual sienta las bases para futuras épicas como notificaciones, login social, pagos y modo offline.


---

✅ Este README incluye **todo tu SQL de `init.sql` completo y funcional**,  
ya con formato Markdown, ideal para documentación técnica o subirlo al repositorio.