-- Cache generated WebP thumbnails for estimates and presentations.

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_signature TEXT;

ALTER TABLE presentations
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_signature TEXT;
