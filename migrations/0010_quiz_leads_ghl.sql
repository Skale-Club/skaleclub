-- Add GHL sync metadata to quiz leads
ALTER TABLE quiz_leads ADD COLUMN IF NOT EXISTS ghl_contact_id text;
ALTER TABLE quiz_leads ADD COLUMN IF NOT EXISTS ghl_sync_status text DEFAULT 'pending';
