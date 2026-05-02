-- Skale Hub GHL sync tracking: link hub participants to GHL contacts
-- and mark each access event note sync independently.

BEGIN;

ALTER TABLE hub_participants
  ADD COLUMN IF NOT EXISTS ghl_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS ghl_sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ghl_last_synced_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ghl_sync_error TEXT;

CREATE INDEX IF NOT EXISTS hub_participants_ghl_contact_id_idx
  ON hub_participants (ghl_contact_id);

ALTER TABLE hub_access_events
  ADD COLUMN IF NOT EXISTS ghl_note_id TEXT,
  ADD COLUMN IF NOT EXISTS ghl_sync_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ghl_synced_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ghl_sync_error TEXT;

COMMIT;
