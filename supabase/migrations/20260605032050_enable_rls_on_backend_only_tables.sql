-- Enable RLS + service_role policy on 4 backend-only tables that escaped prior RLS hardening:
--   api_tokens, oauth_codes, mcp_audit_logs, estimate_guidelines
--
-- Root cause: these tables were created by raw migrations 0046/0047/0048 (applied directly,
-- not via `npm run db:push`), so scripts/enforce-rls.ts never ran on them and they shipped
-- with RLS disabled — flagged repeatedly by the Supabase linter (rls_disabled_in_public / 0013).
--
-- These are server-managed (MCP API tokens, OAuth codes, MCP audit logs, estimate guidelines)
-- and are never accessed from the browser via the Supabase anon client.
--
-- Matches the project's established pattern (see 20260422175000_harden_rls_public_tables.sql):
--   RLS enabled + service_role full-access policy + NO anon/authenticated policy = backend-only lockdown.
-- Both postgres (Express direct connection) and service_role have rolbypassrls=true,
-- so backend access is unaffected; only anon/authenticated (PostgREST public API) get blocked.
--
-- Fully idempotent — safe to re-run.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['api_tokens','oauth_codes','mcp_audit_logs','estimate_guidelines']
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
