-- Permanent prevention for rls_disabled_in_public (Supabase linter 0013).
--
-- Root cause of the recurring "Table publicly accessible" alerts: tables created by raw/MCP
-- migrations (e.g. 0046 api_tokens/mcp_audit_logs, 0047 oauth_codes, 0048 estimate_guidelines)
-- never went through `npm run db:push`, so scripts/enforce-rls.ts never ran on them and they
-- shipped with RLS disabled.
--
-- This event trigger fires after EVERY CREATE TABLE in the public schema and:
--   1. enables Row-Level Security on the new table
--   2. grants service_role full access (matches the project's backend-only lockdown pattern)
-- so RLS is guaranteed no matter how a table is created (Drizzle, raw SQL, or MCP).
--
-- postgres and service_role have rolbypassrls=true, so backend access is never affected.
-- The function pins search_path = '' (lint 0011); format()/pg_event_trigger_ddl_commands() are
-- in pg_catalog (always searched) and object_identity is already fully schema-qualified.
--
-- Reversible: DROP EVENT TRIGGER auto_enable_rls_on_public_tables;

CREATE OR REPLACE FUNCTION public.auto_enable_rls_on_public_tables()
RETURNS event_trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT object_identity
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', 'service_role_all_access', obj.object_identity);
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'service_role_all_access', obj.object_identity
    );
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS auto_enable_rls_on_public_tables;

CREATE EVENT TRIGGER auto_enable_rls_on_public_tables
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.auto_enable_rls_on_public_tables();
