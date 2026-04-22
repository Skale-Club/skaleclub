# Phase 22: Blog Generator Engine - Research

**Researched:** 2026-04-22
**Domain:** Gemini-powered blog generation pipeline, DB locking, draft blog post creation, Supabase image upload
**Confidence:** MEDIUM-HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLOG-05 | `BlogGenerator.generate({ manual })` owns the full pipeline and returns skip or success metadata | A dedicated `server/lib/blog-generator.ts` mirrors the Phase 18 pattern: one entry point, explicit helper functions, no route logic mixed into storage |
| BLOG-06 | Automatic runs skip safely when settings are missing, disabled, empty, or too recent | Existing Phase 21 storage contract already distinguishes `undefined` from a real row, so skip logic can be deterministic without creating defaults |
| BLOG-07 | Global DB lock prevents duplicate runs across workers | `blog_settings.lock_acquired_at` can be updated with one guarded SQL statement against the singleton row; this is safer than an in-memory mutex on Vercel |
| BLOG-08 | Gemini generates topic plus structured blog JSON with key fallback order | The official Google Gen AI SDK supports server-side content generation and explicit API-key injection, which cleanly implements `BLOG_GEMINI_API_KEY -> GEMINI_API_KEY -> GOOGLE_API_KEY` |
| BLOG-09 | Image generation failure is non-blocking | Gemini image generation can be wrapped in a best-effort helper so the post path always continues with `featureImageUrl: null` |
| BLOG-10 | Generated image uploads to Supabase Storage under `images/blog-images/...` | Existing `getSupabaseAdmin()` plus public-bucket upload patterns in `server/storage/supabaseStorage.ts` already cover the required upload/public-URL flow |
| BLOG-11 | Draft `blog_posts` row is created before the job gets its `postId` | Existing `storage.createBlogPost()` and `updateBlogGenerationJob()` methods make the required ordering explicit and easy to verify |
| BLOG-12 | `lastRunAt` updates only on success; lock always clears | Phase 21's `upsertBlogSettings()` already writes timestamps, so success and failure finalization can reuse the same singleton row update path |

</phase_requirements>

---

## Summary

Phase 22 should build a dedicated generator service, not route-level logic. The cleanest shape is:

1. Add an isolated Gemini helper for the blog pipeline in `server/lib/blog-gemini.ts`.
2. Implement `BlogGenerator.generate({ manual })` in `server/lib/blog-generator.ts` with explicit preflight checks, lock acquisition, job lifecycle, and cleanup.
3. Use Gemini for two generation steps: topic ideation and structured content JSON.
4. Attempt image generation as a best-effort branch; on any image error, continue and create the draft post without an image.
5. Create the draft `blog_posts` row before updating the job with `postId`.

The main architectural decision is library choice for Gemini. This phase should use the official `@google/genai` SDK instead of stretching the existing OpenAI-compatible Gemini wrapper in `server/lib/gemini.ts`.

Why:

- the blog pipeline needs both structured text generation and image generation in one provider surface
- the official SDK supports direct API-key injection and current Gemini 2.x features without depending on OpenAI-compat gaps
- the blog generator is server-only and isolated, so adding one focused dependency is lower risk than changing the existing chat integration path

The existing `server/lib/gemini.ts` helper should stay untouched for chat integrations. Phase 22 should add a blog-specific helper rather than changing working runtime behavior elsewhere.

---

## Project Constraints

| Constraint | Directive |
|------------|-----------|
| Existing blog CRUD stays stable | Reuse `storage.createBlogPost()` and `server/routes/blog.ts`; do not alter current blog endpoints in Phase 22 |
| Global concurrency must work on serverless | Use the database row lock field, not a process-local mutex |
| Image generation is optional | Treat all image failures as recoverable and continue to draft creation |
| Manual runs differ from automatic runs | `manual: true` bypasses `enabled`, `postsPerDay`, and cadence checks but still requires settings row + lock |
| Additive implementation | New files/helpers are preferred over changing working Gemini chat code |

---

## Standard Stack

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | current npm release added in this phase | Official Gemini text + image generation | Best fit for a dedicated Gemini pipeline with explicit key control |
| `drizzle-orm` | existing | Guarded lock query plus blog-settings finalization | Existing database layer |
| `@supabase/supabase-js` | existing | Upload generated image and publish public URL | Existing storage layer |
| `tsx` | existing | Execute lightweight assertion scripts for verification | No test runner exists in the project |

