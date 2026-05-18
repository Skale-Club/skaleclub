-- Add an optional secondary model column to chat_integrations.
-- Used by the presentation generator (server/routes/presentationsGenerator.ts)
-- so admins can pick a different Gemini model for slide generation than for
-- chat responses (e.g., gemini-2.5-pro for higher-quality decks vs.
-- gemini-2.5-flash for chat latency). NULL means "use the chat model column".

ALTER TABLE chat_integrations
  ADD COLUMN IF NOT EXISTS presentation_model TEXT;
