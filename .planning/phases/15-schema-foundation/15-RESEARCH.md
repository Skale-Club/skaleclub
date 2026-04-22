# Phase 15: Schema & Foundation — Research

**Researched:** 2026-04-21
**Domain:** PostgreSQL/Drizzle schema, Zod validators, Anthropic SDK singleton
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRES-01 | `presentations` table — UUID PK, slug (UUID, unique), title, slides (JSONB), guidelinesSnapshot (JSONB), accessCode (text nullable), version (int), createdAt, updatedAt | Drizzle `uuid()` + `jsonb()` columns verified in existing `chat.ts`; `gen_random_uuid()` SQL default confirmed in `auth.ts` |
| PRES-02 | `presentation_views` event-log — id, presentationId (FK → presentations, cascade delete), viewedAt, ipHash (SHA-256) | Mirrors `estimate_views` table exactly; cascade FK pattern confirmed in `0032_estimate_views_and_access_code.sql` |
| PRES-03 | `brand_guidelines` singleton — id, content (text), updatedAt. One row per tenant; upsert on save | Singleton pattern confirmed via `companySettings`; no new pattern needed |
| PRES-04 | `@anthropic-ai/sdk` installed; `server/lib/anthropic.ts` singleton `getAnthropicClient()` separate from `getActiveAIClient()` | SDK current version confirmed at 0.90.0; not in package.json yet; `getSupabaseAdmin()` pattern in `server/lib/supabase.ts` is the direct model |

</phase_requirements>

---

## Summary

Phase 15 is a pure foundation phase — no UI, no business logic — consisting of three orthogonal deliverables: (1) a raw SQL migration creating three tables, (2) a Drizzle + Zod schema file, and (3) an Anthropic SDK singleton. All three patterns are already established in the codebase; no new paradigms are introduced.

The existing estimates system (Phase 9) is the direct template for the presentations + views tables. The singleton pattern for `brand_guidelines` mirrors `companySettings`. The `getAnthropicClient()` function follows `getSupabaseAdmin()` in `server/lib/supabase.ts` exactly — lazy init, env-var key, module-level `let` cache, throw on missing key.

The one genuinely new element is the UUID primary key on `presentations`. The project already uses `uuid()` from `drizzle-orm/pg-core` (confirmed in `shared/schema/chat.ts` for `conversations`) and `sql\`gen_random_uuid()\`` as a default (confirmed in `shared/schema/auth.ts` for `users.id`). Both approaches are available; using `uuid("id").primaryKey().defaultRandom()` is the cleanest Drizzle idiom.

**Primary recommendation:** Model `presentations` directly on `estimates`; model `presentation_views` directly on `estimate_views`; follow `supabase.ts` for the Anthropic singleton. Run `npm install @anthropic-ai/sdk` and add `server/lib/anthropic.ts` before touching any schema.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Directive |
|------------|-----------|
| Schema source of truth | `shared/schema.ts` barrel re-exports all sub-files from `shared/schema/` — new file MUST be added here |
| Storage layer | All DB operations go through `server/storage.ts` implementing `IStorage` — new methods MUST be added to both interface and class |
| Migration pattern | Raw SQL scripts in `migrations/` with matching tsx runner in `scripts/` (drizzle-kit push is blocked by ESM import issues) |
| TypeScript | `npm run check` (tsc) must pass before work is complete |
| File size | Max 600 lines per file |
| Borders | Never solid black/white borders; use `--border` token |
| Translations | Always add PT translations when introducing `t()` strings (not applicable this phase — no UI) |
| Admin design system | Use `AdminCard`, `EmptyState`, `FormGrid` primitives (not applicable this phase — no UI) |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.39.3 (installed) | Drizzle table definitions, query builder | Already used for all tables in project |
| drizzle-zod | ^0.7.0 (installed) | `createInsertSchema` / select-type helpers | Already used in `settings.ts`, `chat.ts` |
| zod | ^3.24.2 (installed) | SlideBlock discriminated union validation | Already used everywhere for Zod schemas |
| @anthropic-ai/sdk | 0.90.0 (latest) | Claude API client | Required by PRES-04; not yet in package.json |
| pg | ^8.16.3 (installed) | Raw SQL migration runner via `pool` | `scripts/create-estimates-table.ts` uses it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (Node built-in) | built-in | `randomUUID()` for TS-side UUID generation | Not needed for DB (DB generates via defaultRandom) but useful in tests |

