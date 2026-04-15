-- Phase 5.1 — Multi-Forms: schema + migration + compat shim
--
-- Creates the `forms` table, seeds the current `company_settings.form_config`
-- as the default form, and backfills `form_leads.form_id`.
--
-- Safe to run multiple times (idempotent via IF NOT EXISTS / guarded DML).

BEGIN;

-- 1. Create the forms table
CREATE TABLE IF NOT EXISTS forms (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  config      JSONB NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS forms_slug_idx ON forms (slug);
CREATE INDEX IF NOT EXISTS forms_is_default_idx ON forms (is_default);
CREATE INDEX IF NOT EXISTS forms_is_active_idx  ON forms (is_active);

-- Enforce: at most one default form at any time (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS forms_single_default_idx
  ON forms ((is_default))
  WHERE is_default = TRUE;

-- 2. Seed the existing form_config as the default form.
--    If company_settings has no form_config, leave the seed empty for now — a
--    later step (in the app code) can provision a default from DEFAULT_FORM_CONFIG.
INSERT INTO forms (slug, name, description, is_default, is_active, config)
SELECT
  'default',
  'Default Form',
  'Auto-migrated from legacy company_settings.form_config',
  TRUE,
  TRUE,
  cs.form_config
FROM company_settings cs
WHERE cs.form_config IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM forms WHERE slug = 'default')
ORDER BY cs.id
LIMIT 1;

-- 3. Add form_id to form_leads (nullable for the migration window).
ALTER TABLE form_leads
  ADD COLUMN IF NOT EXISTS form_id INTEGER REFERENCES forms(id);

CREATE INDEX IF NOT EXISTS form_leads_form_id_idx ON form_leads (form_id);

-- 4. Backfill form_id on existing leads to the default form (if one exists).
UPDATE form_leads fl
SET form_id = f.id
FROM forms f
WHERE f.is_default = TRUE
  AND fl.form_id IS NULL;

-- Note: we intentionally do NOT set form_id NOT NULL in this migration.
-- If the customer has leads but no form_config (edge case), form_id remains
-- NULL and the app's compat shim provisions a default form on first access,
-- which then backfills. A follow-up migration (Phase 5.5) tightens this to
-- NOT NULL once the backfill is guaranteed.

COMMIT;
