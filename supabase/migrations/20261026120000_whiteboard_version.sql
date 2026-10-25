-- Optimistic concurrency for whiteboards: each save bumps the version and a
-- save made from a stale version is refused. Idempotent.
ALTER TABLE public.whiteboards ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
