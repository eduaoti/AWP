-- =========================================
-- Inicialización de la base de datos para el sistema de inventario
-- Archivo: awp/db/init.sql
-- =========================================

-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- 1) Usuarios y autenticación
-- =========================================
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nombre   VARCHAR(120) NOT NULL,
  email    VARCHAR(180) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol      VARCHAR(20)  NOT NULL CHECK (rol IN ('admin','editor','lector','jefe_inventario')),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

DO $$
DECLARE chk_name text;
BEGIN
  SELECT conname INTO chk_name
  FROM pg_constraint
  WHERE conrelid = 'usuarios'::regclass
    AND contype = 'c'
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
  ADD COLUMN IF NOT EXISTS otp_secret TEXT;

-- =========================================
-- 2) OTP y recuperación
-- =========================================
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
-- 3) Sesiones, auditorías y email queue
-- =========================================
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

CREATE TABLE IF NOT EXISTS login_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT,
  metodo TEXT,
  exito BOOLEAN,
  detalle TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_audit_user_fecha
  ON login_audit (user_id, fecha DESC);

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

-- =========================================
-- 4) Sesiones de usuario
-- =========================================
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
  last_seen TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions (jti);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active
  ON user_sessions (user_id)
  WHERE status='active' AND revoked=false;

-- =========================================
-- 5) Catálogo de productos
-- =========================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='productos' AND column_name='codigo'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='productos' AND column_name='clave'
  ) THEN
    ALTER TABLE productos RENAME COLUMN codigo TO clave;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS productos (
  id BIGSERIAL PRIMARY KEY,
  clave VARCHAR(60) NOT NULL UNIQUE,
  nombre VARCHAR(180) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(120),
  unidad VARCHAR(40) NOT NULL,
  precio NUMERIC(14,2) NOT NULL DEFAULT 0,
  stock_minimo INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  stock_actual INTEGER NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos (nombre);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos (categoria);
CREATE INDEX IF NOT EXISTS idx_productos_precio ON productos (precio);

CREATE OR REPLACE FUNCTION productos_set_updated_at()
RETURNS TRIGGER AS $f$
BEGIN
  NEW.actualizado_en := NOW();
  RETURN NEW;
END;
$f$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_productos_updated_at') THEN
    CREATE TRIGGER trg_productos_updated_at
    BEFORE UPDATE ON productos
    FOR EACH ROW
    EXECUTE PROCEDURE productos_set_updated_at();
  END IF;
END$$;

-- =========================================
-- 6) Movimientos de inventario
-- =========================================
CREATE TABLE IF NOT EXISTS movimientos (
  id BIGSERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada','salida')),
  producto_id BIGINT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad NUMERIC(14,2) NOT NULL CHECK (cantidad > 0),
  documento VARCHAR(120),
  responsable VARCHAR(120)
);

ALTER TABLE movimientos
  ADD COLUMN IF NOT EXISTS proveedor_id BIGINT,
  ADD COLUMN IF NOT EXISTS almacen_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_movimientos_producto_fecha ON movimientos (producto_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo_fecha     ON movimientos (tipo, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_proveedor      ON movimientos (proveedor_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen        ON movimientos (almacen_id);

-- =========================================
-- 7) Proveedores
-- =========================================
CREATE TABLE IF NOT EXISTS proveedores (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  telefono VARCHAR(40),
  contacto VARCHAR(120),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores (nombre);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='movimientos' AND constraint_name='movimientos_proveedor_id_fkey'
  ) THEN
    ALTER TABLE movimientos
      ADD CONSTRAINT movimientos_proveedor_id_fkey
      FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='movimientos' AND constraint_name='chk_movimientos_proveedor_solo_entradas'
  ) THEN
    ALTER TABLE movimientos
      ADD CONSTRAINT chk_movimientos_proveedor_solo_entradas
      CHECK (proveedor_id IS NULL OR tipo='entrada');
  END IF;
END$$;

-- =========================================
-- 8) Almacenes + relación con movimientos
-- =========================================
CREATE TABLE IF NOT EXISTS almacenes (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  telefono VARCHAR(40),
  contacto VARCHAR(120),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_almacenes_nombre ON almacenes (nombre);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='movimientos' AND constraint_name='movimientos_almacen_id_fkey'
  ) THEN
    ALTER TABLE movimientos
      ADD CONSTRAINT movimientos_almacen_id_fkey
      FOREIGN KEY (almacen_id) REFERENCES almacenes(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='movimientos' AND constraint_name='chk_movimientos_almacen_solo_salidas'
  ) THEN
    ALTER TABLE movimientos
      ADD CONSTRAINT chk_movimientos_almacen_solo_salidas
      CHECK (almacen_id IS NULL OR tipo='salida');
  END IF;
