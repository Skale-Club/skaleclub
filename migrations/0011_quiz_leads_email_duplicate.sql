-- Allow duplicate emails in quiz_leads
DROP INDEX IF EXISTS quiz_leads_email_unique;
CREATE INDEX IF NOT EXISTS quiz_leads_email_idx ON quiz_leads (email);
