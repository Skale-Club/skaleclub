-- Phase 21 — Blog automation: create blog_settings and blog_generation_jobs tables
-- Idempotent via IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.

BEGIN;

CREATE TABLE IF NOT EXISTS blog_settings (
  id                    SERIAL PRIMARY KEY,
  enabled               BOOLEAN NOT NULL DEFAULT false,
  posts_per_day         INTEGER NOT NULL DEFAULT 0,
  seo_keywords          TEXT NOT NULL DEFAULT '',
  enable_trend_analysis BOOLEAN NOT NULL DEFAULT false,
  prompt_style          TEXT NOT NULL DEFAULT '',
  last_run_at           TIMESTAMP,
  lock_acquired_at      TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blog_settings_updated_at_idx
  ON blog_settings (updated_at DESC);

ALTER TABLE blog_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON blog_settings;
CREATE POLICY "service_role_all_access"
  ON blog_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS blog_generation_jobs (
  id            SERIAL PRIMARY KEY,
  status        TEXT NOT NULL,
  reason        TEXT,
  post_id       INTEGER,
  started_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMP,
  error         TEXT
);

CREATE INDEX IF NOT EXISTS blog_generation_jobs_status_idx
  ON blog_generation_jobs (status);
CREATE INDEX IF NOT EXISTS blog_generation_jobs_started_at_idx
  ON blog_generation_jobs (started_at DESC);

ALTER TABLE blog_generation_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON blog_generation_jobs;
CREATE POLICY "service_role_all_access"
  ON blog_generation_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
