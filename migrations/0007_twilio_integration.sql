-- Create Twilio Settings table
CREATE TABLE IF NOT EXISTS "twilio_settings" (
  "id" SERIAL PRIMARY KEY,
  "enabled" BOOLEAN DEFAULT false,
  "account_sid" TEXT,
  "auth_token" TEXT,
  "from_phone_number" TEXT,
  "to_phone_number" TEXT,
  "notify_on_new_chat" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Insert default row
INSERT INTO "twilio_settings" ("enabled", "notify_on_new_chat")
VALUES (false, true)
ON CONFLICT DO NOTHING;
