// Shared guard rails for content seeds and patch scripts.
//
// Every script that overwrites pages / forms / company_settings runs in DRY-RUN
// by default: it prints a key-level diff of what it WOULD change and writes
// nothing. Pass `--apply` to write. Before any overwrite the previous row is
// snapshotted into content_revisions (source 'seed'), so a bad seed can be
// undone from the admin revisions endpoint.

import { eq } from "drizzle-orm";
import { pool, db } from "../../server/db.js";
import { forms } from "../../shared/schema/forms.js";
import type { FormConfig } from "../../shared/schema/forms.js";
import { pages } from "../../shared/schema/pages.js";
import type { PageSection } from "../../shared/schema/pages.js";
import { validateFormConfig } from "../../shared/form.js";
import { recordRevision } from "../../server/storage/revisions.js";

export function parseSeedArgs(argv: string[] = process.argv.slice(2)): { apply: boolean } {
  return { apply: argv.includes("--apply") };
}

function preview(v: unknown): string {
  const s = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v) ?? "undefined";
  return s.length > 90 ? `${s.slice(0, 87)}...` : s;
}

/** Compact key-level diff. One line per changed leaf: `path: before -> after`. */
export function diffJson(before: unknown, after: unknown, path = "", out: string[] = []): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return out;
  const isObj = (x: unknown) => x !== null && typeof x === "object";
  if (isObj(before) && isObj(after) && Array.isArray(before) === Array.isArray(after)) {
    const b = before as Record<string, unknown>;
    const a = after as Record<string, unknown>;
    const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
    for (const k of keys) {
      const next = Array.isArray(before) ? `${path}[${k}]` : path ? `${path}.${k}` : k;
      diffJson(b[k], a[k], next, out);
    }
    return out;
  }
  out.push(`${path || "(root)"}: ${before === undefined ? "(absent)" : preview(before)} -> ${after === undefined ? "(removed)" : preview(after)}`);
  return out;
}

export function logPlannedChange(label: string, before: unknown, after: unknown, apply: boolean, maxLines = 120): boolean {
  if (before === undefined) {
    console.log(`  [${apply ? "INSERT" : "would insert"}] ${label}`);
    return true;
  }
  const lines = diffJson(before, after);
  if (lines.length === 0) {
    console.log(`  [unchanged] ${label}`);
    return false;
  }
  console.log(`  [${apply ? "UPDATE" : "would update"}] ${label} (${lines.length} change${lines.length === 1 ? "" : "s"})`);
  for (const l of lines.slice(0, maxLines)) console.log(`      ${l}`);
  if (lines.length > maxLines) console.log(`      ... ${lines.length - maxLines} more`);
  return true;
}

/** Run a seed body with dry-run handling, error handling and pool teardown. */
export async function withSeedGuard(body: (apply: boolean) => Promise<void>): Promise<void> {
  const { apply } = parseSeedArgs();
  console.log(apply ? "== APPLY mode: writing to the database ==" : "== DRY RUN (default): nothing will be written. Re-run with --apply ==");
  try {
    await body(apply);
    console.log(apply ? "Done." : "Dry run complete. Re-run with --apply to write.");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  } finally {
    try { await pool.end(); } catch { /* noop */ }
  }
}

export type PageSeed = {
  slug: string;
  name: string;
  sections: PageSection[];
  isActive?: boolean;
  language?: "en" | "pt";
  alternateSlug?: string | null;
};

const pageShape = (r: Record<string, any>) => ({
  name: r.name, sections: r.sections, isActive: r.isActive, language: r.language, alternateSlug: r.alternateSlug ?? null,
});

/** Diff + (with apply) upsert a page keyed by slug, snapshotting the old row first. */
export async function seedPage(spec: PageSeed, apply: boolean): Promise<void> {
  const desired = {
    name: spec.name,
    sections: spec.sections,
    isActive: spec.isActive ?? true,
    language: spec.language ?? "pt",
    alternateSlug: spec.alternateSlug ?? null,
  };
  const [existing] = await db.select().from(pages).where(eq(pages.slug, spec.slug));
  const changed = logPlannedChange(`page '${spec.slug}'`, existing ? pageShape(existing) : undefined, desired, apply);
  if (!apply || !changed) return;
  if (existing) {
    await recordRevision("page", existing.id, existing, "seed", "seed script overwrite");
    await db.update(pages).set({ ...desired, updatedAt: new Date() }).where(eq(pages.slug, spec.slug));
  } else {
    await db.insert(pages).values({ slug: spec.slug, ...desired });
  }
}

export type FormSeed = {
  slug: string;
  name: string;
  description: string | null;
  config: FormConfig;
  isActive?: boolean;
  isDefault?: boolean;
};

/** Validate, diff and (with apply) upsert a form keyed by slug, snapshotting the old row first. */
export async function seedForm(spec: FormSeed, apply: boolean): Promise<void> {
  const isActive = spec.isActive ?? true;
  const errors = validateFormConfig(spec.config, { requireQuestions: isActive });
  if (errors.length > 0) {
    throw new Error(`Form '${spec.slug}' config is invalid:\n  - ${errors.join("\n  - ")}`);
  }
  const desired = { name: spec.name, description: spec.description, config: spec.config, isActive };
  const [existing] = await db.select().from(forms).where(eq(forms.slug, spec.slug));
  const shape = (r: Record<string, any>) => ({ name: r.name, description: r.description ?? null, config: r.config, isActive: r.isActive });
  const changed = logPlannedChange(`form '${spec.slug}'`, existing ? shape(existing) : undefined, desired, apply);
  if (!apply || !changed) return;
  if (existing) {
    await recordRevision("form", existing.id, existing, "seed", "seed script overwrite");
    await db.update(forms).set({ ...desired, updatedAt: new Date() }).where(eq(forms.slug, spec.slug));
  } else {
    await db.insert(forms).values({ slug: spec.slug, ...desired, isDefault: spec.isDefault ?? false });
  }
}
