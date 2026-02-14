ALTER TABLE "company_settings"
  DROP COLUMN IF EXISTS "minimum_booking_value";

DROP TABLE IF EXISTS "booking_items";
DROP TABLE IF EXISTS "bookings";

UPDATE "chat_settings"
SET "system_prompt" = 'You are our helpful chat assistant. Provide concise, friendly answers. Use the provided tools to fetch services and details. Do not guess prices; always use tool data when relevant.'
WHERE "system_prompt" ILIKE '%booking%'
   OR "system_prompt" ILIKE '%/booking%';
