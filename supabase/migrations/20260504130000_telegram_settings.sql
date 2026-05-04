-- Phase 32 - Telegram Integration: create telegram_settings singleton table

CREATE TABLE IF NOT EXISTS telegram_settings (
  id          SERIAL PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  bot_token   TEXT,
  chat_id     TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

ALTER TABLE telegram_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON telegram_settings;
CREATE POLICY "service_role_all_access"
  ON telegram_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);
