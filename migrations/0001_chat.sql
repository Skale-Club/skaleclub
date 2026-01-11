-- Chat feature tables

CREATE TABLE IF NOT EXISTS "chat_settings" (
  "id" serial PRIMARY KEY,
  "enabled" boolean DEFAULT false,
  "agent_name" text DEFAULT 'Skleanings Assistant',
  "welcome_message" text DEFAULT 'Hi! How can I help you today?',
  "excluded_url_rules" jsonb DEFAULT '[]',
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chat_integrations" (
  "id" serial PRIMARY KEY,
  "provider" text NOT NULL DEFAULT 'openai',
  "enabled" boolean DEFAULT false,
  "model" text DEFAULT 'gpt-4o-mini',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY,
  "status" text NOT NULL DEFAULT 'open',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  "last_message_at" timestamp,
  "first_page_url" text,
  "visitor_name" text,
  "visitor_phone" text,
  "visitor_email" text
);

CREATE TABLE IF NOT EXISTS "conversation_messages" (
  "id" uuid PRIMARY KEY,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "metadata" jsonb
);

CREATE INDEX IF NOT EXISTS "idx_conversations_last_message" ON "conversations" (COALESCE("last_message_at","created_at"));
CREATE INDEX IF NOT EXISTS "idx_conversation_messages_conversation_id" ON "conversation_messages" ("conversation_id");
