# Phase 21: Schema & Storage Foundation — Research

**Researched:** 2026-04-22
**Domain:** PostgreSQL/Drizzle schema, Zod validators, storage stubs for blog automation
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLOG-01 | `blog_settings` singleton table with enabled/postsPerDay/seoKeywords/enableTrendAnalysis/promptStyle/lastRunAt/lockAcquiredAt/updatedAt | Singleton row pattern already exists in `company_settings`; additive SQL table + storage upsert is the lowest-risk fit |
| BLOG-02 | `blog_generation_jobs` event-log table with status/reason/postId/startedAt/completedAt/error and NO FK on `postId` | Existing event-log patterns (`estimate_views`, `presentation_views`) confirm separate table design; requirement explicitly forbids FK so `post_id` stays nullable integer only |
| BLOG-03 | Drizzle table definitions + Zod schemas in `shared/schema/blog.ts`, barrel re-export in `shared/schema.ts` | Phase 15 `shared/schema/presentations.ts` and `shared/schema/estimates.ts` establish the exact pattern for new schema modules |
| BLOG-04 | Storage stubs in `IStorage` + `DatabaseStorage` for settings and job rows | Phase 15/16 established "typed storage stubs first, routes later" in `server/storage.ts` |

</phase_requirements>

---

## Summary

Phase 21 is another foundation phase, very close to Phase 15 in shape: add raw SQL migration files,
add a dedicated schema module under `shared/schema/`, re-export it from `shared/schema.ts`, and extend
`server/storage.ts` with interface declarations plus concrete methods. No new dependency is needed.

The safest implementation is:

1. Add an idempotent SQL migration + `tsx` runner for `blog_settings` and `blog_generation_jobs`.
2. Create `shared/schema/blog.ts` with Drizzle tables and manual Zod schemas.
3. Re-export from `shared/schema.ts` and add four storage methods to `IStorage` + `DatabaseStorage`.

Two codebase decisions strongly constrain the plan:

- Use raw SQL + `tsx` runner instead of `drizzle-kit push` for additive schema work.
- Use manual Zod schemas for new tables instead of relying on `drizzle-zod` for anything that needs
  precise defaults or nullable timestamp handling.

---

## Project Constraints

| Constraint | Directive |
|------------|-----------|
| Schema source of truth | New table definitions live in `shared/schema/blog.ts` and MUST be re-exported via `shared/schema.ts` |
| Storage abstraction | All persistence goes through `server/storage.ts`; do not introduce ad hoc DB helpers elsewhere |
| Migration pattern | Raw SQL file in `migrations/` plus matching `tsx` runner in `scripts/` |
| Additive-only DB changes | Create new tables only; do not mutate `blog_posts` or existing public APIs in this phase |
| Type safety gate | `npm run check` is the required compile-time verifier |

---

## Standard Stack

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | ^0.39.3 | Table definitions + storage queries | Existing project ORM |
| `zod` | ^3.24.2 | Insert/select validation | Existing project validator |
| `pg` | ^8.16.3 | Raw SQL runner via `pool` | Existing migration runner pattern |
| `tsx` | ^4.20.5 | Execute migration script | Already in devDependencies |

No new packages are required for Phase 21.

---

## Architecture Patterns

### Recommended Files

```
migrations/
└── 0035_create_blog_automation_tables.sql    # NEW

scripts/
└── migrate-blog-automation.ts                # NEW

shared/schema/
└── blog.ts                                   # NEW

shared/
└── schema.ts                                 # EDIT — add blog barrel export

server/
└── storage.ts                                # EDIT — imports, interface, implementations
```

### Pattern 1: Raw SQL + `tsx` runner

Use the same structure as `migrations/0033_create_presentations.sql` and
`scripts/migrate-presentations.ts`: idempotent `CREATE TABLE IF NOT EXISTS`, indexes, RLS policy,
and a runner that executes the SQL then verifies both tables exist.

### Pattern 2: Singleton settings table

`blog_settings` should be modeled like other singleton tables in the repo:

- `id SERIAL PRIMARY KEY`
- one-row read path in storage
- later phases use upsert/update against the first row

Use `posts_per_day INTEGER NOT NULL DEFAULT 0` with no DB enum/check in this phase; the 0-4 range is
better enforced in Zod and route-level validation, keeping the migration simple and additive.

### Pattern 3: Event-log table without post FK

`blog_generation_jobs` should be an append-only event log. Unlike `presentation_views`, `post_id`
must remain a plain nullable integer column with no foreign key because the requirement explicitly
states that the job can be created before the draft blog post exists.

Recommended SQL shape:

```sql
CREATE TABLE IF NOT EXISTS blog_generation_jobs (
  id            SERIAL PRIMARY KEY,
  status        TEXT NOT NULL,
  reason        TEXT,
  post_id       INTEGER,
  started_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMP,
  error         TEXT
);
```