No other new dependency is needed.

---

## Architecture Patterns

### Recommended Files

```
server/lib/
|- blog-gemini.ts                # NEW - Gemini client + key resolution for blog automation
|- blog-generator.ts             # NEW - BlogGenerator service and helpers
\- __tests__/blog-generator.test.ts  # NEW - executable assertion script

package.json                     # EDIT - add @google/genai
.env.example                     # EDIT - document BLOG_GEMINI_API_KEY fallback option
```

### Pattern 1: Blog-specific Gemini helper

Create `server/lib/blog-gemini.ts` with:

- `resolveBlogGeminiApiKey()`
- `getBlogGeminiClient()`
- `BLOG_CONTENT_MODEL = "gemini-1.5-flash"`
- `BLOG_IMAGE_MODEL = "gemini-2.0-flash-exp"`

Key order must be:

1. `process.env.BLOG_GEMINI_API_KEY`
2. `process.env.GEMINI_API_KEY`
3. `process.env.GOOGLE_API_KEY`

If none exist, throw a clear server-side error.

### Pattern 2: Preflight gate before lock

`BlogGenerator.generate({ manual: false })` should skip without throwing for:

- `no_settings`
- `disabled`
- `posts_per_day_zero`
- `too_soon`

`BlogGenerator.generate({ manual: true })` should still skip with `no_settings` if the singleton row does not exist, but it should bypass the `disabled`, `postsPerDay`, and cadence gates.

### Pattern 3: Guarded lock acquisition in SQL

Lock acquisition should be a single DB write against the singleton row, equivalent to:

```sql
UPDATE blog_settings
SET lock_acquired_at = NOW()
WHERE id = $1
  AND (
    lock_acquired_at IS NULL
    OR lock_acquired_at < NOW() - INTERVAL '10 minutes'
  )
RETURNING *;
```

If the update returns zero rows, return `{ skipped: true, reason: "locked" }`.

### Pattern 4: Job lifecycle ordering

When a run proceeds:

1. acquire lock
2. create job row with `status: "running"`
3. generate topic and blog content
4. try image generation/upload (recoverable)
5. create draft blog post
6. update job with `status: "completed"`, `postId`, `completedAt`
7. update `blog_settings.lastRunAt`
8. clear `lockAcquiredAt`

On failure after job creation:

1. update job to `failed` with `error` + `completedAt`
2. clear `lockAcquiredAt`
3. do not touch `lastRunAt`
4. rethrow

### Pattern 5: Draft post creation

Use the existing `storage.createBlogPost()` contract and create the draft with these exact fields:

- `status: "draft"`
- `authorName: "AI Assistant"`
- `title`, `content`, `excerpt`, `metaDescription`, `focusKeyword`
- `tags` serialized as a comma-separated string
- `featureImageUrl` from Supabase upload or `null`
- `slug` generated from the title plus a timestamp suffix for uniqueness

Recommended slug helper:

```ts
title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "") || "blog-post"
```

then append `-${Date.now()}`.

### Pattern 6: Best-effort image generation

Image generation should never fail the whole run. If Gemini image output is missing, malformed, quota-blocked, or upload fails, log a warning and continue with:

```ts
featureImageUrl = null
```

The job should still finish as `completed` if the post is created successfully.

---

## Option Analysis

### Option A - Reuse `openai` SDK with Gemini-compatible base URL

Pros:
- already installed
- matches current chat integration pattern

Cons:
- the project would be betting on OpenAI-compat behavior for both structured JSON and image generation
- higher risk of implementation drift between chat and blog use cases
- less clear support for Gemini-specific image output handling

### Option B - Add `@google/genai` for the blog pipeline only

Pros:
- official Gemini SDK surface for both text and image generation
- direct control over key resolution and model selection
- isolates blog automation from the existing chat provider code path

Cons:
- adds one new production dependency

### Recommendation

Choose Option B. The generator is a focused server-side subsystem with different requirements from the chat UI, and the official Gemini SDK reduces ambiguity around image generation.

---

## Anti-Patterns To Avoid

- Do not route blog generation through `getActiveAIClient()`; blog automation is Gemini-only in v1.5.
- Do not auto-create a `blog_settings` row inside `BlogGenerator.generate()`; `no_settings` must remain observable.
- Do not hold the lock in memory; multiple workers can race.
- Do not update `blog_generation_jobs.postId` before `storage.createBlogPost()` succeeds.
- Do not fail the entire job when image generation or image upload fails.
- Do not update `lastRunAt` on failed runs.

