-- M3-03: Chat widget picks qualification form by slug.
--
-- Adds `form_slug` (nullable text) to chat_settings. NULL means use the default
-- form (current behavior); a slug points to a specific row in `forms`.

BEGIN;

ALTER TABLE chat_settings
  ADD COLUMN IF NOT EXISTS form_slug TEXT;

COMMIT;
