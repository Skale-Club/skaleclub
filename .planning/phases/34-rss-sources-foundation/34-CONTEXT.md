# Phase 34: RSS Sources Foundation - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Database schema and storage layer for two new tables — `blog_rss_sources` and `blog_rss_items` — plus their Drizzle/Zod contracts and `IStorage` methods. No UI, no fetcher, no scoring logic, no integration with the generator. This is pure foundation work that downstream phases (35–38) will build on.

</domain>

<decisions>
## Implementation Decisions

### Cascade Behavior

- **D-01:** `blog_rss_items.source_id` uses `ON DELETE CASCADE`. When a source is deleted, all its items are deleted with it. The blog post remains (it lives in `blog_posts`), so deleting a source doesn't destroy generated content — only the trace of which RSS item produced which post.
  - **Why:** Matches the pattern from v1.5 (`blog_posts` cascade) and v1.6 (Hub event log). Simpler than `SET NULL` and avoids orphan rows. The audit value of "which RSS item became which post" is low compared to the operational simplicity of cascade.

### Item Retention

- **D-02:** No automatic cleanup of items in v1.9. Both `pending`, `used`, and `skipped` items are kept indefinitely. A purge job can be added later if DB size becomes a concern.
  - **Why:** YAGNI. The retention question is operational, not architectural — the schema doesn't need to anticipate it. A separate cleanup phase can be added when there's evidence DB growth is a problem.

### Authentication

- **D-03:** Public RSS feeds only for v1.9. The schema does NOT include auth fields (no `auth_type`, no `auth_value`, no `headers_json`). Adding them later is an additive migration, so this is forward-compatible.
  - **Why:** All RSS feeds Skale Club is likely to consume (blogs, news, industry sites) are public. Auth support is speculative and would clutter the schema with nullable columns no one populates.

### Score Storage

- **D-04:** Relevance scores are computed on-the-fly each time the generator runs. The `blog_rss_items` table does NOT have a `score` column. The scoring algorithm (Phase 35) reads pending items, scores them in-memory using current settings (keywords, recency), and picks the top one.
  - **Why:** Pending item counts will be small (tens, maybe low hundreds). Scoring is keyword-overlap math — sub-millisecond. Storing scores would create a stale-cache problem when SEO keywords change in settings. Compute-fresh is simpler and always correct.

### Status Field

- **D-05:** `blog_rss_items.status` is a Postgres `text` column with a CHECK constraint allowing only `'pending'`, `'used'`, `'skipped'`. Not a `pgEnum` — keeps migration simple and matches the v1.5/v1.6 pattern (other status fields in the codebase use text + Zod validation, not pgEnum).
  - **Why:** Project convention. `pgEnum` requires a separate type creation in migration and Drizzle has friction around enum changes. Text + CHECK + Zod gives the same safety with less ceremony.

### Indexes

- **D-06:** Two indexes on `blog_rss_items`:
  1. `(source_id, status)` — for the hot path "list pending items per source" and dashboard counts.
  2. `(guid, source_id)` UNIQUE — enforces "no duplicate item per source" at the DB level, so the upsert path is bulletproof against race conditions.
  - **Why:** The fetcher (Phase 35) will scan items by source and filter by status frequently. The unique constraint on `(guid, source_id)` is the same safety net used in the v1.6 Hub schema for participant deduplication.

### Schema Co-location

- **D-07:** Both new tables live in `shared/schema/blog.ts` (the existing blog schema file). No new file. The v1.5 pattern co-locates related tables (`blog_settings`, `blog_generation_jobs`, `blogPosts`) in a single domain file.
  - **Why:** Keeps the blog domain together. Splitting into `blog-rss.ts` would fragment the domain for no benefit.

### Storage Method Signatures

- **D-08:** New methods on `IStorage`:
  - `listRssSources(): Promise<BlogRssSource[]>`
  - `getRssSource(id: number): Promise<BlogRssSource | undefined>`
  - `createRssSource(input: InsertBlogRssSource): Promise<BlogRssSource>`
  - `updateRssSource(id: number, patch: Partial<InsertBlogRssSource>): Promise<BlogRssSource | undefined>`
  - `deleteRssSource(id: number): Promise<void>`
  - `upsertRssItem(item: InsertBlogRssItem): Promise<BlogRssItem>` — keyed on `(source_id, guid)`
  - `listPendingRssItems(limit?: number): Promise<BlogRssItem[]>`
  - `markRssItemUsed(itemId: number, postId: number): Promise<void>`
  - `markRssItemSkipped(itemId: number, reason?: string): Promise<void>`
  - **Why:** Covers the CRUD surface every downstream phase needs. The `markUsed` / `markSkipped` mutations are explicit verbs (no generic `updateRssItem`) so callers can't accidentally corrupt state by patching the wrong field.

