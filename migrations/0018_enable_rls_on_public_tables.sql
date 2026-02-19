-- Enable RLS on all current public tables to satisfy Supabase Security Advisor.
-- This is idempotent and safe to run multiple times.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;
