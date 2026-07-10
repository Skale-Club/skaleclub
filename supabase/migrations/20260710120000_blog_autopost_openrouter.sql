BEGIN;

-- Autopost port (Xkedule): editorial system prompt, auto-approve mode and
-- per-blog OpenRouter model selection on the settings singleton.
ALTER TABLE blog_settings
  ADD COLUMN IF NOT EXISTS system_prompt          TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS auto_approve           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS openrouter_text_model  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS openrouter_image_model TEXT NOT NULL DEFAULT '';

-- blog_post_feedback: approve/reject learning loop. No FK to blog_posts on
-- purpose — rejected posts are deleted but their feedback must survive, so
-- title/topic are snapshotted at feedback time.
CREATE TABLE IF NOT EXISTS blog_post_feedback (
  id             SERIAL PRIMARY KEY,
  post_id        INTEGER,
  post_title     TEXT NOT NULL,
  rss_item_title TEXT,
  signal         TEXT NOT NULL
                 CHECK (signal IN ('positive', 'negative')),
  reason         TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blog_post_feedback_signal_created_idx
  ON blog_post_feedback (signal, created_at);

COMMIT;
