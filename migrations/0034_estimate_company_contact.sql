-- Add company_name and contact_name to estimates
-- Both nullable; app enforces at least one via Zod

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT;
