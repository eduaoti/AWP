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
  rol      VARCHAR(20)  NOT NULL CHECK (rol IN ('admin','editor','lector')),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Campos OTP en usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS otp_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS otp_secret TEXT;

-- 2) Backup codes (consumo único)
CREATE TABLE IF NOT EXISTS otp_backup_codes (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_codes_user_unused
  ON otp_backup_codes (user_id)
  WHERE usado = false;

-- 3) Tokens de recuperación de contraseña
CREATE TABLE IF NOT EXISTS recovery_tokens (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_tokens_user_valid
  ON recovery_tokens (user_id, expira_en)
  WHERE usado = false;

-- =========================================
-- NUEVO: Soporte modo offline y auditoría
-- =========================================

-- 4) PINs de emergencia (offline) de un solo uso
CREATE TABLE IF NOT EXISTS offline_login_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  jti UUID NOT NULL,                         -- ID único del JWT offline
  pin_hash TEXT NOT NULL,                    -- hash del PIN numérico
  expira_en TIMESTAMPTZ NOT NULL,            -- ~1 minuto
  usado BOOLEAN DEFAULT FALSE,
  usado_en TIMESTAMPTZ,
  latitud DOUBLE PRECISION,                  -- ubicación al GENERAR
  longitud DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offline_login_tokens_user_jti
  ON offline_login_tokens (user_id, jti);

CREATE INDEX IF NOT EXISTS idx_offline_login_tokens_valid
  ON offline_login_tokens (expira_en)
  WHERE usado = false;

-- 5) Auditoría de inicios de sesión
CREATE TABLE IF NOT EXISTS login_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT,
  metodo TEXT,                               -- "password+totp", "password+offlinePin", etc.
  exito BOOLEAN,
  detalle TEXT,
  latitud DOUBLE PRECISION,                  -- ubicación reportada en verificación
  longitud DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_login_audit_user_fecha
  ON login_audit (user_id, fecha DESC);

-- 6) Cola de correos (para notificar inicio de sesión cuando regrese internet)
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
  ON email_queue (sent_at)
  WHERE sent_at IS NULL;

-- 7) Sesiones activas (una fila por JWT emitido)
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  jti UUID NOT NULL,                       -- ID único del JWT (claim jti)
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,        -- ≈ exp del JWT
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions (jti);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id);
-- =========================================
-- (Opcional) Limpiezas programadas:
--  - Eliminar PINs expirados de hace > 24h
--  - Eliminar recovery tokens expirados de hace > 7 días
-- =========================================
-- -- Ejemplo de tareas programadas (ejecutar vía cron o job scheduler):
-- DELETE FROM offline_login_tokens WHERE expira_en < NOW() - INTERVAL '1 day';
-- DELETE FROM recovery_tokens WHERE expira_en < NOW() - INTERVAL '7 days';

-- Fin del esquema
