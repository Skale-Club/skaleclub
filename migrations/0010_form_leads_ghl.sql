-- Add GHL sync metadata to form leads
ALTER TABLE form_leads ADD COLUMN IF NOT EXISTS ghl_contact_id text;
ALTER TABLE form_leads ADD COLUMN IF NOT EXISTS ghl_sync_status text DEFAULT 'pending';
