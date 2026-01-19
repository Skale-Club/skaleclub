-- Add quiz_config to company_settings for dynamic quiz questions
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS quiz_config jsonb;

-- Add custom_answers to quiz_leads for storing answers to custom questions
ALTER TABLE quiz_leads ADD COLUMN IF NOT EXISTS custom_answers jsonb DEFAULT '{}';
