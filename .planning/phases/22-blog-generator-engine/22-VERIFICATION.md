---
phase: 22-blog-generator-engine
verified: 2026-04-22T15:55:34Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "Run a live manual generation with valid Gemini credentials"
    expected: "`BlogGenerator.generate({ manual: true })` creates a real draft post after calling Gemini with blog-specific key fallback"
    why_human: "Requires external Gemini credentials, quota, and a real database"
  - test: "Verify feature image upload in Supabase storage"
    expected: "A successful run uploads to `images/blog-images/{timestamp}-{uuid}.jpg` and stores a public URL on the post"
    why_human: "Requires real Gemini image output plus Supabase storage access"
  - test: "Inspect real database finalization after success and failure"
    expected: "Successful runs update `blog_settings.lastRunAt` and clear `lockAcquiredAt`; failed runs clear the lock without changing `lastRunAt`"
    why_human: "Needs live DB state inspection after real executions"
---

# Phase 22: Blog Generator Engine Verification Report

**Phase Goal:** `BlogGenerator.generate()` runs the full Gemini pipeline — validates settings, acquires a global DB lock, generates content + image, uploads to Supabase, creates a draft blog post, and clears the lock.
**Verified:** 2026-04-22T15:55:34Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Calling `BlogGenerator.generate({ manual: false })` with no `blog_settings` row returns `{ skipped: true, reason: "no_settings" }` without throwing. | ✓ VERIFIED | Guard returns early in `server/lib/blog-generator.ts:430`; executable assertion covers it in `server/lib/__tests__/blog-generator.test.ts:383`; spot-check passed via `npx tsx server/lib/__tests__/blog-generator.test.ts`. |
| 2 | Calling it with `enabled: false` returns `{ skipped: true, reason: "disabled" }`. | ✓ VERIFIED | Disabled gate exists in `server/lib/blog-generator.ts:434`; assertion covers it in `server/lib/__tests__/blog-generator.test.ts:384`. |
| 3 | Two concurrent calls race for the DB lock — exactly one proceeds, the other returns `{ skipped: true, reason: "locked" }`. | ✓ VERIFIED | Guarded stale-lock update exists in `server/lib/blog-generator.ts:151`; lock failure returns `locked` in `server/lib/blog-generator.ts:446`; executable assertion covers lock contention in `server/lib/__tests__/blog-generator.test.ts:405`. |
| 4 | A successful run creates a `blog_posts` row with `status: "draft"`, `authorName: "AI Assistant"`, non-null `title`, `content`, `slug` — and updates `blog_generation_jobs` with the real `postId` and `status: "completed"`. | ✓ VERIFIED | Pipeline creates post before completing job in `server/lib/blog-generator.ts:387`, `server/lib/blog-generator.ts:400`, `server/lib/blog-generator.ts:402`; assertions verify metadata and ordering in `server/lib/__tests__/blog-generator.test.ts:235`. |
| 5 | If Gemini image generation fails, the post is still created with `featureImageUrl: null` and the job completes. | ✓ VERIFIED | Image failures degrade to warning + `null` in `server/lib/blog-generator.ts:374`; executable fallback assertion in `server/lib/__tests__/blog-generator.test.ts:291`. |
| 6 | `blog_settings.lastRunAt` is updated after success; `lockAcquiredAt` is cleared whether or not generation succeeded. | ✓ VERIFIED | Success finalization at `server/lib/blog-generator.ts:410`; failure finalization at `server/lib/blog-generator.ts:474`; assertions in `server/lib/__tests__/blog-generator.test.ts:266` and `server/lib/__tests__/blog-generator.test.ts:375`. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `server/lib/blog-gemini.ts` | Blog-specific Gemini client + key fallback | ✓ VERIFIED | Exports required constants/helpers and resolves env vars in fallback order at `server/lib/blog-gemini.ts:3` and `server/lib/blog-gemini.ts:8`. |
| `server/lib/blog-generator.ts` | Full generator orchestration and pipeline | ✓ VERIFIED | Contains skip gates, DB lock, Gemini topic/content/image flow, post creation, job finalization, and settings updates across `server/lib/blog-generator.ts:151`, `server/lib/blog-generator.ts:257`, `server/lib/blog-generator.ts:365`, and `server/lib/blog-generator.ts:424`. |
| `server/lib/__tests__/blog-generator.test.ts` | Executable contract for skip/success/fallback/failure | ✓ VERIFIED | Covers skip reasons, manual bypass, success ordering, image fallback, and failure cleanup across `server/lib/__tests__/blog-generator.test.ts:104` and `server/lib/__tests__/blog-generator.test.ts:175`. |
| `package.json` | Gemini SDK dependency present | ✓ VERIFIED | `@google/genai` is declared in `package.json:27`. |
| `.env.example` | Blog Gemini env var documented | ✓ VERIFIED | `BLOG_GEMINI_API_KEY` documented in `.env.example:27`. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `server/lib/blog-generator.ts` | `shared/schema/blog.ts` | lock query and job semantics | ✓ WIRED | Uses `blogSettings` schema and `lockAcquiredAt` stale-lock logic in `server/lib/blog-generator.ts:12` and `server/lib/blog-generator.ts:151`. |
| `server/lib/blog-generator.ts` | `server/storage.ts` | settings, job, and post persistence | ✓ WIRED | Calls storage methods exposed in `server/storage.ts:1766` and `server/storage.ts:1790`; used from `server/lib/blog-generator.ts:428`, `server/lib/blog-generator.ts:451`, `server/lib/blog-generator.ts:400`, `server/lib/blog-generator.ts:402`, and `server/lib/blog-generator.ts:410`. |
| `server/lib/blog-generator.ts` | `server/lib/blog-gemini.ts` | provider helper import | ✓ WIRED | Imports models/client helpers at `server/lib/blog-generator.ts:16` and uses them in Gemini generation helpers at `server/lib/blog-generator.ts:257`, `server/lib/blog-generator.ts:279`, and `server/lib/blog-generator.ts:298`. |
| `server/lib/blog-generator.ts` | `server/lib/supabase.ts` | image upload to public storage | ✓ WIRED | Uses `getSupabaseAdmin()` in `server/lib/blog-generator.ts:15` and uploads to bucket/path in `server/lib/blog-generator.ts:326`. |
| `server/lib/blog-generator.ts` | `shared/schema/cms.ts` | draft blog post creation | ✓ WIRED | Import is indirect through barrel export `shared/schema.ts:3`; `InsertBlogPost` is consumed in `server/lib/blog-generator.ts:5` and persisted with draft metadata in `server/lib/blog-generator.ts:387`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `server/lib/blog-generator.ts` | `topic` | `generateTopicWithGemini()` -> Gemini text response in `server/lib/blog-generator.ts:257` | Yes in code path; live API still needs manual confirmation | ✓ FLOWING |
| `server/lib/blog-generator.ts` | `generatedPost` | `generatePostWithGemini()` -> parsed JSON in `server/lib/blog-generator.ts:279` and `server/lib/blog-generator.ts:224` | Yes in code path; schema validation blocks hollow payloads | ✓ FLOWING |
| `server/lib/blog-generator.ts` | `featureImageUrl` | `generateImageWithGemini()` + `uploadFeatureImage()` in `server/lib/blog-generator.ts:298` and `server/lib/blog-generator.ts:326` | Yes, with explicit null fallback on failure | ✓ FLOWING |
| `server/lib/blog-generator.ts` | `post` / `postId` | `storage.createBlogPost()` before `updateBlogGenerationJob()` in `server/lib/blog-generator.ts:400` and `server/lib/blog-generator.ts:402` | Yes; executable test verifies ordering and returned `postId` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| TypeScript contract compiles | `npm run check` | `tsc` completed successfully | ✓ PASS |
| Executable generator contract passes | `npx tsx server/lib/__tests__/blog-generator.test.ts` | Printed `PASS: BlogGenerator success, fallback, and finalization behavior matches the phase contract` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `BLOG-05` | `22-01-PLAN.md`, `22-02-PLAN.md` | `BlogGenerator.generate()` encapsulates the full pipeline and returns skip/success metadata. | ✓ SATISFIED | Public API at `server/lib/blog-generator.ts:424`; success result returned at `server/lib/blog-generator.ts:459`. |
| `BLOG-06` | `22-01-PLAN.md` | Automatic runs skip cleanly for missing/disabled/zero-cadence/too-soon settings. | ✓ SATISFIED | Gates at `server/lib/blog-generator.ts:430` through `server/lib/blog-generator.ts:442`; covered in `server/lib/__tests__/blog-generator.test.ts:383`. |
| `BLOG-07` | `22-01-PLAN.md` | Global stale lock allows only one runner and clears on completion/error. | ✓ SATISFIED | Guarded update at `server/lib/blog-generator.ts:151`; lock cleared in success/failure finalizers at `server/lib/blog-generator.ts:410` and `server/lib/blog-generator.ts:474`. |
| `BLOG-08` | `22-02-PLAN.md` | Gemini generates topic and structured post JSON using the blog key fallback and `gemini-1.5-flash`. | ✓ SATISFIED | Key resolution in `server/lib/blog-gemini.ts:8`; topic/post generation in `server/lib/blog-generator.ts:257` and `server/lib/blog-generator.ts:279`. |
| `BLOG-09` | `22-02-PLAN.md` | Image generation failure is non-blocking and falls back to `featureImageUrl: null`. | ✓ SATISFIED | Fallback logic in `server/lib/blog-generator.ts:374`; assertion in `server/lib/__tests__/blog-generator.test.ts:322`. |
| `BLOG-10` | `22-02-PLAN.md` | Generated image uploads to Supabase `images/blog-images/...` and stores a public URL. | ✓ SATISFIED | Supabase upload path and public URL retrieval in `server/lib/blog-generator.ts:326`; live service still needs human confirmation. |
| `BLOG-11` | `22-02-PLAN.md` | Draft post is created before the job receives its real `postId`. | ✓ SATISFIED | Ordering in `server/lib/blog-generator.ts:400` before `server/lib/blog-generator.ts:402`; asserted in `server/lib/__tests__/blog-generator.test.ts:271`. |
| `BLOG-12` | `22-02-PLAN.md` | Success updates `lastRunAt`; failure preserves it while always clearing the lock. | ✓ SATISFIED | Success/failure settings updates in `server/lib/blog-generator.ts:410` and `server/lib/blog-generator.ts:474`; asserted in `server/lib/__tests__/blog-generator.test.ts:266` and `server/lib/__tests__/blog-generator.test.ts:375`. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `server/lib/blog-generator.ts` | `323` | `return null` in image helper | ℹ️ Info | Intentional fallback path; surrounding code continues with draft creation and is covered by executable assertions. |