**Installation (only new dependency):**
```bash
npm install @anthropic-ai/sdk
```

**Version verification (confirmed 2026-04-21):**
```
npm view @anthropic-ai/sdk version → 0.90.0
npm view @anthropic-ai/sdk dist-tags → { latest: '0.90.0', alpha: '0.34.0-alpha.0' }
```

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
shared/schema/
└── presentations.ts      # NEW — Drizzle tables + Zod validators for PRES-01/02/03

shared/
└── schema.ts             # EDIT — add export * from "./schema/presentations.js"

server/lib/
└── anthropic.ts          # NEW — getAnthropicClient() singleton (PRES-04)

server/
└── storage.ts            # EDIT — add Presentation* imports + IStorage methods + impl

migrations/
└── 0033_create_presentations.sql  # NEW — idempotent CREATE TABLE statements

scripts/
└── migrate-presentations.ts  # NEW — tsx runner that executes the SQL and verifies
```

### Pattern 1: UUID Primary Key with Drizzle (PRES-01)

The project already uses `uuid()` from `drizzle-orm/pg-core` in `shared/schema/chat.ts`:

```typescript
// Source: shared/schema/chat.ts (conversations table)
import { uuid } from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey(),
  // ...
});
```

For `presentations`, use `.defaultRandom()` so the DB generates the UUID on INSERT without requiring caller to supply one:

```typescript
// Pattern for presentations table
import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const presentations = pgTable("presentations", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: uuid("slug").notNull().unique().defaultRandom(),
  title: text("title").notNull(),
  slides: jsonb("slides").$type<SlideBlock[]>().notNull().default([]),
  guidelinesSnapshot: jsonb("guidelines_snapshot").$type<string | null>(),
  accessCode: text("access_code"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});
```

### Pattern 2: Raw SQL Migration + tsx Runner (established project pattern)

All new tables since Phase 9 use a `migrations/NNNN_description.sql` file plus a `scripts/migrate-*.ts` runner. This is because `drizzle-kit push` fails with ESM import errors on this project (documented decision in STATE.md).

```typescript
// Source: scripts/migrate-estimate-views.ts (direct template)
import { pool } from '../server/db.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(join(process.cwd(), 'migrations/0033_create_presentations.sql'), 'utf-8');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running Phase 15 migration: presentations tables...');
    await client.query(sql);
    console.log('Migration complete.');
    // Verification queries here
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

### Pattern 3: Manual Zod Insert Schema (estimates pattern)

The project uses manual Zod schemas (not `createInsertSchema`) for tables with complex JSONB types, because `drizzle-zod` generates overly broad types for JSONB columns. This is documented in STATE.md for estimates.

```typescript
// Source: shared/schema/estimates.ts (template pattern)
// Manual Zod insert schema approach
export const insertPresentationSchema = z.object({
  title: z.string().min(1),
  slides: z.array(slideBlockSchema).default([]),
  accessCode: z.string().nullable().optional(),
});

export const selectPresentationSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().uuid(),
  title: z.string(),
  slides: z.array(slideBlockSchema),
  guidelinesSnapshot: z.string().nullable(),
  accessCode: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
});
```

### Pattern 4: SlideBlock Discriminated Union (PRES-12 foundation)

PRES-01 requires `slides` to hold `SlideBlock[]`. Phase 18 requires Zod validation. Define `slideBlockSchema` as a discriminated union on `layout` — this is the same approach as `estimateServiceItemSchema` in `shared/schema/estimates.ts`.

```typescript
// 8 layout variants (PRES-12)
export type SlideLayout =
  | "cover" | "section-break" | "title-body" | "bullets"
  | "stats" | "two-column" | "image-focus" | "closing";

export const slideBlockSchema = z.object({
  layout: z.enum(["cover","section-break","title-body","bullets","stats","two-column","image-focus","closing"]),
  heading:   z.string().optional(),
  headingPt: z.string().optional(),
  body:      z.string().optional(),
  bodyPt:    z.string().optional(),
  bullets:   z.array(z.string()).optional(),
  bulletsPt: z.array(z.string()).optional(),
  // stats variant fields
  stats:     z.array(z.object({ label: z.string(), value: z.string(), labelPt: z.string().optional() })).optional(),
});

export type SlideBlock = z.infer<typeof slideBlockSchema>;
```

