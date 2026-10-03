-- Skale NFC app (/nfc): WebAuthn passkeys (Face ID / fingerprint) for admins.
-- Discoverable credentials: login needs no email. Fully idempotent.

CREATE TABLE IF NOT EXISTS public.admin_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[],
  device_name text,
  created_at timestamp NOT NULL DEFAULT now(),
  last_used_at timestamp
);
CREATE INDEX IF NOT EXISTS admin_passkeys_user_idx ON public.admin_passkeys (user_id);

ALTER TABLE public.admin_passkeys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all_access ON public.admin_passkeys;
CREATE POLICY service_role_all_access ON public.admin_passkeys
  FOR ALL TO service_role USING (true) WITH CHECK (true);
