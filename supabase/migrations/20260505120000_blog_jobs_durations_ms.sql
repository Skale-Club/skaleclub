-- Phase 38 BLOG2-15: per-stage timing breakdown on blog_generation_jobs
-- Adds nullable JSONB column. Skipped jobs leave NULL. Completed jobs populate
-- { topic, content, image, upload, total } in integer milliseconds.
-- Failed jobs populate the stages that completed before the failure.

BEGIN;

ALTER TABLE blog_generation_jobs
  ADD COLUMN IF NOT EXISTS durations_ms JSONB;

COMMIT;
