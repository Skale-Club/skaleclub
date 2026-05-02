-- Change presentations.slug from uuid to text
-- Existing UUIDs will be stored as text strings (valid conversion)
ALTER TABLE presentations
ALTER COLUMN slug TYPE text USING slug::text;

-- Slug no longer has a default — generated in application layer from title
-- Keep the unique constraint
