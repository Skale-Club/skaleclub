-- Content revisions: snapshots of pages / forms / company_settings taken before
-- every overwrite (admin edit, seed script, restore). Fully idempotent.

CREATE TABLE IF NOT EXISTS public.content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id text NOT NULL,
  snapshot jsonb NOT NULL,
  source text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_revisions_entity_idx
  ON public.content_revisions (entity, entity_id, created_at DESC);

-- Backend-only lockdown (same pattern as 20260605032050): RLS on, service_role
-- policy, no anon/authenticated policy.
ALTER TABLE public.content_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all_access ON public.content_revisions;
CREATE POLICY service_role_all_access ON public.content_revisions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
