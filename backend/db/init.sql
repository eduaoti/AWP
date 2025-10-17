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
  -- ⬇️ ACTUALIZADO: incluye 'jefe_inventario'
  rol      VARCHAR(20)  NOT NULL CHECK (rol IN ('admin','editor','lector','jefe_inventario')),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ⬇️ MIGRACIÓN SEGURA: si la tabla ya existía con el CHECK viejo, lo reemplazamos.
DO $$
DECLARE
  chk_name text;
BEGIN
  SELECT conname INTO chk_name
  FROM pg_constraint
  WHERE conrelid = 'usuarios'::regclass
    AND contype  = 'c'            -- check
    AND pg_get_constraintdef(oid) ILIKE '%rol IN (%';

  IF chk_name IS NOT NULL THEN
    -- Volamos el CHECK previo (cualquiera que sea su nombre) y creamos el nuevo
    EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', chk_name);
    EXECUTE $sql$
      ALTER TABLE usuarios
      ADD CONSTRAINT usuarios_rol_check
      CHECK (rol IN ('admin','editor','lector','jefe_inventario'))
    $sql$;
  END IF;
END$$;

-- Índice útil para búsquedas por rol (ej. jefe de inventario)
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios (rol);

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

-- ==========================
-- Catálogo de Productos
-- ==========================

-- 🔁 MIGRACIÓN SEGURA: si existe columna 'codigo' y no existe 'clave', renómbrala
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos' AND column_name = 'codigo'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'productos' AND column_name = 'clave'
  ) THEN
    ALTER TABLE productos RENAME COLUMN codigo TO clave;
  END IF;
END$$;

-- Definición (instalación nueva o ya migrada)
CREATE TABLE IF NOT EXISTS productos (
  id              BIGSERIAL PRIMARY KEY,                -- ID_Producto
  clave           VARCHAR(60)  NOT NULL UNIQUE,         -- 🔑 Clave (única)
  nombre          VARCHAR(180) NOT NULL,                -- Nombre
  descripcion     TEXT,                                 -- Descripción
  categoria       VARCHAR(120),                         -- Categoría
  unidad          VARCHAR(40)  NOT NULL,                -- Unidad (pieza, kg, caja, etc.)
  precio          NUMERIC(14,2) NOT NULL DEFAULT 0,     -- 💲 Precio (para estadísticas E11)
  stock_minimo    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  stock_actual    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- (Limpieza de índices antiguos si existen)
DROP INDEX IF EXISTS uniq_productos_nombre_ci;

-- Índices de producto (nombre normalizado, categoría y precio)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_productos_nombre_norm
  ON productos ( lower(regexp_replace(nombre, '\s+', ' ', 'g')) );

CREATE INDEX IF NOT EXISTS idx_productos_nombre    ON productos (nombre);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos (categoria);
CREATE INDEX IF NOT EXISTS idx_productos_precio    ON productos (precio);

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
  proveedor_id    BIGINT,                                               -- (solo entradas; ver CHECK abajo)
  cliente_id      BIGINT                                                -- (solo salidas; ver CHECK abajo)
);

