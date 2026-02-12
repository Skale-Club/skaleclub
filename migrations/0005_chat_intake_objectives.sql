ALTER TABLE "chat_settings"
  ADD COLUMN IF NOT EXISTS "intake_objectives" jsonb DEFAULT '[]';
