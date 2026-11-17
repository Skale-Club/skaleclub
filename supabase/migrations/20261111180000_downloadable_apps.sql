-- Independent, free application catalog. No changes to SaaS/portfolio rows.
CREATE TABLE IF NOT EXISTS downloadable_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text NOT NULL,
  description text NOT NULL,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  releases jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE downloadable_apps ENABLE ROW LEVEL SECURITY;
-- Access is mediated by the Express API; no anonymous Supabase policies.
INSERT INTO downloadable_apps (slug, name, tagline, description)
VALUES ('xnote', 'XNote', 'Notes, ready when you need them.',
  'XNote is being prepared for download. Product details, supported platforms and installers will be confirmed before publication.')
ON CONFLICT (slug) DO NOTHING;
