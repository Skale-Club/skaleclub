-- Audit follow-up: objects that exist in the Drizzle schema (shared/schema) but not
-- yet in the database, plus integrity tightening. Every statement is idempotent.
-- NOT applied automatically: review, then `npm run db:migrate -- --apply`.

-- 1. Public blog list: WHERE status = 'published' ORDER BY published_at DESC.
CREATE INDEX IF NOT EXISTS blog_posts_status_published_at_idx
  ON blog_posts (status, published_at DESC);

-- 1b. Drop redundant slug indexes, but only where the UNIQUE constraint on the
--     same column exists (that constraint's index already serves every lookup).
DO $$
BEGIN
  IF to_regclass('public.hub_lives') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'public.hub_lives'::regclass
      AND c.contype = 'u' AND array_length(c.conkey, 1) = 1 AND a.attname = 'slug'
  ) THEN
    DROP INDEX IF EXISTS public.hub_lives_slug_idx;
  END IF;

  IF to_regclass('public.pages') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'public.pages'::regclass
      AND c.contype = 'u' AND array_length(c.conkey, 1) = 1 AND a.attname = 'slug'
  ) THEN
    DROP INDEX IF EXISTS public.pages_slug_idx;
  END IF;
END $$;

-- 2. Deleting a conversation removes its messages (no orphans, no FK error).
DO $$
DECLARE
  con record;
BEGIN
  IF to_regclass('public.conversation_messages') IS NULL
     OR to_regclass('public.conversations') IS NULL THEN
    RETURN;
  END IF;

  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.conversation_messages'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.conversations'::regclass
      AND a.attname = 'conversation_id'
      AND c.confdeltype <> 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.conversation_messages DROP CONSTRAINT %I', con.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.conversation_messages'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.conversations'::regclass
      AND a.attname = 'conversation_id'
  ) THEN
    ALTER TABLE public.conversation_messages
      ADD CONSTRAINT conversation_messages_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES public.conversations (id) ON DELETE CASCADE
      NOT VALID;
    ALTER TABLE public.conversation_messages
      VALIDATE CONSTRAINT conversation_messages_conversation_id_fkey;
  END IF;
END $$;

-- 3. Deleting a form keeps its leads (the business record) and nulls the link.
DO $$
DECLARE
  con record;
BEGIN
  IF to_regclass('public.form_leads') IS NULL OR to_regclass('public.forms') IS NULL THEN
    RETURN;
  END IF;

  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.form_leads'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.forms'::regclass
      AND a.attname = 'form_id'
      AND c.confdeltype <> 'n'
  LOOP
    EXECUTE format('ALTER TABLE public.form_leads DROP CONSTRAINT %I', con.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.form_leads'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'public.forms'::regclass
      AND a.attname = 'form_id'
  ) THEN
    ALTER TABLE public.form_leads
      ADD CONSTRAINT form_leads_form_id_fkey
      FOREIGN KEY (form_id) REFERENCES public.forms (id) ON DELETE SET NULL
      NOT VALID;
    ALTER TABLE public.form_leads
      VALIDATE CONSTRAINT form_leads_form_id_fkey;
  END IF;
END $$;

-- 4. created_at is NOT NULL in the Drizzle schema. Backfill, then enforce.
--    (A backfilled row gets now(): the true creation time is unknowable.)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'ai_generation_logs', 'blog_posts', 'chat_integrations', 'conversation_messages',
    'conversations', 'estimates', 'form_leads', 'forms', 'hub_lives', 'hub_participants',
    'hub_registrations', 'integration_settings', 'notification_templates', 'pages',
    'portfolio_services', 'presentations', 'redirects', 'resend_settings',
    'system_heartbeats', 'telegram_settings', 'translations', 'twilio_settings',
    'users', 'vcards'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = t
           AND column_name = 'created_at' AND is_nullable = 'YES'
       ) THEN
      EXECUTE format('UPDATE public.%I SET created_at = now() WHERE created_at IS NULL', t);
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_at SET NOT NULL', t);
    END IF;
  END LOOP;
END $$;
