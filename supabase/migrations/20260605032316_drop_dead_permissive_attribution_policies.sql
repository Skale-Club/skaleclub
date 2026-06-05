-- Remove permissive "always-true" write policies on the marketing-attribution tables.
--
-- These were ported from the multi-tenant ancestor (skaleclub-websites) where the browser
-- wrote directly via the Supabase anon client. In THIS single-tenant codebase, every write to
-- visitor_sessions / attribution_conversions goes through the Express backend
-- (POST /api/attribution/session + /conversion -> storage.* -> postgres role, which bypasses RLS).
--
-- The anon INSERT and authenticated UPDATE grants are therefore dead, and only leave the tables
-- needlessly writable via the public PostgREST API. Dropping them clears the
-- rls_policy_always_true (0024) advisories without affecting any app code path.
--
-- The two authenticated SELECT policies are NOT flagged by the linter and are left intact
-- (admin analytics reads are low-risk and not part of this change).
--
-- Fully idempotent — safe to re-run.

DROP POLICY IF EXISTS "anon can insert sessions"          ON public.visitor_sessions;
DROP POLICY IF EXISTS "authenticated can update sessions"  ON public.visitor_sessions;
DROP POLICY IF EXISTS "anon can insert conversions"        ON public.attribution_conversions;
