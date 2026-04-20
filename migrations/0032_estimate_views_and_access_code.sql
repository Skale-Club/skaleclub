-- Phase 9.1 — Public Viewer: add access_code column and estimate_views table
--
-- Adds access_code column to estimates table (nullable plain text).
-- Creates estimate_views table for view tracking with cascade FK.
-- Safe to run multiple times (idempotent via IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

BEGIN;

-- Add access_code column to estimates (nullable, no default)
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS access_code TEXT;

-- Create estimate_views table
CREATE TABLE IF NOT EXISTS estimate_views (
  id          SERIAL PRIMARY KEY,
  estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address  TEXT
);

CREATE INDEX IF NOT EXISTS estimate_views_estimate_id_idx ON estimate_views (estimate_id);
CREATE INDEX IF NOT EXISTS estimate_views_viewed_at_idx   ON estimate_views (viewed_at DESC);

-- Enable Row Level Security (consistent with estimates table)
ALTER TABLE estimate_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_access" ON estimate_views;
CREATE POLICY "service_role_all_access"
  ON estimate_views
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
