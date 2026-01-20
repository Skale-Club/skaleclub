-- Allow duplicate emails in form_leads
DROP INDEX IF EXISTS form_leads_email_unique;
CREATE INDEX IF NOT EXISTS form_leads_email_idx ON form_leads (email);
