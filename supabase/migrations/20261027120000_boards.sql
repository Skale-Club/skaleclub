-- Boards: mind maps and free canvases, public at /b/:slug when visibility = 'link'.
-- Fully idempotent.

CREATE TABLE IF NOT EXISTS public.boards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  kind          text NOT NULL DEFAULT 'mindmap',
  document      jsonb NOT NULL DEFAULT '{"schemaVersion":1,"nodes":[],"edges":[],"strokes":[],"theme":{"palette":"brand","background":"dots"}}'::jsonb,
  thumbnail_url text,
  visibility    text NOT NULL DEFAULT 'private',
  version       integer NOT NULL DEFAULT 1,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS boards_updated_at_idx ON public.boards (updated_at DESC);

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all_access ON public.boards;
CREATE POLICY service_role_all_access ON public.boards
  FOR ALL TO service_role USING (true) WITH CHECK (true);
