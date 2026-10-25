-- Whiteboards: Excalidraw scenes drawn for YouTube videos, public at /w/:slug.
-- Fully idempotent.

CREATE TABLE IF NOT EXISTS public.whiteboards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  title      text NOT NULL,
  scene      jsonb NOT NULL DEFAULT '{"elements":[],"appState":{},"files":{}}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whiteboards_created_at_idx ON public.whiteboards (created_at DESC);

ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all_access ON public.whiteboards;
CREATE POLICY service_role_all_access ON public.whiteboards
  FOR ALL TO service_role USING (true) WITH CHECK (true);
