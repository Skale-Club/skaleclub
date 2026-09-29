// Content revision helpers (pages / forms / company_settings).
//
// recordRevision never throws: a missing table (migration not applied yet) or a
// transient DB error must not block the admin edit that triggered it.
// restoreRevision goes through the normal storage update path, which itself
// records a revision of the row being overwritten (source 'admin'); we then add
// a 'restore' marker revision pointing at the restored snapshot.

import { desc, eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { contentRevisions } from "#shared/schema.js";
import type { ContentRevision, ContentRevisionEntity } from "#shared/schema.js";

function toPlainJson(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
}

export async function recordRevision(
  entity: ContentRevisionEntity | string,
  entityId: string | number,
  snapshot: unknown,
  source: string,
  note?: string,
): Promise<void> {
  if (!snapshot) return;
  try {
    await db.insert(contentRevisions).values({
      entity,
      entityId: String(entityId),
      snapshot: toPlainJson(snapshot),
      source,
      note: note ?? null,
    });
  } catch (err) {
    console.warn(`[revisions] could not record ${entity}/${entityId} revision:`, (err as Error).message);
  }
}

export async function listRevisions(entity: string, entityId: string | number, limit = 20): Promise<ContentRevision[]> {
  const capped = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
  return db
    .select()
    .from(contentRevisions)
    .where(and(eq(contentRevisions.entity, entity), eq(contentRevisions.entityId, String(entityId))))
    .orderBy(desc(contentRevisions.createdAt))
    .limit(capped);
}

export async function getRevision(id: string): Promise<ContentRevision | undefined> {
  const [row] = await db.select().from(contentRevisions).where(eq(contentRevisions.id, id));
  return row;
}

function pick(snap: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in snap) out[k] = snap[k];
  return out;
}

/** Write a revision's snapshot back through the regular update path. */
export async function restoreRevision(id: string): Promise<{ entity: string; entityId: string }> {
  const rev = await getRevision(id);
  if (!rev) throw new Error("Revision not found");
  const snap = rev.snapshot;
  const { storage } = await import("../storage.js");

  switch (rev.entity) {
    case "page":
      await storage.updatePage(
        rev.entityId,
        pick(snap, ["slug", "name", "sections", "isActive", "language", "alternateSlug"]) as any,
      );
      break;
    case "form":
      await storage.updateForm(
        Number(rev.entityId),
        pick(snap, ["slug", "name", "description", "isDefault", "isActive", "config"]) as any,
      );
      break;
    case "company_settings": {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = snap as Record<string, unknown>;
      await storage.updateCompanySettings(rest as any);
      break;
    }
    default:
      throw new Error(`Unsupported revision entity: ${rev.entity}`);
  }

  await recordRevision(rev.entity, rev.entityId, snap, "restore", `restored revision ${rev.id}`);
  return { entity: rev.entity, entityId: rev.entityId };
}
