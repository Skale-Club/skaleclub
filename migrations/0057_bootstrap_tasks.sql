-- Self-applying maintenance tasks (content fixes, product artwork, 3D Printing
-- card). The server also creates this table itself on first use.
CREATE TABLE IF NOT EXISTS bootstrap_tasks (
  name TEXT PRIMARY KEY,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
