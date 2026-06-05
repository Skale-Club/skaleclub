-- Notifications redesign + Resend email integration
-- Idempotent: safe to run once via Supabase SQL editor, `supabase db push`, or psql.

-- 1. Resend (email) integration settings (singleton table)
CREATE TABLE IF NOT EXISTS public.resend_settings (
  id serial PRIMARY KEY,
  enabled boolean DEFAULT false,
  api_key text,
  from_name text,
  from_email text,
  to_emails jsonb DEFAULT '[]'::jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
ALTER TABLE public.resend_settings ENABLE ROW LEVEL SECURITY;

-- 2. Template redesign: per-template name + email subject; allow empty body on create
ALTER TABLE public.notification_templates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.notification_templates ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.notification_templates ALTER COLUMN body SET DEFAULT '';

-- 3. Allow multiple templates per (event_key, channel) — drop the unique index
DROP INDEX IF EXISTS public.notification_templates_event_channel_unique;

-- 4. Backfill a friendly name for the existing seeded rows
UPDATE public.notification_templates
SET name = CASE event_key
    WHEN 'new_chat' THEN 'New Chat'
    WHEN 'hot_lead' THEN 'Hot Lead'
    WHEN 'low_perf_alert' THEN 'Low Performance'
    ELSE event_key
  END || ' · ' || upper(channel)
WHERE name IS NULL;
