-- Support multiple recipient phone numbers for Twilio notifications
ALTER TABLE "twilio_settings" ADD COLUMN IF NOT EXISTS "to_phone_numbers" JSONB DEFAULT '[]';

-- Migrate existing single recipient into the new array column
UPDATE "twilio_settings"
SET "to_phone_numbers" = CASE
  WHEN "to_phone_number" IS NOT NULL AND "to_phone_number" <> '' THEN jsonb_build_array("to_phone_number")
  ELSE '[]'::jsonb
END
WHERE "to_phone_numbers" IS NULL OR jsonb_typeof("to_phone_numbers") IS NULL;
