-- Card preview for whiteboards, rendered by the editor on save. Idempotent.
ALTER TABLE public.whiteboards ADD COLUMN IF NOT EXISTS thumbnail_url text;
