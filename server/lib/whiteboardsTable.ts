import { sql } from "drizzle-orm";
import { db } from "../db.js";
import type { TaskResult } from "./contentFixes.js";

// The whiteboards table (supabase/migrations/20261025120000_whiteboards.sql,
// 20261025130000_whiteboard_thumbnails.sql and 20261026120000_whiteboard_version.sql). The deploy never runs migrations,
// so the same idempotent DDL applies itself as a bootstrap task.
export const WHITEBOARDS_DDL = [
  sql`CREATE TABLE IF NOT EXISTS public.whiteboards (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug       text NOT NULL UNIQUE,
    title      text NOT NULL,
    scene      jsonb NOT NULL DEFAULT '{"elements":[],"appState":{},"files":{}}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,
  sql`ALTER TABLE public.whiteboards ADD COLUMN IF NOT EXISTS thumbnail_url text`,
  sql`ALTER TABLE public.whiteboards ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1`,
  sql`CREATE INDEX IF NOT EXISTS whiteboards_created_at_idx ON public.whiteboards (created_at DESC)`,
  sql`ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY`,
  sql`DROP POLICY IF EXISTS service_role_all_access ON public.whiteboards`,
  sql`CREATE POLICY service_role_all_access ON public.whiteboards FOR ALL TO service_role USING (true) WITH CHECK (true)`,
];

export async function ensureWhiteboardsTable(): Promise<TaskResult> {
  await db.transaction(async (tx) => {
    for (const statement of WHITEBOARDS_DDL) await tx.execute(statement);
  });
  return { done: true, notes: ["whiteboards table, thumbnail_url and version columns, index and RLS policy in place"] };
}
