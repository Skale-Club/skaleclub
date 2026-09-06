BEGIN;

-- Quick task 260906-g80: Xphere lead handoff + visit booking.
-- Additive only. xphere_settings is a per-provider singleton (telegram_settings
-- pattern); integration_deliveries is the durable outbox for provider POSTs.
-- Single-tenant repo: tenant_id defaults to 1 and has no FK (no tenants table).

CREATE TABLE IF NOT EXISTS xphere_settings (
  id                      serial PRIMARY KEY,
  enabled                 boolean NOT NULL DEFAULT false,
  api_key                 text,
  key_prefix              text,
  xphere_org_id           text,
  xphere_org_name         text,
  status                  text NOT NULL DEFAULT 'disconnected',
  last_validated_at       timestamp,
  last_success_at         timestamp,
  last_error_at           timestamp,
  last_error_code         text,
  booking_enabled         boolean NOT NULL DEFAULT false,
  booking_profile_slug    text,
  in_person_event_slug    text,
  online_event_slug       text,
  visit_type_question_id  text NOT NULL DEFAULT 'tipoVisita',
  in_person_answer_value  text NOT NULL DEFAULT 'presencial',
  online_answer_value     text NOT NULL DEFAULT 'online',
  tenant_ref              text NOT NULL DEFAULT 'skaleclub',
  created_at              timestamp NOT NULL DEFAULT now(),
  updated_at              timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_deliveries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            integer NOT NULL DEFAULT 1,
  provider             text NOT NULL,
  event_type           text NOT NULL,
  aggregate_type       text NOT NULL,
  aggregate_id         integer NOT NULL,
  idempotency_key      text NOT NULL,
  payload              jsonb NOT NULL,
  status               text NOT NULL DEFAULT 'pending',
  attempt_count        integer NOT NULL DEFAULT 0,
  next_attempt_at      timestamp NOT NULL DEFAULT now(),
  locked_at            timestamp,
  locked_by            text,
  response_status      integer,
  provider_receipt_id  text,
  provider_contact_id  text,
  last_error_code      text,
  last_error_message   text,
  created_at           timestamp NOT NULL DEFAULT now(),
  updated_at           timestamp NOT NULL DEFAULT now(),
  delivered_at         timestamp,
  CONSTRAINT integration_deliveries_aggregate_unique
    UNIQUE (tenant_id, provider, event_type, aggregate_type, aggregate_id)
);

CREATE INDEX IF NOT EXISTS integration_deliveries_due_idx
  ON integration_deliveries (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS integration_deliveries_tenant_idx
  ON integration_deliveries (tenant_id, created_at DESC);

COMMIT;
