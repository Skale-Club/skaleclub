-- Rename landing_pages → pages and update all related indexes.
-- Idempotent: each statement uses IF EXISTS / IF NOT EXISTS.

BEGIN;

-- Rename the table
ALTER TABLE IF EXISTS landing_pages RENAME TO pages;

-- Rename indexes
ALTER INDEX IF EXISTS landing_pages_slug_idx     RENAME TO pages_slug_idx;
ALTER INDEX IF EXISTS landing_pages_is_active_idx RENAME TO pages_is_active_idx;
ALTER INDEX IF EXISTS landing_pages_created_at_idx RENAME TO pages_created_at_idx;

-- The unique constraint on slug is implemented as a unique index above;
-- the inline UNIQUE on the column stays valid after the table rename.

COMMIT;
