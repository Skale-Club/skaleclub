-- Ensure form leads can be inserted in single-tenant deployments.
ALTER TABLE form_leads
  ADD COLUMN IF NOT EXISTS tenant_id integer DEFAULT 1;

UPDATE form_leads
SET tenant_id = 1
WHERE tenant_id IS NULL;

ALTER TABLE form_leads
  ALTER COLUMN tenant_id SET DEFAULT 1,
  ALTER COLUMN tenant_id SET NOT NULL;
