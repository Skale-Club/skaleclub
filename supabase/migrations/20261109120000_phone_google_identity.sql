-- Phone-first sign-in with Google Identity Platform (Firebase Auth), replacing Supabase Auth.
-- Additive and idempotent: nothing is dropped. Supabase stays as the Postgres host only.
--
-- users.id is text in this app, so auth_google_identities.user_id is text too.
-- The Firebase ID token is only proof of a phone or a Google account; the Express
-- session and the users row remain the source of who may do what.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON public.users (phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.auth_google_identities (
  project_id text NOT NULL,
  subject text NOT NULL,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, subject)
);
CREATE INDEX IF NOT EXISTS auth_google_identities_user ON public.auth_google_identities (user_id);

-- Server-only table: no anonymous or authenticated Supabase access (same pattern as
-- contracts / admin_passkeys). The auto-RLS event trigger would enable RLS anyway; this
-- keeps the migration self-contained.
ALTER TABLE public.auth_google_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_google_identities FROM anon, authenticated;
DROP POLICY IF EXISTS service_role_all_access ON public.auth_google_identities;
CREATE POLICY service_role_all_access ON public.auth_google_identities
  FOR ALL TO service_role USING (true) WITH CHECK (true);
