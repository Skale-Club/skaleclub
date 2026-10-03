-- Skale NFC app (/nfc): log of "direct" pieces — chips written with the
-- customer's own URL instead of a https://skale.club/n/<code> redirect.
-- These pieces have no public code, no redirect and no analytics; this table
-- only remembers what was delivered, to whom and when.
--
-- Depends on 20261001120000_smart_tags.sql. Fully idempotent.

CREATE TABLE IF NOT EXISTS public.smart_tag_direct_writes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.smart_tag_customers(id) ON DELETE SET NULL,
  url text NOT NULL,
  label text,
  -- web_nfc: written by the phone app. manual: link copied into another app
  -- (NFC Tools on iPhone) and confirmed by the operator.
  method text NOT NULL DEFAULT 'web_nfc' CHECK (method IN ('web_nfc', 'manual')),
  -- True only when the phone read the chip back and got exactly `url`.
  verified boolean NOT NULL DEFAULT false,
  written_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS smart_tag_direct_writes_created_idx
  ON public.smart_tag_direct_writes (created_at DESC);
CREATE INDEX IF NOT EXISTS smart_tag_direct_writes_customer_idx
  ON public.smart_tag_direct_writes (customer_id, created_at DESC);

ALTER TABLE public.smart_tag_direct_writes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all_access ON public.smart_tag_direct_writes;
CREATE POLICY service_role_all_access ON public.smart_tag_direct_writes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