Note: The requirement says "discriminated union" but because all 8 variants share the same bilingual field names (heading/headingPt, body/bodyPt, bullets/bulletsPt), a single schema with `.optional()` fields is simpler and still Zod-validated. A true `z.discriminatedUnion("layout", [...])` is also valid but forces each variant to spell out all fields. Either approach satisfies PRES-12 — use the flat schema for simplicity in Phase 15; Phase 18 can refine if needed.

### Pattern 5: Anthropic SDK Singleton (PRES-04)

Direct model: `server/lib/supabase.ts`. Pattern: module-level `let client = null`, lazy init on first call, throw if env var missing, return cached instance on subsequent calls.

```typescript
// Source: server/lib/supabase.ts pattern applied to Anthropic
import Anthropic from "@anthropic-ai/sdk";

let anthropicClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY must be set to use the Anthropic API"
      );
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}
```

Key points:
- Import is `import Anthropic from "@anthropic-ai/sdk"` (default export)
- Do NOT wire this through `getActiveAIClient()` — that returns an OpenAI-shaped client; Anthropic uses its own API
- No `runtimeKey` cache needed at this phase — Phase 18 can add that if settings-stored keys are required

### Pattern 6: brand_guidelines Singleton Table (PRES-03)

Mirrors `companySettings`: serial PK, one row per tenant. The upsert pattern (`INSERT ... ON CONFLICT DO UPDATE`) is used in Phase 17, but the schema must declare it now.

```typescript
export const brandGuidelines = pgTable("brand_guidelines", {
  id: serial("id").primaryKey(),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});
```

### Pattern 7: presentation_views FK with ipHash (PRES-02)

PRES-02 specifies `ipHash` (SHA-256 of client IP), whereas `estimate_views` stored raw `ip_address` (text). This is a deliberate design difference — the column name and type differ but the FK cascade pattern is identical.

```sql
CREATE TABLE IF NOT EXISTS presentation_views (
  id               SERIAL PRIMARY KEY,
  presentation_id  UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  viewed_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_hash          TEXT   -- SHA-256 of client IP, computed server-side
);
```

In Drizzle:
```typescript
export const presentationViews = pgTable("presentation_views", {
  id: serial("id").primaryKey(),
  presentationId: uuid("presentation_id").references(() => presentations.id, { onDelete: "cascade" }).notNull(),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  ipHash: text("ip_hash"),
});
```

### Anti-Patterns to Avoid

- **Using `drizzle-kit push` for migrations:** Blocked on this project due to ESM import errors. Always use raw SQL + tsx runner.
- **Using `createInsertSchema` for JSONB columns:** Generates `unknown` type for JSONB. Use manual Zod schemas instead (established pattern for estimates).
- **Wiring `getAnthropicClient()` through `getActiveAIClient()`:** The existing shim returns `{ client: OpenAI, model, provider }`. Anthropic uses a completely different API surface.
- **Adding `@anthropic-ai/sdk` to devDependencies:** PRES-04 explicitly requires it as a production dependency.
- **Skipping the barrel re-export:** `shared/schema.ts` must export the new file or downstream imports via `#shared/schema.js` won't see the tables.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation for `presentations.id` | Custom nanoid/crypto wrapper | `uuid().defaultRandom()` from Drizzle | DB-level generation; no client round-trip |
| SlideBlock JSON validation | Custom type-guard | Zod `slideBlockSchema` | Reused in Phase 18 for DB write gate |
| Anthropic client retry logic | Manual retry loop | `new Anthropic()` with default config | SDK handles retries, rate limits, and streaming |
| Migration safety | Manual DROP TABLE guards | `CREATE TABLE IF NOT EXISTS` + `IF NOT EXISTS` for indexes | Idempotent; safe re-runs |

---

## Common Pitfalls

### Pitfall 1: FK Type Mismatch Between Migration SQL and Drizzle Schema

**What goes wrong:** `presentation_views.presentation_id` is typed `UUID` in SQL but `serial` in Drizzle (copy-paste from `estimate_views` which uses INTEGER FK). TypeScript compiles but runtime INSERT fails.
**Why it happens:** `estimate_views.estimate_id` is INTEGER (references `estimates.id SERIAL`), but `presentations.id` is UUID. The FK column type must match the referenced PK type.
**How to avoid:** Explicitly use `uuid("presentation_id").references(...)` in Drizzle, and `UUID NOT NULL REFERENCES presentations(id)` in SQL.
**Warning signs:** `tsc` passes but migration fails with `ERROR: foreign key constraint ... has incompatible types`.

