-- Migration: Harden RLS on all public tables
-- This migration ensures RLS is enabled on all tables in the public schema
-- and grants full access to the service_role for backend operations.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE 'sql_%'
  LOOP
    -- 1. Enable RLS on the table
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);

    -- 2. Create or replace service_role policy (for administrative/backend access)
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'service_role_all_access', t.tablename);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        'service_role_all_access',
        t.tablename
      );
    END IF;

    -- 3. Ensure no public access by default (RLS enabled + no public policy = total lockdown)
    -- We intentionally do not create public or authenticated policies here.
    -- If specific tables need public read (e.g., portfolio), they should be handled via the backend
    -- or explicit migrations for those tables.
  END LOOP;
END
$$;
