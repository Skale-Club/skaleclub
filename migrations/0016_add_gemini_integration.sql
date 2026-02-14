-- Insert Gemini provider row if not exists
INSERT INTO chat_integrations (provider, enabled, model, api_key)
VALUES ('gemini', false, 'gemini-1.5-flash', NULL)
ON CONFLICT DO NOTHING;

-- Add active provider field to chat settings
ALTER TABLE chat_settings
ADD COLUMN IF NOT EXISTS active_ai_provider TEXT DEFAULT 'openai';

-- Update existing chat settings to have the new field
UPDATE chat_settings
SET active_ai_provider = 'openai'
WHERE active_ai_provider IS NULL;
