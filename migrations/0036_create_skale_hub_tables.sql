-- Phase 25 - Skale Hub foundation: create hub_lives, hub_participants,
-- hub_registrations, and hub_access_events tables.

BEGIN;

CREATE TABLE IF NOT EXISTS hub_lives (
  id                       SERIAL PRIMARY KEY,
  slug                     TEXT NOT NULL UNIQUE,
  title                    TEXT NOT NULL,
  description              TEXT,
  host_name                TEXT NOT NULL DEFAULT 'Skale Club',
  timezone                 TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  starts_at                TIMESTAMP NOT NULL,
  ends_at                  TIMESTAMP,
  registration_opens_at    TIMESTAMP,
  registration_closes_at   TIMESTAMP,
  stream_url               TEXT,
  replay_url               TEXT,
  status                   TEXT NOT NULL DEFAULT 'draft',
  capacity                 INTEGER,
  created_at               TIMESTAMP DEFAULT NOW(),
  updated_at               TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_lives_slug_idx
  ON hub_lives (slug);
CREATE INDEX IF NOT EXISTS hub_lives_status_starts_at_idx
  ON hub_lives (status, starts_at DESC);

ALTER TABLE hub_lives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON hub_lives;
CREATE POLICY "service_role_all_access"
  ON hub_lives FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS hub_participants (
  id                 SERIAL PRIMARY KEY,
  full_name          TEXT NOT NULL,
  phone_raw          TEXT,
  phone_normalized   TEXT,
  email_raw          TEXT,
  email_normalized   TEXT,
  source             TEXT NOT NULL DEFAULT 'hub',
  notes              TEXT,
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW(),
  CONSTRAINT hub_participants_identity_check
    CHECK (phone_raw IS NOT NULL OR email_raw IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS hub_participants_phone_normalized_idx
  ON hub_participants (phone_normalized);
CREATE INDEX IF NOT EXISTS hub_participants_email_normalized_idx
  ON hub_participants (email_normalized);

ALTER TABLE hub_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON hub_participants;
CREATE POLICY "service_role_all_access"
  ON hub_participants FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS hub_registrations (
  id               SERIAL PRIMARY KEY,
  live_id          INTEGER NOT NULL REFERENCES hub_lives(id) ON DELETE CASCADE,
  participant_id   INTEGER NOT NULL REFERENCES hub_participants(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'registered',
  source           TEXT NOT NULL DEFAULT 'hub-form',
  notes            TEXT,
  registered_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  cancelled_at     TIMESTAMP,
  attended_at      TIMESTAMP,
  last_access_at   TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW(),
  CONSTRAINT hub_registrations_live_participant_unique UNIQUE (live_id, participant_id)
);

CREATE INDEX IF NOT EXISTS hub_registrations_live_id_idx
  ON hub_registrations (live_id);
CREATE INDEX IF NOT EXISTS hub_registrations_participant_id_idx
  ON hub_registrations (participant_id);

ALTER TABLE hub_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON hub_registrations;
CREATE POLICY "service_role_all_access"
  ON hub_registrations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS hub_access_events (
  id                 SERIAL PRIMARY KEY,
  live_id            INTEGER NOT NULL REFERENCES hub_lives(id) ON DELETE CASCADE,
  participant_id     INTEGER REFERENCES hub_participants(id) ON DELETE SET NULL,
  registration_id    INTEGER REFERENCES hub_registrations(id) ON DELETE SET NULL,
  event_type         TEXT NOT NULL,
  outcome            TEXT NOT NULL,
  matched_by         TEXT NOT NULL DEFAULT 'none',
  phone_raw          TEXT,
  phone_normalized   TEXT,
  email_raw          TEXT,
  email_normalized   TEXT,
  ip_hash            TEXT,
  user_agent         TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hub_access_events_live_id_created_at_idx
  ON hub_access_events (live_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hub_access_events_registration_id_idx
  ON hub_access_events (registration_id);
CREATE INDEX IF NOT EXISTS hub_access_events_participant_id_idx
  ON hub_access_events (participant_id);

ALTER TABLE hub_access_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON hub_access_events;
CREATE POLICY "service_role_all_access"
  ON hub_access_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
