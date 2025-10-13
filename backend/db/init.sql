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
  ADD COLUMN IF NOT EXISTS otp_secret  TEXT;

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

-- 7) Sesiones (una fila por JWT emitido)
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

-- 👉 NUEVO: estado de sesión
ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','closed','expired'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_jti  ON user_sessions (jti);
CREATE INDEX        IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id);

-- 👉 NUEVO: índice para encontrar rápidamente la sesión activa
CREATE INDEX IF NOT EXISTS idx_user_sessions_active
  ON user_sessions (user_id)
  WHERE status='active' AND revoked=false;

-- 👉 NUEVO: ÚNICA sesión activa por usuario (la app marca expiradas/cerradas)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_active_session
  ON user_sessions (user_id)
  WHERE status='active' AND revoked=false;

-- 8) 👉 NUEVO: Ventana de OTP vigente (evita regenerar mientras no expire)
CREATE TABLE IF NOT EXISTS otp_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,   -- ej. NOW() + interval '45 seconds'
  delivered BOOLEAN DEFAULT FALSE
);

-- 🔧 FIX: quitar NOW() del predicado (inmutable)
CREATE INDEX IF NOT EXISTS idx_otp_requests_user_valid
  ON otp_requests (user_id, expires_at)
  WHERE delivered = true;

-- (Opcional, ayuda en purgas por fecha)
CREATE INDEX IF NOT EXISTS idx_otp_requests_expires_at
  ON otp_requests (expires_at);

-- =========================================
-- (Opcional) Limpiezas programadas (jobs/cron):
--  - Eliminar PINs expirados de hace > 24h
--  - Eliminar recovery tokens expirados de hace > 7 días
--  - Limpiar otp_requests expirados de hace > 1 día
-- =========================================
-- DELETE FROM offline_login_tokens WHERE expira_en < NOW() - INTERVAL '1 day';
-- DELETE FROM recovery_tokens      WHERE expira_en < NOW() - INTERVAL '7 days';
-- DELETE FROM otp_requests         WHERE expires_at < NOW() - INTERVAL '1 day';

-- Fin del esquema
-- ==========================
-- ==========================
-- Catálogo de Productos
-- ==========================
CREATE TABLE IF NOT EXISTS productos (
  id              BIGSERIAL PRIMARY KEY,                -- ID_Producto
  codigo          VARCHAR(60)  NOT NULL UNIQUE,         -- Código (único)
  nombre          VARCHAR(180) NOT NULL,                -- Nombre
  descripcion     TEXT,                                 -- Descripción
  categoria       VARCHAR(120),                         -- Categoría
  unidad          VARCHAR(40)  NOT NULL,                -- Unidad (pieza, kg, caja, etc.)
  stock_minimo    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  stock_actual    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 🔴 NUEVO: unicidad por nombre (case-insensitive) para operar por nombre desde la API JSON-only
CREATE UNIQUE INDEX IF NOT EXISTS uniq_productos_nombre_ci
  ON productos (LOWER(nombre));

CREATE INDEX IF NOT EXISTS idx_productos_nombre    ON productos (nombre);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos (categoria);

-- Función de trigger: mantener actualizado 'actualizado_en'
CREATE OR REPLACE FUNCTION productos_set_updated_at()
RETURNS TRIGGER AS $f$
BEGIN
  NEW.actualizado_en := NOW();
  RETURN NEW;
END;
$f$ LANGUAGE plpgsql;

-- Trigger: lo creamos solo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_productos_updated_at'
  ) THEN
    CREATE TRIGGER trg_productos_updated_at
    BEFORE UPDATE ON productos
    FOR EACH ROW
    EXECUTE PROCEDURE productos_set_updated_at();
  END IF;
END$$;

-- ==========================
-- Movimientos de inventario
-- ==========================
CREATE TABLE IF NOT EXISTS movimientos (
  id              BIGSERIAL PRIMARY KEY,                                -- ID_Movimiento
  fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW(),                   -- Fecha
  tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada','salida')), -- Tipo
  producto_id     BIGINT     NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad        NUMERIC(14,2) NOT NULL CHECK (cantidad > 0),          -- Cantidad positiva
  documento       VARCHAR(120),                                         -- Referencia/Documento
  responsable     VARCHAR(120),                                         -- Responsable
  proveedor_id    BIGINT                                                -- (solo entradas; ver CHECK abajo)
);

CREATE INDEX IF NOT EXISTS idx_movimientos_producto_fecha ON movimientos (producto_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo_fecha     ON movimientos (tipo, fecha DESC);

-- ==========================
-- Proveedores
-- ==========================
CREATE TABLE IF NOT EXISTS proveedores (
  id         BIGSERIAL PRIMARY KEY,         -- ID_Proveedor
  nombre     VARCHAR(160) NOT NULL,
  telefono   VARCHAR(40),
  contacto   VARCHAR(120),
  creado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores (nombre);

-- ==========================
-- Relación Movimiento–Proveedor (solo aplica a entradas)
-- ==========================

-- FK: si borras un proveedor, los movimientos históricos quedan con proveedor_id NULL.
DO $$
BEGIN
  -- Normalizamos: si existía una FK con otro nombre/política, la recreamos
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'movimientos'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'movimientos_proveedor_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE movimientos DROP CONSTRAINT movimientos_proveedor_id_fkey;
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
  END IF;

  BEGIN
    ALTER TABLE movimientos
      ADD CONSTRAINT movimientos_proveedor_id_fkey
      FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
      ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END$$;

-- CHECK: asegurar que proveedor_id solo esté informado cuando tipo='entrada'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'movimientos'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'chk_movimientos_proveedor_solo_entradas'
  ) THEN
    ALTER TABLE movimientos
      ADD CONSTRAINT chk_movimientos_proveedor_solo_entradas
      CHECK (proveedor_id IS NULL OR tipo = 'entrada');
  END IF;
END$$;
