-- Smart Tags: dynamic QR/NFC redirects + interaction analytics for physical
-- products (Google Review signs first, NFC cards/keychains/etc. later).
--
-- One smart_tags row per physical piece. Its public_code is printed as a QR
-- (/q/<code>) and programmed into the NFC chip (/n/<code>) once; the
-- destination is data here and can change without reprinting or rewriting.
--
-- Allowed enum values mirror shared/smartTags.ts. Fully idempotent.
-- No raw IP is stored: smart_tag_events.visitor_day_key is a daily HMAC.

CREATE TABLE IF NOT EXISTS public.smart_tag_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  slug text,
  contact_name text,
  email text,
  phone text,
  external_crm_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.smart_tag_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code text NOT NULL,
  name text NOT NULL,
  product_type text NOT NULL,
  vendor text,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'generated'
    CHECK (status IN ('draft', 'generated', 'ordered', 'received', 'completed', 'cancelled')),
  notes text,
  created_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT smart_tag_batches_product_type_check CHECK (product_type IN (
    'google_review_sign', 'business_card', 'keychain', 'safety_tag', 'menu_tag', 'booking_tag', 'custom'
  ))
);
CREATE UNIQUE INDEX IF NOT EXISTS smart_tag_batches_batch_code_unique
  ON public.smart_tag_batches (batch_code);

CREATE TABLE IF NOT EXISTS public.smart_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code text NOT NULL,
  serial_number integer,
  batch_id uuid REFERENCES public.smart_tag_batches(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.smart_tag_customers(id) ON DELETE SET NULL,
  product_type text NOT NULL,
  status text NOT NULL DEFAULT 'inventory',
  destination_type text,
  destination_url text,
  utm_enabled boolean NOT NULL DEFAULT false,
  utm_campaign text,
  label text,
  metadata jsonb,
  assigned_at timestamptz,
  activated_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT smart_tags_status_check CHECK (status IN ('inventory', 'assigned', 'active', 'disabled', 'retired')),
  CONSTRAINT smart_tags_product_type_check CHECK (product_type IN (
    'google_review_sign', 'business_card', 'keychain', 'safety_tag', 'menu_tag', 'booking_tag', 'custom'
  )),
  CONSTRAINT smart_tags_destination_type_check CHECK (destination_type IS NULL OR destination_type IN (
    'google_review', 'website', 'booking', 'vcard', 'menu', 'social', 'custom'
  )),
  -- An active tag must always have somewhere to send people.
  CONSTRAINT smart_tags_active_has_destination CHECK (
    status <> 'active' OR (destination_url IS NOT NULL AND destination_type IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS smart_tags_public_code_unique ON public.smart_tags (public_code);
CREATE INDEX IF NOT EXISTS smart_tags_customer_id_idx ON public.smart_tags (customer_id);
CREATE INDEX IF NOT EXISTS smart_tags_batch_id_idx ON public.smart_tags (batch_id);
CREATE INDEX IF NOT EXISTS smart_tags_status_idx ON public.smart_tags (status);

CREATE TABLE IF NOT EXISTS public.smart_tag_destination_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.smart_tags(id) ON DELETE CASCADE,
  previous_url text,
  new_url text,
  previous_destination_type text,
  new_destination_type text,
  changed_by_user_id text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS smart_tag_destination_history_tag_idx
  ON public.smart_tag_destination_history (tag_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.smart_tag_events (
  id bigserial PRIMARY KEY,
  tag_id uuid NOT NULL REFERENCES public.smart_tags(id) ON DELETE CASCADE,
  -- Owner when the event happened (a re-assigned piece keeps its history apart).
  customer_id uuid REFERENCES public.smart_tag_customers(id) ON DELETE SET NULL,
  access_method text NOT NULL CHECK (access_method IN ('qr', 'nfc')),
  event_type text NOT NULL
    CHECK (event_type IN ('redirect', 'inventory_scan', 'disabled_scan', 'misconfigured_scan')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  visitor_day_key text,
  device_type text,
  os_family text,
  browser_family text,
  country_code text,
  referrer text,
  is_bot boolean NOT NULL DEFAULT false,
  request_id text
);
CREATE INDEX IF NOT EXISTS smart_tag_events_tag_occurred_idx ON public.smart_tag_events (tag_id, occurred_at);
CREATE INDEX IF NOT EXISTS smart_tag_events_method_occurred_idx ON public.smart_tag_events (access_method, occurred_at);
CREATE INDEX IF NOT EXISTS smart_tag_events_visitor_occurred_idx ON public.smart_tag_events (visitor_day_key, occurred_at);
CREATE INDEX IF NOT EXISTS smart_tag_events_occurred_idx ON public.smart_tag_events (occurred_at);
CREATE INDEX IF NOT EXISTS smart_tag_events_customer_occurred_idx ON public.smart_tag_events (customer_id, occurred_at);

-- History is append-only: refuse UPDATE at the database level too.
CREATE OR REPLACE FUNCTION public.smart_tag_destination_history_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'smart_tag_destination_history rows are immutable';
END;
$$;
DROP TRIGGER IF EXISTS smart_tag_destination_history_no_update ON public.smart_tag_destination_history;
CREATE TRIGGER smart_tag_destination_history_no_update
  BEFORE UPDATE ON public.smart_tag_destination_history
  FOR EACH ROW EXECUTE FUNCTION public.smart_tag_destination_history_immutable();

-- Backend-only lockdown (same pattern as 20260605032050): RLS on, service_role
-- policy, no anon/authenticated policy.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['smart_tag_customers','smart_tag_batches','smart_tags','smart_tag_destination_history','smart_tag_events']
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