### Pattern 4: Manual Zod schemas in `shared/schema/blog.ts`

The existing `blog_posts` insert schema in `shared/schema/cms.ts` is hand-written, and Phase 15 did
the same for presentations. Follow that model here:

- `insertBlogSettingsSchema`
- `selectBlogSettingsSchema`
- `insertBlogGenerationJobSchema`
- `selectBlogGenerationJobSchema`

Key details:

- `lastRunAt`, `lockAcquiredAt`, `startedAt`, and `completedAt` should accept `Date | string | null`
  on input and normalize to `Date | null`
- `status` stays a `z.enum(["pending", "running", "completed", "failed", "skipped"])`
- `postId` is `z.number().int().nullable().optional()` with no FK assumption

### Pattern 5: Storage-first downstream contract

Phase 22 and Phase 23 need typed entry points immediately, so Phase 21 should add these four methods
to both `IStorage` and `DatabaseStorage`:

```typescript
getBlogSettings(): Promise<BlogSettings | undefined>;
upsertBlogSettings(data: InsertBlogSettings): Promise<BlogSettings>;
createBlogGenerationJob(data: InsertBlogGenerationJob): Promise<BlogGenerationJob>;
updateBlogGenerationJob(id: number, data: Partial<InsertBlogGenerationJob>): Promise<BlogGenerationJob>;
```

`getBlogSettings()` should return `undefined` when no row exists yet. The "safe defaults" behavior is
an API concern for Phase 23, not a storage concern for Phase 21.

---

## Anti-Patterns To Avoid

- Do not add fields to `blog_posts` in this phase.
- Do not add an FK from `blog_generation_jobs.post_id` to `blog_posts.id`.
- Do not put the new table defs back into `shared/schema/cms.ts`; use `shared/schema/blog.ts`.
- Do not add route files or generator logic in Phase 21; this phase is foundation only.
- Do not skip the `shared/schema.ts` barrel export or downstream `#shared/schema.js` imports will fail.

---

## Common Pitfalls

### Pitfall 1: Accidentally making `getBlogSettings()` auto-create a row

That would break Phase 22's skip condition (`no_settings`). Storage should reflect DB truth; default
fallbacks belong in the API layer later.

### Pitfall 2: Using `createInsertSchema()` for timestamps with custom nullability behavior

Manual Zod keeps the contract explicit and matches the current project style for non-trivial tables.

### Pitfall 3: Forgetting `updatedAt: new Date()` in storage updates

`$onUpdate()` helps through Drizzle, but explicit `updatedAt` writes are the repo's established safe
pattern for update methods.

### Pitfall 4: Forgetting RLS policy in the raw SQL migration

Recent migrations consistently add `ENABLE ROW LEVEL SECURITY` plus `service_role_all_access`; Phase 21
should do the same for both new tables.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`tsc`) + `tsx` migration runner |
| Config file | `tsconfig.json` |
| Quick run command | `npm run check` |
| Full suite command | `npm run check && npx tsx scripts/migrate-blog-automation.ts` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BLOG-01 | `blog_settings` table exists with required columns | migration smoke | `npx tsx scripts/migrate-blog-automation.ts` | Wave 1 |
| BLOG-02 | `blog_generation_jobs` table exists and `post_id` has no FK | migration smoke | `npx tsx scripts/migrate-blog-automation.ts` | Wave 1 |
| BLOG-03 | Drizzle + Zod blog schema compiles and exports cleanly | compile | `npm run check` | Wave 1 |
| BLOG-04 | Storage interface + implementation compile with new methods | compile | `npm run check` | Wave 1 |

### Sampling Rate

- Per task: `npm run check`
- After migration task: `npx tsx scripts/migrate-blog-automation.ts`
- Phase gate: `npm run check && npx tsx scripts/migrate-blog-automation.ts`

### Wave 0 Requirements

Existing infrastructure covers this phase. No new test framework install is needed.

---

## Sources

- `shared/schema/cms.ts` — existing `blog_posts` table and manual `insertBlogPostSchema`
- `shared/schema/presentations.ts` — current foundation-phase template for dedicated schema files
- `shared/schema.ts` — barrel export contract
- `server/storage.ts` — `IStorage`/`DatabaseStorage` structure and blog post methods
- `migrations/0033_create_presentations.sql` — idempotent SQL + RLS pattern
- `scripts/migrate-presentations.ts` — migration runner pattern
- `.planning/STATE.md` — raw SQL migration pattern and storage-stub precedent

---

## Metadata

**Confidence breakdown:**
- Schema approach: HIGH
- Migration approach: HIGH
- Storage contract shape: HIGH
- Validation approach: HIGH

**Research date:** 2026-04-22
**Valid until:** 2026-05-22