### Migration Pattern

- **D-09:** Use `npx supabase db push` (Supabase CLI) for the migration, mirrored to both `migrations/` and `supabase/migrations/` per the v1.5/v1.6 pattern.
  - **Why:** Consistent with the established pattern. Drizzle Kit CJS bundle can't resolve `.js` ESM imports; the tsx script worked but the Supabase CLI is cleaner for additive table creation.

### Claude's Discretion

- Exact column ordering in the migration SQL
- Whether to add a `created_at` / `updated_at` pair to `blog_rss_sources` (recommended yes — useful for sorting in admin UI)
- Whether `blog_rss_items.summary` is `text` or `varchar(N)` — default to `text` matching project convention
- Whether to add an optional `feed_format` enum (rss/atom) on the source — recommended NO (the parser auto-detects)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level
- `.planning/PROJECT.md` — Project vision, constraints (additive tables only), AI provider stack
- `.planning/REQUIREMENTS.md` — v1.9 requirements (RSS-01..04 mapped to this phase)
- `.planning/ROADMAP.md` §"Phase 34" — Phase goal and success criteria

### Existing Schema Patterns
- `shared/schema/blog.ts` — Co-locates blog domain tables; new RSS tables go here
- `shared/schema.ts` — Barrel re-export pattern (re-export new types/schemas)
- `shared/schema/hub.ts` — Reference pattern for cascade delete + unique constraint (v1.6)
- `migrations/0028_multi_forms.sql` — Reference for raw SQL migration style (v1.1)
- `supabase/migrations/` — Mirror location for Supabase CLI migrations

### Storage Patterns
- `server/storage.ts` — `IStorage` interface and `DatabaseStorage` implementation
- `server/storage/` — Split storage adapters (note pattern, may apply if blog storage is split later)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `db` from `server/db.js` — Drizzle connection used everywhere
- `eq`, `and`, `inArray`, `desc` from `drizzle-orm` — query builders already imported across the codebase
- `pgTable`, `serial`, `integer`, `text`, `boolean`, `timestamp`, `index`, `unique` from `drizzle-orm/pg-core` — schema primitives
- `createInsertSchema` from `drizzle-zod` — used inconsistently in v1.5 (manual Zod preferred for nullable/defaulted fields per project decision)

### Established Patterns
- Manual Zod schemas with `.refine()` for cross-field validation (v1.5 pattern)
- `text` columns with Zod-enforced status enums (v1.5/v1.6 pattern, not pgEnum)
- `ON DELETE CASCADE` on every FK that ties an event-log row to its parent (v1.5/v1.6 pattern)
- Unique constraints on natural keys (e.g., `(source_id, guid)` analogous to `(form_id, lead_phone)` in v1.6)
- Storage methods named with explicit verbs (`upsert*`, `mark*Used`) not generic `update*`

### Integration Points
- `shared/schema/blog.ts` — add new tables here
- `shared/schema.ts` — re-export new types/schemas from the barrel
- `server/storage.ts` — add `IStorage` declarations + `DatabaseStorage` implementations

</code_context>

<specifics>
## Specific Ideas

- The `blog_rss_sources.error_message` field is intentionally just the LAST error (not a history). A separate audit log is out of scope for v1.9.
- The `blog_rss_items.published_at` is the publication date from the RSS item (`<pubDate>` or `<published>`), not the time we fetched it. This matters for the recency component of scoring.
- Both tables include `created_at` defaulting to `now()` for sortable ordering in admin UI.

</specifics>

<deferred>
## Deferred Ideas

- **Auth support for private feeds** — additive migration when a private feed is actually needed.
- **Item summary length cap / pgEnum status** — operational tweaks if scale or safety becomes a concern.
- **Automatic cleanup of stale items** — separate phase if DB growth becomes operationally relevant.
- **Score caching** — only if profiling shows scoring is a bottleneck (unlikely at small N).
- **Multiple feed formats per source** — RSS and Atom are both supported by the parser library; no schema work needed.

</deferred>

---

*Phase: 34-rss-sources-foundation*
*Context gathered: 2026-05-04*
