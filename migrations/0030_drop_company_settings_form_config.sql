-- Drop legacy single-form config column. Multi-forms migration (0028) moved
-- form config into the `forms` table; 05-01 removed all runtime reads from
-- request handlers. This plan (05-02) removes the final two storage-layer
-- fallbacks that referenced this column, making it safe to drop.
ALTER TABLE company_settings DROP COLUMN IF EXISTS form_config;
