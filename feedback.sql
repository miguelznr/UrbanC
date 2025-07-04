-- =========================
--  Mini-app Tintorerías 👔
--  Estructura de tabla + RLS + trigger updated_at
--  (idempotente: lo puedes ejecutar varias veces)
-- =========================

-- 0) Extensión para UUID (por si no estuviera habilitada)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Tabla ---------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback (
  id         UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  email      VARCHAR(255)    NOT NULL,
  loc        VARCHAR(10)     NOT NULL,
  rating     INTEGER         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ     DEFAULT NOW(),
  updated_at TIMESTAMPTZ     DEFAULT NOW(),
  CONSTRAINT unique_email_loc UNIQUE (email, loc)
);

-- 2) Índices -------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_feedback_email       ON feedback(email);
CREATE INDEX IF NOT EXISTS idx_feedback_loc         ON feedback(loc);
CREATE INDEX IF NOT EXISTS idx_feedback_rating      ON feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at  ON feedback(created_at);

-- 3) Row-Level Security -------------------------------------
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Elimina versiones previas de políticas (si las hubiera)
DROP POLICY  IF EXISTS "allow_insert" ON feedback;
DROP POLICY  IF EXISTS "allow_select" ON feedback;

-- Políticas “todo-público” (sirven con la anon key)
CREATE POLICY "allow_insert"
  ON feedback FOR INSERT
  WITH CHECK (true);

CREATE POLICY "allow_select"
  ON feedback FOR SELECT
  USING (true);

-- 4) Trigger updated_at -------------------------------------

-- Función que actualiza updated_at antes de cada UPDATE
CREATE OR REPLACE FUNCTION update_feedback_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Elimina trigger previo (si existía) y vuelve a crearlo
DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;

CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at_column();
