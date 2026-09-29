// Content revision helpers (pages / forms / company_settings).
//
// recordRevision (app paths) never throws: a missing table (migration not
// applied yet) or a transient DB error must not block the admin edit that
// triggered it. recordRevisionOrThrow (scripts) fails loudly so a seed or patch
// never overwrites a row it could not snapshot.
//
// Growth control: a snapshot identical to the latest one for the same
// entity+id is skipped, and only the newest MAX_REVISIONS per entity+id are kept.
//
// restoreRevision writes the snapshot back through the regular update path
// (which itself snapshots the row being overwritten) after validating it, then
// adds a 'restore' marker revision.

import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "../db.js";
import { contentRevisions, updatePageSchema, updateFormSchema, insertCompanySettingsSchema } from "#shared/schema.js";
import type { ContentRevision, ContentRevisionEntity } from "#shared/schema.js";
import { validateFormConfig } from "#shared/form.js";

export const MAX_REVISIONS = 50;

export class RevisionError extends Error {
  constructor(message: string, public status: 400 | 404 | 422) {
    super(message);
  }
}

function toPlainJson(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
}

/** JSON.stringify with sorted keys, so jsonb key reordering does not defeat the equality check. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function recordRevisionOrThrow(
  entity: ContentRevisionEntity | string,
  entityId: string | number,
  snapshot: unknown,
  source: string,
  note?: string,
): Promise<void> {
  if (!snapshot) return;
  const id = String(entityId);
  const plain = toPlainJson(snapshot);

  const [latest] = await db
    .select({ snapshot: contentRevisions.snapshot })
    .from(contentRevisions)
    .where(and(eq(contentRevisions.entity, entity), eq(contentRevisions.entityId, id)))
    .orderBy(desc(contentRevisions.createdAt))
    .limit(1);
  if (latest && stableStringify(latest.snapshot) === stableStringify(plain)) return;

  await db.insert(contentRevisions).values({ entity, entityId: id, snapshot: plain, source, note: note ?? null });

  await db.execute(sql`
    DELETE FROM content_revisions
     WHERE entity = ${entity} AND entity_id = ${id}
       AND id NOT IN (
         SELECT id FROM content_revisions
          WHERE entity = ${entity} AND entity_id = ${id}
          ORDER BY created_at DESC
          LIMIT ${MAX_REVISIONS}
       )
  `);
}

export async function recordRevision(
  entity: ContentRevisionEntity | string,
  entityId: string | number,
  snapshot: unknown,
  source: string,
  note?: string,
): Promise<void> {
  try {
    await recordRevisionOrThrow(entity, entityId, snapshot, source, note);
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

function fail(prefix: string, issues: { path: (string | number)[]; message: string }[]): never {
  throw new RevisionError(`${prefix}: ${issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`, 422);
}

/** Validate a revision's snapshot and write it back through the regular update path. */
export async function restoreRevision(id: string): Promise<{ entity: string; entityId: string }> {
  const rev = await getRevision(id);
  if (!rev) throw new RevisionError("Revision not found", 404);
  const snap = rev.snapshot;
  const { storage } = await import("../storage.js");

  switch (rev.entity) {
    case "page": {
      if (!(await storage.getPage(rev.entityId))) throw new RevisionError("Target page no longer exists", 404);
      const parsed = updatePageSchema.safeParse(
        pick(snap, ["slug", "name", "sections", "isActive", "language", "alternateSlug"]),
      );
      if (!parsed.success) fail("Invalid page snapshot", parsed.error.issues);
      await storage.updatePage(rev.entityId, parsed.data as any);
      break;
    }
    case "form": {
      const formId = Number(rev.entityId);
      if (!Number.isInteger(formId) || !(await storage.getForm(formId))) {
        throw new RevisionError("Target form no longer exists", 404);
      }
      const parsed = updateFormSchema.safeParse(
        pick(snap, ["slug", "name", "description", "isDefault", "isActive", "config"]),
      );
      if (!parsed.success) fail("Invalid form snapshot", parsed.error.issues);
      if (parsed.data.config) {
        const errors = validateFormConfig(parsed.data.config, { requireQuestions: parsed.data.isActive === true });
        if (errors.length > 0) throw new RevisionError(`Invalid form config: ${errors.join("; ")}`, 422);
      }
      await storage.updateForm(formId, parsed.data as any);
      break;
    }
    case "company_settings": {
      const current = await storage.getCompanySettings();
      if (!current || String(current.id) !== rev.entityId) {
        throw new RevisionError("Target company settings row no longer exists", 404);
      }
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = snap as Record<string, unknown>;
      const parsed = insertCompanySettingsSchema.partial().safeParse(rest);
      if (!parsed.success) fail("Invalid company settings snapshot", parsed.error.issues);
      await storage.updateCompanySettings(parsed.data as any);
      break;
    }
    default:
      throw new RevisionError(`Unsupported revision entity: ${rev.entity}`, 400);
  }

  await recordRevision(rev.entity, rev.entityId, snap, "restore", `restored revision ${rev.id}`);
  return { entity: rev.entity, entityId: rev.entityId };
}
