-- Smart Tags NFC provisioning: the "Skale NFC Provisioner" desktop app writes
-- https://skale.club/n/<code> into a chip through a USB PC/SC reader. The
-- website stays the system of record: it creates jobs, the paired desktop
-- device claims them, and the result is verified here before the tag is marked.
--
-- Depends on 20261001120000_smart_tags.sql. Fully idempotent.

-- Paired desktop devices. A device row is created when an admin asks for a
-- pairing code; redeeming the code in the app turns it into a scoped token.
-- Only SHA-256 hashes of the code and the token are stored.
CREATE TABLE IF NOT EXISTS public.smart_tag_provisioning_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name text NOT NULL,
  platform text,
  app_version text,
  status text NOT NULL DEFAULT 'pairing'
    CHECK (status IN ('pairing', 'active', 'revoked')),
  pairing_code_hash text,
  pairing_expires_at timestamptz,
  token_hash text,
  token_prefix text,
  last_seen_at timestamptz,
  paired_at timestamptz,
  created_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS smart_tag_provisioning_devices_token_unique
  ON public.smart_tag_provisioning_devices (token_hash) WHERE token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS smart_tag_provisioning_devices_pairing_unique
  ON public.smart_tag_provisioning_devices (pairing_code_hash) WHERE pairing_code_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.smart_tag_provisioning_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.smart_tags(id) ON DELETE CASCADE,
  -- Fixed when the job is created; the app writes exactly this and the
  -- server compares the read-back against it.
  expected_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'writing', 'verifying', 'succeeded', 'failed', 'cancelled')),
  requested_by_user_id text,
  -- Optional: only this device may claim the job.
  target_device_id uuid REFERENCES public.smart_tag_provisioning_devices(id) ON DELETE SET NULL,
  claimed_by_device_id uuid REFERENCES public.smart_tag_provisioning_devices(id) ON DELETE SET NULL,
  readback_url text,
  tag_type text,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS smart_tag_provisioning_jobs_tag_idx
  ON public.smart_tag_provisioning_jobs (tag_id, created_at DESC);
CREATE INDEX IF NOT EXISTS smart_tag_provisioning_jobs_open_idx
  ON public.smart_tag_provisioning_jobs (status, created_at)
  WHERE status IN ('pending', 'claimed', 'writing', 'verifying');
-- At most one open job per physical tag.
CREATE UNIQUE INDEX IF NOT EXISTS smart_tag_provisioning_jobs_one_open_per_tag
  ON public.smart_tag_provisioning_jobs (tag_id)
  WHERE status IN ('pending', 'claimed', 'writing', 'verifying');

-- Step-by-step audit. No raw NFC memory dumps.
CREATE TABLE IF NOT EXISTS public.smart_tag_provisioning_events (
  id bigserial PRIMARY KEY,
  job_id uuid REFERENCES public.smart_tag_provisioning_jobs(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.smart_tags(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.smart_tag_provisioning_devices(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'job_created', 'job_claimed', 'job_cancelled', 'job_expired',
    'reader_connected', 'reader_disconnected', 'tag_detected',
    'write_started', 'write_completed', 'verification_passed', 'verification_failed',
    'lock_requested', 'lock_completed', 'error'
  )),
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS smart_tag_provisioning_events_job_idx
  ON public.smart_tag_provisioning_events (job_id, created_at);
CREATE INDEX IF NOT EXISTS smart_tag_provisioning_events_device_idx
  ON public.smart_tag_provisioning_events (device_id, created_at DESC);

-- Physical NFC state of each piece. public_code stays the business identity;
-- the chip UID is deliberately not stored.
ALTER TABLE public.smart_tags
  ADD COLUMN IF NOT EXISTS nfc_provisioning_status text NOT NULL DEFAULT 'not_programmed',
  ADD COLUMN IF NOT EXISTS nfc_programmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS nfc_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS nfc_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS nfc_provisioning_device_id uuid
    REFERENCES public.smart_tag_provisioning_devices(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'smart_tags_nfc_provisioning_status_check'
  ) THEN
    ALTER TABLE public.smart_tags ADD CONSTRAINT smart_tags_nfc_provisioning_status_check
      CHECK (nfc_provisioning_status IN ('not_programmed', 'programmed', 'verified', 'locked', 'failed'));
  END IF;
END
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['smart_tag_provisioning_devices','smart_tag_provisioning_jobs','smart_tag_provisioning_events']
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
