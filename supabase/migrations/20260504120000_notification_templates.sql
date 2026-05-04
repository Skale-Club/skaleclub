-- Phase 31 - Notification Templates: create notification_templates table
-- Stores one row per (event_key x channel) pair for DB-editable notification bodies.

CREATE TABLE IF NOT EXISTS notification_templates (
  id          SERIAL PRIMARY KEY,
  event_key   TEXT NOT NULL,
  channel     TEXT NOT NULL,
  body        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_templates_event_key_idx
  ON notification_templates (event_key);

CREATE UNIQUE INDEX IF NOT EXISTS notification_templates_event_channel_unique
  ON notification_templates (event_key, channel);

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON notification_templates;
CREATE POLICY "service_role_all_access"
  ON notification_templates FOR ALL TO service_role
  USING (true) WITH CHECK (true);
