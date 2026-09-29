-- Timestamps that carry an instant (a scheduled live, a publication time, a lead
-- capture time) become timestamptz so the meaning survives a change of server or
-- session time zone. Existing values were written as UTC (the app runs with
-- TZ=UTC), so they are reinterpreted with AT TIME ZONE 'UTC'.
--
-- NOT applied automatically: review, then `npm run db:migrate -- --apply`.
-- Each ALTER only runs while the column is still `timestamp without time zone`,
-- so re-running is a no-op. ALTER TYPE rewrites the table and takes an ACCESS
-- EXCLUSIVE lock; these tables are small, but run it off-peak.

DO $$
DECLARE
  specs text[] := ARRAY[
    'hub_lives.starts_at',
    'hub_lives.ends_at',
    'hub_lives.registration_opens_at',
    'hub_lives.registration_closes_at',
    'blog_posts.published_at',
    'form_leads.created_at',
    'form_leads.updated_at'
  ];
  spec text;
  tbl text;
  col text;
BEGIN
  FOREACH spec IN ARRAY specs LOOP
    tbl := split_part(spec, '.', 1);
    col := split_part(spec, '.', 2);
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = col
        AND data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
        tbl, col, col
      );
    END IF;
  END LOOP;
END $$;