### Human Verification Required

### 1. Live Gemini Manual Run

**Test:** Configure valid `BLOG_GEMINI_API_KEY` or fallback Gemini credentials, then invoke `BlogGenerator.generate({ manual: true })` against a real database.
**Expected:** A draft post is created from live Gemini topic/content responses and the returned result includes `jobId`, `postId`, and `post`.
**Why human:** Requires external Gemini credentials, quota, and real persistence.

### 2. Supabase Image Upload

**Test:** Run a successful live generation and inspect Supabase storage plus the created post record.
**Expected:** If image bytes are produced, the upload lands under `images/blog-images/{timestamp}-{uuid}.jpg` and the post stores the public URL; if not, the post still completes with `featureImageUrl: null`.
**Why human:** Depends on real Gemini image output and Supabase service behavior.

### 3. Real DB Finalization Semantics

**Test:** Inspect `blog_settings` and the latest `blog_generation_jobs` row after one successful run and one forced failure.
**Expected:** Success sets `lastRunAt` and clears `lockAcquiredAt`; failure clears `lockAcquiredAt` without changing the previous `lastRunAt`.
**Why human:** Requires observing real database state changes after live execution.

---

_Verified: 2026-04-22T15:55:34Z_
_Verifier: the agent (gsd-verifier)_
