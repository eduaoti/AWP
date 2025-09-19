CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nombre   VARCHAR(120) NOT NULL,
  email    VARCHAR(180) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol      VARCHAR(20)  NOT NULL CHECK (rol IN ('admin','editor','lector')),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS otp_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS otp_secret TEXT;


-- Backup codes
CREATE TABLE IF NOT EXISTS otp_backup_codes (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Tokens de recuperación
CREATE TABLE IF NOT EXISTS recovery_tokens (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
