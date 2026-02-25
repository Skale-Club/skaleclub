-- Create translations table for dynamic AI-powered translations
CREATE TABLE IF NOT EXISTS "translations" (
  "id" SERIAL PRIMARY KEY,
  "source_text" TEXT NOT NULL,
  "source_language" TEXT NOT NULL DEFAULT 'en',
  "target_language" TEXT NOT NULL,
  "translated_text" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Enable RLS to satisfy Supabase Security Advisor checks
ALTER TABLE "translations" ENABLE ROW LEVEL SECURITY;

-- Create unique index to prevent duplicate translations
CREATE UNIQUE INDEX IF NOT EXISTS "idx_translations_unique" ON "translations" (
  "source_text",
  "source_language",
  "target_language"
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS "idx_translations_lookup" ON "translations" (
  "source_language",
  "target_language"
);
