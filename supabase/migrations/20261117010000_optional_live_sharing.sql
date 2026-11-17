-- Additive, opt-in presentation/estimate following. No changes to source documents.
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id uuid PRIMARY KEY,
  source_kind text NOT NULL CHECK (source_kind IN ('presentation', 'estimate')),
  source_id text NOT NULL,
  created_by text NOT NULL,
  snapshot jsonb NOT NULL,
  controller_hash text NOT NULL,
  audience_hash text,
  access_code_hash text,
  slide_index integer NOT NULL DEFAULT 0 CHECK (slide_index >= 0),
  language text NOT NULL CHECK (language IN ('en', 'pt-BR')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  last_command_id text,
  last_seen_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS live_sessions_expires_idx ON public.live_sessions(expires_at);
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
-- Also works on plain PostgreSQL, where Supabase roles need not exist.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.live_sessions FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.live_sessions FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.live_sessions TO service_role;
    DROP POLICY IF EXISTS service_role_all_access ON public.live_sessions;
    CREATE POLICY service_role_all_access ON public.live_sessions FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