---

## Common Pitfalls

### Pitfall 1: Treating `postsPerDay = 0` as enabled scheduling

Automatic generation should skip with a dedicated reason instead of dividing by zero or generating anyway.

### Pitfall 2: Forgetting stale-lock recovery

Without the 10-minute stale window, a crashed run can permanently block the feature.

### Pitfall 3: Updating the job before the post exists

That would violate BLOG-11 and leave orphaned `postId` assumptions in later phases.

### Pitfall 4: Overwriting `lastRunAt` on failure

That would incorrectly throttle retries after a broken generation run.

### Pitfall 5: Letting the new Gemini helper replace the existing chat helper

Phase 22 should be additive. The chat integration path already works and should not be refactored during generator planning.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`tsc`) + executable `tsx` assertion script |
| Config file | `tsconfig.json` |
| Quick run command | `npm run check` |
| Full suite command | `npm run check && npx tsx server/lib/__tests__/blog-generator.test.ts` |
| Estimated runtime | ~25 seconds |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BLOG-05 | `BlogGenerator.generate()` returns structured skip/success metadata | executable assertions | `npx tsx server/lib/__tests__/blog-generator.test.ts` | Wave 1 |
| BLOG-06 | automatic preflight returns skip reasons without throwing | executable assertions | `npx tsx server/lib/__tests__/blog-generator.test.ts` | Wave 1 |
| BLOG-07 | concurrent/stale lock behavior allows only one run | executable assertions | `npx tsx server/lib/__tests__/blog-generator.test.ts` | Wave 1 |
| BLOG-08 | topic + content generation path resolves Gemini keys and parses structured JSON | compiler plus mocked assertions | `npm run check && npx tsx server/lib/__tests__/blog-generator.test.ts` | Wave 2 |
| BLOG-09 | image failure still completes post creation | executable assertions | `npx tsx server/lib/__tests__/blog-generator.test.ts` | Wave 2 |
| BLOG-10 | upload path targets `images/blog-images/` and returns public URL | executable assertions | `npx tsx server/lib/__tests__/blog-generator.test.ts` | Wave 2 |
| BLOG-11 | draft post is created before job gets `postId` | executable assertions | `npx tsx server/lib/__tests__/blog-generator.test.ts` | Wave 2 |
| BLOG-12 | success updates `lastRunAt`; failure clears lock without updating `lastRunAt` | executable assertions | `npx tsx server/lib/__tests__/blog-generator.test.ts` | Wave 2 |

### Sampling Rate

- Per task: `npm run check`
- After each plan: `npm run check && npx tsx server/lib/__tests__/blog-generator.test.ts`
- Before `/gsd-verify-work`: run the full suite and a live manual generation smoke test if Gemini/Supabase credentials are available

### Wave 0 Requirements

Existing infrastructure is enough. Phase 22 only needs a new executable assertion script.

---

## Sources

- `.planning/ROADMAP.md` - Phase 22 goal and success criteria
- `.planning/REQUIREMENTS.md` - BLOG-05 through BLOG-12
- `.planning/STATE.md` - Phase 21 decisions and active milestone state
- `.planning/phases/21-schema-storage-foundation/21-RESEARCH.md` - blog settings/job schema contract and storage decisions
- `.planning/phases/21-schema-storage-foundation/21-01-SUMMARY.md` - implemented storage surface for blog settings and jobs
- `shared/schema/blog.ts` - current blog settings and job table definitions
- `shared/schema/cms.ts` - existing `blog_posts` table and insert contract
- `server/storage.ts` - existing blog post CRUD plus blog settings/job methods
- `server/lib/supabase.ts` - server-side Supabase admin client
- `server/storage/supabaseStorage.ts` - established public upload/public URL pattern
- `server/lib/gemini.ts` - current Gemini integration boundary for chat (kept unchanged)
- `https://raw.githubusercontent.com/googleapis/js-genai/main/README.md` - official Gemini SDK capabilities and env-var support

---

## Metadata

**Confidence breakdown:**
- lock/job orchestration: HIGH
- draft blog post persistence: HIGH
- Gemini SDK integration choice: MEDIUM
- live image generation response handling: MEDIUM

**Research date:** 2026-04-22
**Valid until:** 2026-05-22
