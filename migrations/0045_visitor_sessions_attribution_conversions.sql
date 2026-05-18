-- Phase 45 — Marketing Attribution tables (single-tenant adaptation of
-- skaleclub-websites v1.2). Adds visitor_sessions + attribution_conversions
-- and a visitor_id FK column on the existing form_leads table.
-- Fully idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS visitor_sessions (
  id                   serial      PRIMARY KEY,
  visitor_id           uuid        NOT NULL,
  ft_source            text,
  ft_medium            text,
  ft_campaign          text,
  ft_term              text,
  ft_content           text,
  ft_id                text,
  ft_landing_page      text,
  ft_referrer          text,
  ft_source_channel    text,
  lt_source            text,
  lt_medium            text,
  lt_campaign          text,
  lt_term              text,
  lt_content           text,
  lt_id                text,
  lt_landing_page      text,
  lt_referrer          text,
  lt_source_channel    text,
  device_type          text,
  converted            boolean     DEFAULT false,
  first_seen_at        timestamp   DEFAULT now(),
  last_seen_at         timestamp   DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS visitor_sessions_visitor_id_unique
  ON visitor_sessions (visitor_id);
CREATE INDEX IF NOT EXISTS visitor_sessions_ft_source_channel_idx
  ON visitor_sessions (ft_source_channel);
CREATE INDEX IF NOT EXISTS visitor_sessions_converted_idx
  ON visitor_sessions (converted);
CREATE INDEX IF NOT EXISTS visitor_sessions_first_seen_at_idx
  ON visitor_sessions (first_seen_at);
CREATE INDEX IF NOT EXISTS visitor_sessions_last_seen_at_idx
  ON visitor_sessions (last_seen_at);

CREATE TABLE IF NOT EXISTS attribution_conversions (
  id                  serial      PRIMARY KEY,
  visitor_id          integer     REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  lead_id             integer     REFERENCES form_leads(id)       ON DELETE SET NULL,
  conversion_type     text        NOT NULL,
  ft_source           text,
  ft_medium           text,
  ft_campaign         text,
  ft_landing_page     text,
  lt_source           text,
  lt_medium           text,
  lt_campaign         text,
  lt_landing_page     text,
  page_path           text,
  converted_at        timestamp   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attribution_conversions_visitor_id_idx
  ON attribution_conversions (visitor_id);
CREATE INDEX IF NOT EXISTS attribution_conversions_lead_id_idx
  ON attribution_conversions (lead_id);
CREATE INDEX IF NOT EXISTS attribution_conversions_conversion_type_idx
  ON attribution_conversions (conversion_type);
CREATE INDEX IF NOT EXISTS attribution_conversions_converted_at_idx
  ON attribution_conversions (converted_at);

-- Add visitor_id FK column to existing form_leads table (Phase 45 lead-creation hook).
ALTER TABLE form_leads
  ADD COLUMN IF NOT EXISTS visitor_id integer;

-- The FK constraint requires visitor_sessions to exist (CREATE TABLE above).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'form_leads'
      AND constraint_name = 'form_leads_visitor_id_fkey'
  ) THEN
    ALTER TABLE form_leads
      ADD CONSTRAINT form_leads_visitor_id_fkey
      FOREIGN KEY (visitor_id) REFERENCES visitor_sessions(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS form_leads_visitor_id_idx
  ON form_leads (visitor_id);

-- Defensive cleanup: if a prior partial run (or a multi-tenant ancestor of these
-- tables) left tenant_id columns + tenant_isolation RLS policies + tenant FKs,
-- drop them. Single-tenant adaptation requires zero tenant_id columns. The
-- tenant_isolation policy depends on tenant_id, so we drop it first; then CASCADE
-- the column drop to also remove the FK constraint cleanly. Other RLS policies
-- (anon insert, authenticated select/update, service_role_all_access) do NOT
-- reference tenant_id and remain in place.
DROP POLICY IF EXISTS tenant_isolation ON visitor_sessions;
DROP POLICY IF EXISTS tenant_isolation ON attribution_conversions;

DROP INDEX IF EXISTS visitor_sessions_tenant_id_idx;
DROP INDEX IF EXISTS visitor_sessions_tenant_visitor_id_unique;
DROP INDEX IF EXISTS attribution_conversions_tenant_id_idx;

ALTER TABLE visitor_sessions
  DROP COLUMN IF EXISTS tenant_id CASCADE;

ALTER TABLE attribution_conversions
  DROP COLUMN IF EXISTS tenant_id CASCADE;

