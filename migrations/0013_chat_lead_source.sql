-- Add source and conversation tracking to form_leads
-- This allows tracking whether a lead came from the form or chat

-- Source field: 'form' or 'chat'
ALTER TABLE form_leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'form';

-- Link to conversation for chat-originated leads
ALTER TABLE form_leads ADD COLUMN IF NOT EXISTS conversation_id TEXT;

-- Create index for efficient source filtering
CREATE INDEX IF NOT EXISTS form_leads_source_idx ON form_leads(source);

-- Create index for conversation lookup
CREATE INDEX IF NOT EXISTS form_leads_conversation_idx ON form_leads(conversation_id);

-- Remove the score_total constraint as dynamic forms may have different max scores
ALTER TABLE form_leads DROP CONSTRAINT IF EXISTS form_leads_score_total_check;