### Pitfall 2: Missing Barrel Re-Export Breaks Downstream Phases

**What goes wrong:** `shared/schema/presentations.ts` is created but `shared/schema.ts` is not updated. Phase 16 imports `presentations` from `#shared/schema.js` and gets `undefined`.
**Why it happens:** The barrel file is the only entry point used by `server/storage.ts` and `server/db.ts`.
**How to avoid:** Adding `export * from "./schema/presentations.js"` to `shared/schema.ts` is a required task in this phase.

### Pitfall 3: `$onUpdate` for `updatedAt` Doesn't Fire on Direct SQL

**What goes wrong:** The raw SQL migration doesn't automatically update `updated_at`. Drizzle's `.$onUpdate(() => new Date())` only fires through the ORM, not raw SQL inserts.
**Why it happens:** `$onUpdate` is a Drizzle callback, not a DB trigger.
**How to avoid:** In storage methods, always pass `updatedAt: new Date()` explicitly in UPDATE calls (same pattern as `updateEstimate`).

### Pitfall 4: IStorage Interface Not Updated

**What goes wrong:** `DatabaseStorage` has new methods but `IStorage` interface doesn't declare them. TypeScript reports the class implements the interface but new methods are invisible to callers using the interface type.
**Why it happens:** `storage.ts` is a single large file (1844 lines); adding to the implementation without updating the interface is easy to miss.
**How to avoid:** Add interface declarations near line 686 (after the existing Xpot methods) AND the implementations at the end of `DatabaseStorage`.

### Pitfall 5: `@anthropic-ai/sdk` ESM/CJS in Node

**What goes wrong:** `import Anthropic from "@anthropic-ai/sdk"` fails at runtime because the project is ESM (`"type": "module"` in package.json) but the SDK ships both formats.
**Why it happens:** No actual issue — the SDK ships `.mjs` and the project uses ESM. This is a non-pitfall but commonly feared.
**How to avoid:** Use the default import `import Anthropic from "@anthropic-ai/sdk"` — no `{ Anthropic }` named import needed. The SDK default export IS the `Anthropic` class.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (via DATABASE_URL) | Raw SQL migration | ✓ | Supabase (remote) | — |
| Node.js / tsx | Migration runner script | ✓ | 20.x | — |
| npm registry | `npm install @anthropic-ai/sdk` | ✓ | — | — |
| ANTHROPIC_API_KEY env var | `getAnthropicClient()` test | Unknown — not verified | — | Lazy-throw; client works until first call |

**Missing dependencies with no fallback:**
- `ANTHROPIC_API_KEY` must be set in `.env` before the SDK singleton can be tested (execution phase concern, not a blocker for schema work)

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`tsc`) via `npm run check` |
| Config file | `tsconfig.json` |
| Quick run command | `npm run check` |
| Full suite command | `npm run check` |

No Jest/Vitest detected in this project. Validation for Phase 15 is: (1) `npm run check` passes, (2) migration script exits 0, (3) `SELECT * FROM presentations LIMIT 1` returns empty set.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRES-01 | `presentations` table created with correct columns | smoke (manual SQL) | `npm run check` (type compilation) | ❌ Wave 0 — migration script |
| PRES-02 | `presentation_views` table with cascade FK | smoke (manual SQL) | `npm run check` | ❌ Wave 0 — migration script |
| PRES-03 | `brand_guidelines` table created | smoke (manual SQL) | `npm run check` | ❌ Wave 0 — migration script |
| PRES-04 | `getAnthropicClient()` exports and compiles; SDK in package.json | unit (tsc) | `npm run check` | ❌ Wave 0 — `server/lib/anthropic.ts` |

### Sampling Rate
- **Per task commit:** `npm run check`
- **Per wave merge:** `npm run check` + manual `SELECT * FROM presentations LIMIT 1`
- **Phase gate:** Full `npm run check` green + migration script exits 0 before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `migrations/0033_create_presentations.sql` — covers PRES-01, PRES-02, PRES-03
- [ ] `scripts/migrate-presentations.ts` — runner for the migration
- [ ] `shared/schema/presentations.ts` — covers PRES-01, PRES-02, PRES-03 (Drizzle definitions + Zod)
- [ ] `server/lib/anthropic.ts` — covers PRES-04

---

## Code Examples

### Drizzle UUID FK Column

