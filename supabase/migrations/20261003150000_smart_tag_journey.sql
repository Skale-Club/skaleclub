-- Smart Tags Journey: the story of the physical pieces, modelled on Xphere's
-- Ads Journey. Two tables:
--
--   smart_tag_plans            strategies, hypotheses, experiments, targets
--                              and tasks, with a status that is closed as
--                              validated / invalidated / done / cancelled.
--   smart_tag_journey_entries  the timeline: executions (what was done, with
--                              before → after) and decisions, insights,
--                              observations, risks and results. Each entry
--                              can point at a batch, a tag, a customer and a
--                              plan. Append-only: only `status` may change.
--
-- Allowed values mirror shared/smartTagJourney.ts.
-- Depends on 20261001120000_smart_tags.sql. Fully idempotent.

CREATE TABLE IF NOT EXISTS public.smart_tag_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL
    CHECK (kind IN ('strategy', 'hypothesis', 'experiment', 'target', 'task')),
  title text NOT NULL,
  description text,
  batch_id uuid REFERENCES public.smart_tag_batches(id) ON DELETE SET NULL,
  tag_id uuid REFERENCES public.smart_tags(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.smart_tag_customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'paused', 'validated', 'invalidated', 'done', 'cancelled')),
  -- What closing the plan showed (filled when it is validated, invalidated or done).
  outcome text,
  due_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS smart_tag_plans_status_idx ON public.smart_tag_plans (status, created_at DESC);
CREATE INDEX IF NOT EXISTS smart_tag_plans_batch_idx ON public.smart_tag_plans (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS smart_tag_plans_tag_idx ON public.smart_tag_plans (tag_id) WHERE tag_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.smart_tag_journey_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL
    CHECK (kind IN ('execution', 'decision', 'insight', 'observation', 'risk', 'result')),
  -- snake_case name of what an execution did (batch_created, printed, …).
  action text CHECK (action IS NULL OR action ~ '^[a-z][a-z0-9_]{0,39}$'),
  title text NOT NULL,
  content text,
  batch_id uuid REFERENCES public.smart_tag_batches(id) ON DELETE SET NULL,
  tag_id uuid REFERENCES public.smart_tags(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.smart_tag_customers(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.smart_tag_plans(id) ON DELETE SET NULL,
  before_value text,
  after_value text,
  source text NOT NULL CHECK (source IN ('system', 'admin', 'mcp')),
  actor text NOT NULL CHECK (actor IN ('human', 'ai', 'system')),
  actor_user_id text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'needs_review', 'archived', 'superseded')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- When it happened; may be earlier than created_at for an entry recorded afterwards.
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS smart_tag_journey_entries_occurred_idx
  ON public.smart_tag_journey_entries (occurred_at DESC);
CREATE INDEX IF NOT EXISTS smart_tag_journey_entries_batch_idx
  ON public.smart_tag_journey_entries (batch_id, occurred_at DESC) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS smart_tag_journey_entries_tag_idx
  ON public.smart_tag_journey_entries (tag_id, occurred_at DESC) WHERE tag_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS smart_tag_journey_entries_customer_idx
  ON public.smart_tag_journey_entries (customer_id, occurred_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS smart_tag_journey_entries_plan_idx
  ON public.smart_tag_journey_entries (plan_id) WHERE plan_id IS NOT NULL;

-- Append-only at the database level too: an UPDATE may change the review
-- status and nothing else. (ON DELETE SET NULL from a parent still works:
-- it only touches the foreign key columns.)
CREATE OR REPLACE FUNCTION public.smart_tag_journey_entries_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.action IS DISTINCT FROM OLD.action
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.before_value IS DISTINCT FROM OLD.before_value
    OR NEW.after_value IS DISTINCT FROM OLD.after_value
    OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.actor IS DISTINCT FROM OLD.actor
    OR NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id
    OR NEW.metadata IS DISTINCT FROM OLD.metadata
    OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'smart_tag_journey_entries are append-only: only status may change';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS smart_tag_journey_entries_append_only ON public.smart_tag_journey_entries;
CREATE TRIGGER smart_tag_journey_entries_append_only
  BEFORE UPDATE ON public.smart_tag_journey_entries
  FOR EACH ROW EXECUTE FUNCTION public.smart_tag_journey_entries_append_only();

-- Backend-only lockdown, same pattern as the other smart_tag_* tables.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['smart_tag_plans','smart_tag_journey_entries']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'service_role_all_access', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'service_role_all_access', t
    );
  END LOOP;
END
$$;
