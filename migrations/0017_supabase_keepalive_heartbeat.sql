-- Keep-alive heartbeats for Supabase cron monitoring
CREATE TABLE IF NOT EXISTS "system_heartbeats" (
  "id" serial PRIMARY KEY NOT NULL,
  "source" text DEFAULT 'vercel-cron' NOT NULL,
  "note" text DEFAULT '',
  "created_at" timestamp DEFAULT now()
);
