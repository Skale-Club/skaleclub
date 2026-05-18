-- Phase 43 — Landing Page System: create landing_pages table
-- Idempotent via IF NOT EXISTS.

BEGIN;

CREATE TABLE IF NOT EXISTS landing_pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  sections    JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS landing_pages_slug_idx       ON landing_pages (slug);
CREATE INDEX        IF NOT EXISTS landing_pages_is_active_idx  ON landing_pages (is_active);
CREATE INDEX        IF NOT EXISTS landing_pages_created_at_idx ON landing_pages (created_at DESC);

ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON landing_pages;
CREATE POLICY "service_role_all_access"
  ON landing_pages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
