-- Add a per-service logo icon image to portfolio_services.
-- Distinct from image_url (hero image); shown as a small square on the card.
-- Nullable, no default -> instant metadata-only change, safe on existing rows.
ALTER TABLE portfolio_services ADD COLUMN IF NOT EXISTS logo_icon_url text;
