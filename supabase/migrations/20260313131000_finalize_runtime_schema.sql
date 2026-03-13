CREATE TABLE IF NOT EXISTS sessions (
  sid text PRIMARY KEY,
  sess jsonb NOT NULL,
  expire timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);

ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "agent_avatar_url" text DEFAULT '';
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "system_prompt" text DEFAULT 'You are our helpful chat assistant. Provide concise, friendly answers. Use the provided tools to fetch services and details. Do not guess prices; always use tool data when relevant.';
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "intake_objectives" jsonb DEFAULT '[]';
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "avg_response_time" text DEFAULT '';
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_provider" text DEFAULT 'gohighlevel';
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_id" text DEFAULT '';
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_staff" jsonb DEFAULT '[]';
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "language_selector_enabled" boolean DEFAULT false;
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "default_language" text DEFAULT 'en';
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "low_performance_sms_enabled" boolean DEFAULT false;
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "low_performance_threshold_seconds" integer DEFAULT 300;
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "use_faqs" boolean DEFAULT true;
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "active_ai_provider" text DEFAULT 'openai';

ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "homepage_content" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "form_config" jsonb;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "time_format" text DEFAULT '12h';
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "business_hours" jsonb;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "links_page_config" jsonb DEFAULT '{"avatarUrl":"/attached_assets/ghl-logo.webp","title":"Skale Club","description":"Data-Driven Marketing & Scalable Growth Solutions","links":[],"socialLinks":[]}'::jsonb;

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

ALTER TABLE "twilio_settings" ADD COLUMN IF NOT EXISTS "to_phone_numbers" jsonb DEFAULT '[]';

UPDATE "twilio_settings"
SET "to_phone_numbers" = CASE
  WHEN "to_phone_number" IS NOT NULL AND "to_phone_number" <> '' THEN jsonb_build_array("to_phone_number")
  ELSE '[]'::jsonb
END
WHERE "to_phone_numbers" IS NULL OR jsonb_typeof("to_phone_numbers") IS NULL;

ALTER TABLE "form_leads" ADD COLUMN IF NOT EXISTS "ghl_contact_id" text;
ALTER TABLE "form_leads" ADD COLUMN IF NOT EXISTS "ghl_sync_status" text DEFAULT 'pending';

DROP INDEX IF EXISTS "form_leads_email_unique";
DROP INDEX IF EXISTS "quiz_leads_email_unique";
CREATE INDEX IF NOT EXISTS "form_leads_email_idx" ON "form_leads" ("email");
CREATE INDEX IF NOT EXISTS "conversation_messages_conversation_idx" ON "conversation_messages" ("conversation_id");
CREATE INDEX IF NOT EXISTS "conversation_messages_conversation_created_idx" ON "conversation_messages" ("conversation_id", "created_at");

CREATE TABLE IF NOT EXISTS "portfolio_services" (
  "id" SERIAL PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "subtitle" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" TEXT NOT NULL,
  "price_label" TEXT NOT NULL DEFAULT 'One-time',
  "badge_text" TEXT NOT NULL DEFAULT 'One-time Fee',
  "features" JSONB DEFAULT '[]'::jsonb,
  "image_url" TEXT,
  "icon_name" TEXT DEFAULT 'Rocket',
  "cta_text" TEXT NOT NULL,
  "cta_button_color" TEXT DEFAULT '#406EF1',
  "background_color" TEXT DEFAULT 'bg-white',
  "text_color" TEXT DEFAULT 'text-slate-900',
  "accent_color" TEXT DEFAULT 'blue',
  "layout" TEXT NOT NULL DEFAULT 'left',
  "order" INTEGER DEFAULT 0,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_portfolio_services_slug" ON "portfolio_services" ("slug");
CREATE INDEX IF NOT EXISTS "idx_portfolio_services_order" ON "portfolio_services" ("order");
CREATE INDEX IF NOT EXISTS "idx_portfolio_services_active" ON "portfolio_services" ("is_active");
