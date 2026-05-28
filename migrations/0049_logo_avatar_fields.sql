-- Add 2 new logo variants used by full-bleed surfaces (estimate viewer, presentations):
--   logo_avatar_full → complete Skale Club logo (cover slide + access-code gate)
--   logo_avatar_mark → S-only mark (closing/signature slide)
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS logo_avatar_full TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_avatar_mark TEXT DEFAULT '';
