-- Phase 6.2 — Estimates System: create estimates table
--
-- Creates the `estimates` table with JSONB services snapshot column.
-- Safe to run multiple times (idempotent via IF NOT EXISTS).

BEGIN;

CREATE TABLE IF NOT EXISTS estimates (
  id          SERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  note        TEXT,
  services    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS estimates_slug_idx    ON estimates (slug);
CREATE INDEX IF NOT EXISTS estimates_created_at_idx ON estimates (created_at DESC);

-- Enable Row Level Security (consistent with all public tables in this project)
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_access" ON estimates;
CREATE POLICY "service_role_all_access"
  ON estimates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
