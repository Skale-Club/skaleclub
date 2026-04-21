-- Phase 15 — Admin Presentations: create presentations, presentation_views, brand_guidelines tables
-- Idempotent via IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.

BEGIN;

-- 1. presentations table (PRES-01)
CREATE TABLE IF NOT EXISTS presentations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  slides              JSONB NOT NULL DEFAULT '[]'::jsonb,
  guidelines_snapshot TEXT,
  access_code         TEXT,
  version             INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS presentations_slug_idx        ON presentations (slug);
CREATE INDEX IF NOT EXISTS presentations_created_at_idx  ON presentations (created_at DESC);

ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON presentations;
CREATE POLICY "service_role_all_access"
  ON presentations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. presentation_views table (PRES-02)
-- NOTE: presentation_id is UUID (not INTEGER) because presentations.id is UUID
CREATE TABLE IF NOT EXISTS presentation_views (
  id                SERIAL PRIMARY KEY,
  presentation_id   UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  viewed_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_hash           TEXT
);

CREATE INDEX IF NOT EXISTS presentation_views_presentation_id_idx ON presentation_views (presentation_id);
CREATE INDEX IF NOT EXISTS presentation_views_viewed_at_idx       ON presentation_views (viewed_at DESC);

ALTER TABLE presentation_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON presentation_views;
CREATE POLICY "service_role_all_access"
  ON presentation_views FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. brand_guidelines singleton table (PRES-03)
CREATE TABLE IF NOT EXISTS brand_guidelines (
  id          SERIAL PRIMARY KEY,
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMP DEFAULT NOW()
);

ALTER TABLE brand_guidelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON brand_guidelines;
CREATE POLICY "service_role_all_access"
  ON brand_guidelines FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
