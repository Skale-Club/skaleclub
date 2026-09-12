-- A progressive form autosaves many times. A lead conversion is a business
-- event and must exist at most once per lead and conversion type.
DELETE FROM attribution_conversions newer
USING attribution_conversions older
WHERE newer.lead_id IS NOT NULL
  AND newer.lead_id = older.lead_id
  AND newer.conversion_type = older.conversion_type
  AND newer.id > older.id;

CREATE UNIQUE INDEX IF NOT EXISTS attribution_conversions_lead_type_unique
  ON attribution_conversions (lead_id, conversion_type);
