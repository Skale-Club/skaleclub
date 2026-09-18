-- Legacy image_url covers are not necessarily website homes. Do not backfill.
ALTER TABLE portfolio_services
  ADD COLUMN IF NOT EXISTS home_image_url text,
  ADD COLUMN IF NOT EXISTS dashboard_image_url text;
