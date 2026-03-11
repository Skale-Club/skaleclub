-- Harden public schema access for Supabase PostgREST exposure.
-- 1) Enable RLS on every table in public schema (current + future existing at run time).
-- 2) Allow only service_role through PostgREST policies by default.
--    anon/authenticated receive no policies and therefore no table access.

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

DO $$
DECLARE
  t record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    FOR t IN
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'service_role_all_access', t.tablename);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        'service_role_all_access',
        t.tablename
      );
    END LOOP;
  END IF;
END
$$;