CREATE INDEX IF NOT EXISTS idx_movimientos_producto_fecha ON movimientos (producto_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo_fecha     ON movimientos (tipo, fecha DESC);
-- Útiles para reportes/joins
CREATE INDEX IF NOT EXISTS idx_movimientos_cliente        ON movimientos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_proveedor      ON movimientos (proveedor_id);

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

-- 🔄 Limpia índice antiguo si existiera
DROP INDEX IF EXISTS uniq_proveedores_nombre_ci;

-- 🔒 Unicidad por nombre normalizado (case-insensitive + colapso de espacios)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_proveedores_nombre_norm
  ON proveedores ( lower(regexp_replace(nombre, '\s+', ' ', 'g')) );

-- 🔒 Unicidad por teléfono “solo dígitos” (parcial; permite NULL o vacío repetido)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_proveedores_tel_digits
  ON proveedores ( regexp_replace(coalesce(telefono,''), '\D', '', 'g') )
  WHERE telefono IS NOT NULL AND telefono <> '';

-- (Opcional) Unicidad estricta combinada
-- CREATE UNIQUE INDEX IF NOT EXISTS uniq_proveedores_nombre_tel_norm
--   ON proveedores (
--     lower(regexp_replace(nombre,  '\s+', ' ', 'g')),
--     regexp_replace(coalesce(telefono,''), '\D', '', 'g')
--   )
--   WHERE telefono IS NOT NULL AND telefono <> '';

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

-- ==========================
-- E10: Clientes + Relación Movimiento–Cliente (solo salidas)
-- ==========================
CREATE TABLE IF NOT EXISTS clientes (
  id         BIGSERIAL PRIMARY KEY,
  nombre     VARCHAR(160) NOT NULL,
  telefono   VARCHAR(40),
  contacto   VARCHAR(120),
  creado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes (nombre);

-- 🔄 Limpia índice antiguo si existiera
DROP INDEX IF EXISTS uniq_clientes_nombre_ci;

-- 🔒 Unicidad por nombre normalizado (case-insensitive + colapso de espacios)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_clientes_nombre_norm
  ON clientes ( lower(regexp_replace(nombre, '\s+', ' ', 'g')) );

-- 🔒 Unicidad por teléfono “solo dígitos” (parcial; permite NULL o vacío repetido)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_clientes_tel_digits
  ON clientes ( regexp_replace(coalesce(telefono,''), '\D', '', 'g') )
  WHERE telefono IS NOT NULL AND telefono <> '';

-- FK y CHECK para cliente_id en movimientos (solo salidas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='movimientos' AND constraint_type='FOREIGN KEY'
      AND constraint_name='movimientos_cliente_id_fkey'
  ) THEN
    ALTER TABLE movimientos
      ADD CONSTRAINT movimientos_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES clientes(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='movimientos' AND constraint_type='CHECK'
      AND constraint_name='chk_movimientos_cliente_solo_salidas'
  ) THEN
    ALTER TABLE movimientos
      ADD CONSTRAINT chk_movimientos_cliente_solo_salidas
      CHECK (cliente_id IS NULL OR tipo = 'salida');
  END IF;
END$$;

-- =========================================
-- (E11) Índices ya creados para precio/joins; no se requiere más DDL.
-- =========================================


-- =========================================
-- (E12) **NUEVO**: Persistencia de Alertas de Bajo Stock
-- =========================================

-- Estado de alertas de bajo stock (una activa por producto)
CREATE TABLE IF NOT EXISTS low_stock_alerts (
  id                BIGSERIAL PRIMARY KEY,
  producto_id       BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_notified_at  TIMESTAMPTZ,
  next_notify_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- primera notificación inmediata
  times_notified    INT NOT NULL DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  resolved_at       TIMESTAMPTZ,
  last_stock_actual  NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_stock_minimo  NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- Única alerta activa por producto
CREATE UNIQUE INDEX IF NOT EXISTS uniq_low_stock_active
  ON low_stock_alerts (producto_id)
  WHERE active = TRUE;

-- Para “vencidas” (ready-to-send)
CREATE INDEX IF NOT EXISTS idx_low_stock_due
  ON low_stock_alerts (next_notify_at)
  WHERE active = TRUE;

-- Bitácora de eventos de alerta (opcional)
CREATE TABLE IF NOT EXISTS low_stock_events (
  id           BIGSERIAL PRIMARY KEY,
  producto_id  BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  kind         VARCHAR(16) NOT NULL CHECK (kind IN ('detected','reminder','resolved')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot     JSONB
);

CREATE INDEX IF NOT EXISTS idx_low_stock_events_prod_time
  ON low_stock_events (producto_id, created_at DESC);