END$$;

-- =========================================
-- 9) Alertas de bajo stock
-- =========================================
CREATE TABLE IF NOT EXISTS low_stock_alerts (
  id BIGSERIAL PRIMARY KEY,
  producto_id BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ,
  next_notify_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  times_notified INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  resolved_at TIMESTAMPTZ,
  last_stock_actual INTEGER NOT NULL DEFAULT 0,
  last_stock_minimo INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_low_stock_active
  ON low_stock_alerts (producto_id)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_low_stock_due
  ON low_stock_alerts (next_notify_at)
  WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS low_stock_events (
  id BIGSERIAL PRIMARY KEY,
  producto_id BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('detected','reminder','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot JSONB
);

CREATE INDEX IF NOT EXISTS idx_low_stock_events_prod_time
  ON low_stock_events (producto_id, created_at DESC);

CREATE OR REPLACE FUNCTION productos_low_stock_sync()
RETURNS TRIGGER AS $f$
DECLARE
  v_active BOOLEAN;
  v_payload JSON;
BEGIN
  v_active := (NEW.stock_actual < NEW.stock_minimo);

  IF v_active THEN
    INSERT INTO low_stock_alerts (producto_id, first_detected_at, next_notify_at,
                                  times_notified, active, last_stock_actual, last_stock_minimo)
    VALUES (NEW.id, NOW(), NOW(), 0, TRUE, NEW.stock_actual, NEW.stock_minimo)
    ON CONFLICT (producto_id)
      WHERE low_stock_alerts.active = TRUE
      DO UPDATE SET
        last_stock_actual = EXCLUDED.last_stock_actual,
        last_stock_minimo = EXCLUDED.last_stock_minimo,
        next_notify_at = LEAST(low_stock_alerts.next_notify_at, NOW());

    INSERT INTO low_stock_events (producto_id, kind, snapshot)
    VALUES (NEW.id, 'detected', jsonb_build_object(
      'stock_actual', NEW.stock_actual,
      'stock_minimo', NEW.stock_minimo,
      'nombre', NEW.nombre,
      'clave', NEW.clave
    ));
  ELSE
    UPDATE low_stock_alerts
       SET active = FALSE, resolved_at = NOW(),
           last_stock_actual = NEW.stock_actual,
           last_stock_minimo = NEW.stock_minimo
     WHERE producto_id = NEW.id AND active = TRUE;

    IF FOUND THEN
      INSERT INTO low_stock_events (producto_id, kind, snapshot)
      VALUES (NEW.id, 'resolved', jsonb_build_object(
        'stock_actual', NEW.stock_actual,
        'stock_minimo', NEW.stock_minimo,
        'nombre', NEW.nombre,
        'clave', NEW.clave
      ));
    END IF;
  END IF;

  RETURN NEW;
END;
$f$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_productos_low_stock_sync') THEN
    CREATE TRIGGER trg_productos_low_stock_sync
    AFTER INSERT OR UPDATE OF stock_actual, stock_minimo, nombre, clave
    ON productos
    FOR EACH ROW
    EXECUTE PROCEDURE productos_low_stock_sync();
  END IF;
END$$;

-- =========================================
-- 5B) Categorías
-- =========================================
CREATE TABLE IF NOT EXISTS categorias (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categorias_nombre ON categorias (LOWER(nombre));

CREATE OR REPLACE FUNCTION categorias_set_updated_at()
RETURNS TRIGGER AS $f$
BEGIN
  NEW.actualizado_en := NOW();
  RETURN NEW;
END;
$f$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_categorias_updated_at') THEN
    CREATE TRIGGER trg_categorias_updated_at
    BEFORE UPDATE ON categorias
    FOR EACH ROW
    EXECUTE PROCEDURE categorias_set_updated_at();
  END IF;
END$$;

-- 🔗 Relación de productos → categorías (1:N)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS categoria_id BIGINT REFERENCES categorias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_productos_categoria_id ON productos (categoria_id);

-- =========================================
-- 10) BITÁCORA DE ACCESOS (BITACORA_ACCESOS)
--     E12 - Administración de Bitácoras Automáticas
-- =========================================
CREATE TABLE IF NOT EXISTS bitacora_accesos (
  id           BIGSERIAL PRIMARY KEY,
  usuario_id   BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  email        VARCHAR(180),
  evento       VARCHAR(40) NOT NULL CHECK (
                 evento IN (
                   'login_exitoso',
                   'login_fallido',
                   'logout',
                   'sesion_expirada',
                   'otp_habilitado',
                   'otp_deshabilitado'
                 )
               ),
  fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip           TEXT,
  user_agent   TEXT,
  detalle      TEXT,
  metadata     JSONB
);

CREATE INDEX IF NOT EXISTS idx_bitacora_accesos_usuario_fecha
  ON bitacora_accesos (usuario_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_bitacora_accesos_evento_fecha
  ON bitacora_accesos (evento, fecha DESC);

-- =========================================
-- 11) BITÁCORA DE MOVIMIENTOS (BITACORA_MOVIMIENTOS)
--     Registro automático de entradas y salidas
-- =========================================

-- Vincular movimientos con usuario responsable (opcional pero recomendado)
ALTER TABLE movimientos
  ADD COLUMN IF NOT EXISTS usuario_id BIGINT REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS bitacora_movimientos (
  id             BIGSERIAL PRIMARY KEY,
  movimiento_id  BIGINT NOT NULL REFERENCES movimientos(id) ON DELETE CASCADE,
  fecha_log      TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- Cuándo se registró en bitácora
  fecha_mov      TIMESTAMPTZ NOT NULL,                 -- Fecha original del movimiento
  usuario_id     BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo           VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada','salida')),
  producto_id    BIGINT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad       NUMERIC(14,2) NOT NULL,
  documento      VARCHAR(120),
  responsable    VARCHAR(120),
  proveedor_id   BIGINT REFERENCES proveedores(id) ON DELETE SET NULL,
  almacen_id     BIGINT REFERENCES almacenes(id) ON DELETE SET NULL,
  snapshot       JSONB                                 -- Copia del registro original
);

CREATE INDEX IF NOT EXISTS idx_bitacora_mov_prod_fecha
  ON bitacora_movimientos (producto_id, fecha_mov DESC);

CREATE INDEX IF NOT EXISTS idx_bitacora_mov_usuario_fecha
  ON bitacora_movimientos (usuario_id, fecha_mov DESC);

CREATE INDEX IF NOT EXISTS idx_bitacora_mov_tipo_fecha
  ON bitacora_movimientos (tipo, fecha_mov DESC);

-- Función trigger para registrar automáticamente los movimientos en la bitácora
CREATE OR REPLACE FUNCTION bitacora_movimientos_log()
RETURNS TRIGGER AS $f$
BEGIN
  INSERT INTO bitacora_movimientos (
    movimiento_id,
    fecha_log,
    fecha_mov,
    usuario_id,
    tipo,
    producto_id,
    cantidad,
    documento,
    responsable,
    proveedor_id,
    almacen_id,
    snapshot
  )
  VALUES (
    NEW.id,
    NOW(),
    NEW.fecha,
    NEW.usuario_id,
    NEW.tipo,
    NEW.producto_id,
    NEW.cantidad,
    NEW.documento,
    NEW.responsable,
    NEW.proveedor_id,
    NEW.almacen_id,
    to_jsonb(NEW)
  );

  RETURN NEW;
END;
$f$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_movimientos_bitacora') THEN
    CREATE TRIGGER trg_movimientos_bitacora
    AFTER INSERT ON movimientos
    FOR EACH ROW
    EXECUTE PROCEDURE bitacora_movimientos_log();
  END IF;
END$$;

-- =========================================
-- 12) BITÁCORA DEL SISTEMA (BITACORA_SISTEMA)
--      Registro automático de CRUD de módulos
-- =========================================
CREATE TABLE IF NOT EXISTS bitacora_sistema (
  id              BIGSERIAL PRIMARY KEY,
  fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id      BIGINT REFERENCES usuarios(id) ON DELETE SET NULL,
  tabla           TEXT NOT NULL,
  registro_id     BIGINT,
  operacion       VARCHAR(10) NOT NULL CHECK (operacion IN ('CREATE','UPDATE','DELETE')),
  ip              TEXT,
  user_agent      TEXT,
  valores_antes   JSONB,
  valores_despues JSONB
);

