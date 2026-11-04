-- Native electronic signatures. Server-only tables; no anonymous Supabase access.
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  company_name text NOT NULL,
  company_email text NOT NULL,
  signer_name text NOT NULL,
  signer_email text NOT NULL,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'pt')),
  expires_in_days integer NOT NULL DEFAULT 30 CHECK (expires_in_days BETWEEN 1 AND 90),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'voided')),
  version integer NOT NULL DEFAULT 1,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  expires_at timestamptz,
  signed_at timestamptz,
  snapshot jsonb,
  document_hash text,
  receipt jsonb,
  challenge jsonb,
  access_token_hash text,
  access_expires_at timestamptz,
  email_verified_at timestamptz,
  CONSTRAINT contracts_record_state CHECK (
    (status = 'draft' AND snapshot IS NULL AND receipt IS NULL AND signed_at IS NULL)
    OR (status IN ('sent', 'voided') AND snapshot IS NOT NULL AND document_hash IS NOT NULL AND sent_at IS NOT NULL AND expires_at IS NOT NULL AND receipt IS NULL AND signed_at IS NULL)
    OR (status = 'signed' AND snapshot IS NOT NULL AND document_hash IS NOT NULL AND receipt IS NOT NULL AND signed_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS contracts_created_at_idx ON public.contracts(created_at DESC);

CREATE TABLE IF NOT EXISTS public.contract_events (
  id uuid PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id),
  type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  actor text NOT NULL,
  ip_address text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS contract_events_contract_idx ON public.contract_events(contract_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contracts, public.contract_events FROM anon, authenticated;
DROP POLICY IF EXISTS service_role_all_access ON public.contracts;
CREATE POLICY service_role_all_access ON public.contracts FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_all_access ON public.contract_events;
CREATE POLICY service_role_all_access ON public.contract_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Prevent accidental edits/deletion of evidence, including through future routes.
-- A database owner can deliberately disable triggers; backups remain necessary.
CREATE OR REPLACE FUNCTION public.protect_contract_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Contract records cannot be deleted'; END IF;
  IF OLD.status <> 'draft' THEN
    IF ROW(NEW.title, NEW.body, NEW.company_name, NEW.company_email, NEW.signer_name,
      NEW.signer_email, NEW.language, NEW.expires_in_days, NEW.version, NEW.created_by,
      NEW.created_at, NEW.sent_at, NEW.expires_at, NEW.snapshot, NEW.document_hash)
      IS DISTINCT FROM
      ROW(OLD.title, OLD.body, OLD.company_name, OLD.company_email, OLD.signer_name,
      OLD.signer_email, OLD.language, OLD.expires_in_days, OLD.version, OLD.created_by,
      OLD.created_at, OLD.sent_at, OLD.expires_at, OLD.snapshot, OLD.document_hash)
      THEN RAISE EXCEPTION 'Issued contract content is immutable'; END IF;
    IF OLD.status IN ('signed', 'voided') AND
      ROW(NEW.status, NEW.receipt, NEW.signed_at) IS DISTINCT FROM ROW(OLD.status, OLD.receipt, OLD.signed_at)
      THEN RAISE EXCEPTION 'Final contract records are immutable'; END IF;
    IF OLD.status = 'sent' AND NEW.status NOT IN ('sent', 'signed', 'voided')
      THEN RAISE EXCEPTION 'Invalid contract transition'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_contract_record ON public.contracts;
CREATE TRIGGER protect_contract_record BEFORE UPDATE OR DELETE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.protect_contract_record();

CREATE OR REPLACE FUNCTION public.protect_contract_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Contract events are append-only';
END $$;
DROP TRIGGER IF EXISTS protect_contract_event ON public.contract_events;
CREATE TRIGGER protect_contract_event BEFORE UPDATE OR DELETE ON public.contract_events
  FOR EACH ROW EXECUTE FUNCTION public.protect_contract_event();