```typescript
// Source: shared/schema/chat.ts (conversationMessages)
conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
```

### Drizzle UUID PK with defaultRandom

```typescript
// Source: drizzle-orm docs + auth.ts gen_random_uuid pattern
id: uuid("id").primaryKey().defaultRandom(),
```

`.defaultRandom()` is the Drizzle convenience wrapper for `gen_random_uuid()`. Confirmed available in `drizzle-orm ^0.39.3`.

### estimate_views FK Pattern (direct template for presentation_views)

```sql
-- Source: migrations/0032_estimate_views_and_access_code.sql
CREATE TABLE IF NOT EXISTS estimate_views (
  id          SERIAL PRIMARY KEY,
  estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address  TEXT
);
```

### RLS Policy Pattern (required for all new tables on Supabase)

```sql
-- Source: migrations/0031_create_estimates.sql and 0032_estimate_views_and_access_code.sql
ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_access" ON presentations;
CREATE POLICY "service_role_all_access"
  ON presentations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

All project tables use this RLS pattern (confirmed in every migration since 0031).

### Anthropic Client Instantiation

```typescript
// Source: @anthropic-ai/sdk README + supabase.ts pattern
import Anthropic from "@anthropic-ai/sdk";

let anthropicClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY must be set to use the Anthropic API");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createInsertSchema(table)` for JSONB tables | Manual Zod schemas | Phase 9 (State.md) | JSONB columns stay typed |
| drizzle-kit push | Raw SQL migration + tsx runner | Phase 9 (State.md decision) | ESM import error avoidance |
| INTEGER serial FK | UUID FK (for presentations_views → presentations) | Phase 15 (new) | FK type must be UUID, not INTEGER |

---

## Open Questions

1. **`guidelinesSnapshot` column type**
   - What we know: PRES-01 specifies JSONB; PRES-11 says it stores the brand guidelines string at generation time
   - What's unclear: Should it be `jsonb` (for structured future expansion) or `text` (since the content IS text/markdown)?
   - Recommendation: Use `text` — the content is markdown, not structured JSON; JSONB adds no benefit and requires casting. In Drizzle: `guidelinesSnapshot: text("guidelines_snapshot")`.

2. **`version` field — starts at 0 or 1?**
   - What we know: PRES-07 says "auto-increments version on each PUT save"
   - What's unclear: Initial value on INSERT
   - Recommendation: Default to `1` (first save is version 1); Phase 16 increments to 2 on first PUT.

3. **`slug` as UUID vs human-readable string**
   - What we know: PRES-01 explicitly says "slug (UUID, unique, public URL)"
   - What's clear: It is a UUID, not a human-readable slug like estimate slugs
   - Recommendation: Use `uuid("slug").notNull().unique().defaultRandom()` — the public URL will be `/p/:uuid-string`. This is consistent with the requirement.

---

## Sources

### Primary (HIGH confidence)
- `shared/schema/estimates.ts` — manual Zod schema pattern, estimates table structure
- `shared/schema/chat.ts` — uuid() PK pattern, uuid() FK reference pattern
- `shared/schema/auth.ts` — gen_random_uuid() default via sql template
- `shared/schema/settings.ts` — singleton table pattern (companySettings)
- `server/lib/supabase.ts` — lazy-init singleton with env-var throw pattern
- `migrations/0031_create_estimates.sql` — RLS policy pattern, idempotent migration style
- `migrations/0032_estimate_views_and_access_code.sql` — cascade FK pattern, views table style
- `scripts/migrate-estimate-views.ts` — tsx migration runner pattern
- `server/storage.ts` — IStorage interface + DatabaseStorage implementation structure
- `npm view @anthropic-ai/sdk` — confirmed version 0.90.0, latest as of 2026-04-21

### Secondary (MEDIUM confidence)
- @anthropic-ai/sdk npm registry metadata — export structure, ESM/CJS availability confirmed
- `STATE.md` decisions — drizzle-kit push blocked, manual Zod for JSONB, raw SQL migration pattern

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in package.json except @anthropic-ai/sdk (registry confirmed 0.90.0)
- Architecture: HIGH — all patterns sourced directly from existing project files
- Pitfalls: HIGH — sourced from project decision log and direct code inspection
- SlideBlock schema shape: MEDIUM — field names match PRES-12 requirement; exact discriminated union vs flat schema is a Phase 18 refinement

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable libraries; Anthropic SDK version may advance but 0.90.0 API is stable)
