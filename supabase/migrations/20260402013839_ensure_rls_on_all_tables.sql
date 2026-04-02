-- Re-run RLS enable + service_role policy on ALL current public tables.
-- Covers tables created after migration 0020 (sales, portfolio_services, etc.).

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
