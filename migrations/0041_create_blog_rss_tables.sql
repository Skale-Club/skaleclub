BEGIN;

-- blog_rss_sources: admin-curated feed list (RSS-01)
CREATE TABLE IF NOT EXISTS blog_rss_sources (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  url                  TEXT NOT NULL,
  enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  last_fetched_at      TIMESTAMP,
  last_fetched_status  TEXT,
  error_message        TEXT,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blog_rss_sources_enabled_idx
  ON blog_rss_sources (enabled);

-- blog_rss_items: parsed feed entries (RSS-02). FK cascades on source delete (D-01).
CREATE TABLE IF NOT EXISTS blog_rss_items (
  id            SERIAL PRIMARY KEY,
  source_id     INTEGER NOT NULL REFERENCES blog_rss_sources(id) ON DELETE CASCADE,
  guid          TEXT NOT NULL,
  url           TEXT NOT NULL,
  title         TEXT NOT NULL,
  summary       TEXT,
  published_at  TIMESTAMP,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'used', 'skipped')),
  used_at       TIMESTAMP,
  used_post_id  INTEGER,
  skip_reason   TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- D-06 (1): hot path "pending items per source" + dashboard counts
CREATE INDEX IF NOT EXISTS blog_rss_items_source_id_status_idx
  ON blog_rss_items (source_id, status);

-- D-06 (2): natural-key dedupe — bulletproof upsert by (source_id, guid)
CREATE UNIQUE INDEX IF NOT EXISTS blog_rss_items_source_id_guid_uniq
  ON blog_rss_items (source_id, guid);

-- RLS: mirror exactly the pattern from migration 0035 (blog_settings)
ALTER TABLE blog_rss_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON blog_rss_sources;
CREATE POLICY "service_role_all_access"
  ON blog_rss_sources FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE blog_rss_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_access" ON blog_rss_items;
CREATE POLICY "service_role_all_access"
  ON blog_rss_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;
