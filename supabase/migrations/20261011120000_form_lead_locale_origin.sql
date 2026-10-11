ALTER TABLE "form_leads"
  ADD COLUMN IF NOT EXISTS "referrer_url" text,
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'en';

UPDATE "form_leads"
SET "language" = 'pt'
WHERE "language" = 'en'
  AND "url_origem" ~* '/br(/|$)';
