ALTER TABLE "chat_settings" 
  ADD COLUMN IF NOT EXISTS "agent_avatar_url" text DEFAULT '';
