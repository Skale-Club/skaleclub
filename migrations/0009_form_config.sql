-- Add form_config to company_settings for dynamic form questions
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS form_config jsonb;

-- Add custom_answers to form_leads for storing answers to custom questions
ALTER TABLE form_leads ADD COLUMN IF NOT EXISTS custom_answers jsonb DEFAULT '{}';