CREATE INDEX IF NOT EXISTS idx_bitacora_sistema_tabla_registro
  ON bitacora_sistema (tabla, registro_id);

CREATE INDEX IF NOT EXISTS idx_bitacora_sistema_usuario_fecha
  ON bitacora_sistema (usuario_id, fecha DESC);

-- Función genérica para registrar operaciones CRUD en cualquier tabla
CREATE OR REPLACE FUNCTION bitacora_sistema_log()
RETURNS TRIGGER AS $f$
DECLARE
  v_usuario_id BIGINT;
  v_ip         TEXT;
  v_ua         TEXT;
  v_oper       VARCHAR(10);
BEGIN
  -- Intenta obtener el usuario e info de contexto desde GUC opcionales:
  --   SET LOCAL app.current_user_id = '123';
  --   SET LOCAL app.current_ip = '1.2.3.4';
  --   SET LOCAL app.current_user_agent = '...';
  BEGIN
    v_usuario_id := NULLIF(current_setting('app.current_user_id', true), '')::BIGINT;
  EXCEPTION WHEN others THEN
    v_usuario_id := NULL;
  END;

  BEGIN
    v_ip := current_setting('app.current_ip', true);
  EXCEPTION WHEN others THEN
    v_ip := NULL;
  END;

  BEGIN
    v_ua := current_setting('app.current_user_agent', true);
  EXCEPTION WHEN others THEN
    v_ua := NULL;
  END;

  IF (TG_OP = 'INSERT') THEN
    v_oper := 'CREATE';
    INSERT INTO bitacora_sistema (
      fecha,
      usuario_id,
      tabla,
      registro_id,
      operacion,
      ip,
      user_agent,
      valores_antes,
      valores_despues
    )
    VALUES (
      NOW(),
      v_usuario_id,
      TG_TABLE_NAME,
      NEW.id,
      v_oper,
      v_ip,
      v_ua,
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    v_oper := 'UPDATE';
    INSERT INTO bitacora_sistema (
      fecha,
      usuario_id,
      tabla,
      registro_id,
      operacion,
      ip,
      user_agent,
      valores_antes,
      valores_despues
    )
    VALUES (
      NOW(),
      v_usuario_id,
      TG_TABLE_NAME,
      NEW.id,
      v_oper,
      v_ip,
      v_ua,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    v_oper := 'DELETE';
    INSERT INTO bitacora_sistema (
      fecha,
      usuario_id,
      tabla,
      registro_id,
      operacion,
      ip,
      user_agent,
      valores_antes,
      valores_despues
    )
    VALUES (
      NOW(),
      v_usuario_id,
      TG_TABLE_NAME,
      OLD.id,
      v_oper,
      v_ip,
      v_ua,
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$f$ LANGUAGE plpgsql;

-- Habilitar bitácora de sistema para algunos módulos clave
DO $$
BEGIN
  -- Productos
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_productos_bitacora_sistema') THEN
    CREATE TRIGGER trg_productos_bitacora_sistema
    AFTER INSERT OR UPDATE OR DELETE ON productos
    FOR EACH ROW
    EXECUTE PROCEDURE bitacora_sistema_log();
  END IF;

  -- Almacenes
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_almacenes_bitacora_sistema') THEN
    CREATE TRIGGER trg_almacenes_bitacora_sistema
    AFTER INSERT OR UPDATE OR DELETE ON almacenes
    FOR EACH ROW
    EXECUTE PROCEDURE bitacora_sistema_log();
  END IF;

  -- Proveedores
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_proveedores_bitacora_sistema') THEN
    CREATE TRIGGER trg_proveedores_bitacora_sistema
    AFTER INSERT OR UPDATE OR DELETE ON proveedores
    FOR EACH ROW
    EXECUTE PROCEDURE bitacora_sistema_log();
  END IF;
END$$;

-- =========================================
-- FIN DEL SCRIPT
-- =========================================
