---
phase: 36-generator-quality-overhaul
verified: 2026-05-04T00:00:00Z
status: passed
score: 6/6 must-haves verified
---

# Phase 36: Generator Quality Overhaul Verification Report

**Phase Goal:** Generated posts are reliably Brazilian Portuguese, valid HTML only, well-formed slugs, length-bounded, and resilient to slow/flaky Gemini responses.
**Verified:** 2026-05-04
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Requirement-Level)

| #   | Truth (Requirement)                                                                  | Status     | Evidence                                                                                                                |
| --- | ------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | BLOG2-01: Prompts are pt-BR with RSS context + allowed-tags-only formatting rules    | VERIFIED   | `BRAND_VOICE_PT_BR` (lines 36-40) and `FORMATTING_RULES_PT_BR` (lines 41-48) are verbatim D-11/D-12; both prompts inject `rssItem.title` + `rssItem.summary` (line 310 + 330) |
| 2   | BLOG2-02: HTML sanitizer strips disallowed tags before persistence                   | VERIFIED   | `sanitizeBlogHtml(generatedPost.content)` runs in `runPipeline` before `createBlogPost` (line 432); `invalid_html` thrown when sanitization drops content below 600 chars (line 437) |
| 3   | BLOG2-03: Slug normalization uses NFD + diacritic removal                            | VERIFIED   | `slugifyTitle` in `blogContentValidator.ts` uses `.normalize("NFD")` (line 101); imported as `slugifyTitleNFD` and used in `buildSlug` (line 212); local helper REMOVED |
| 4   | BLOG2-04: Content length validated 600..4000 (post-sanitize plain text)              | VERIFIED   | `MIN_PLAIN_TEXT_CHARS=600` + `MAX_PLAIN_TEXT_CHARS=4000` (lines 49-50); `getPlainTextLength(sanitizedContent)` measured (line 433); both bounds throw `content_length_out_of_bounds` |
| 5   | BLOG2-05: AbortController timeout + empty-candidates check                            | VERIFIED   | `withGeminiTimeout` helper (lines 247-264) wraps all 3 Gemini call sites (topic, post, image); empty-candidates throws `GeminiEmptyResponseError` in both `getGeminiText` and `generateImageWithGemini`; catch block maps both to `gemini_timeout` / `gemini_empty_response` (lines 564-567) |
| 6   | BLOG2-06: Env-overridable Gemini models + timeout                                    | VERIFIED   | `blog-gemini.ts` exports `BLOG_CONTENT_MODEL` (default `gemini-2.5-flash`), `BLOG_IMAGE_MODEL` (default `gemini-2.0-flash-exp`), and `BLOG_GEMINI_TIMEOUT_MS` (default 30000); `.env.example` documents all 3 (lines 33-41); no hardcoded model strings remain in blog-generator.ts |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact                                  | Expected                                                            | Status     | Details                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `server/lib/blogContentValidator.ts`      | sanitizeBlogHtml + getPlainTextLength + slugifyTitle + 2 error classes | VERIFIED   | 124 lines (target ≤140); 6 exports present; pure module, only `sanitize-html` import |
| `server/lib/blog-gemini.ts`               | env-overridable BLOG_CONTENT_MODEL/BLOG_IMAGE_MODEL/BLOG_GEMINI_TIMEOUT_MS | VERIFIED   | 53 lines (target ≤60); all 3 read-once at top-level via `process.env.X \|\| default` |
| `server/lib/blog-generator.ts`            | Wave-1 modules wired into pipeline                                  | VERIFIED   | 598 lines (HARD CAP 600); imports both Wave-1 modules; sanitize/length/timeout/error-mapping all wired |
| `.env.example`                            | Documents 3 new env vars                                            | VERIFIED   | `BLOG_CONTENT_MODEL=gemini-2.5-flash`, `BLOG_IMAGE_MODEL=gemini-2.0-flash-exp`, `BLOG_GEMINI_TIMEOUT_MS=30000` present under Phase 36 section |
| `package.json` — `sanitize-html`          | Runtime dependency installed                                        | VERIFIED   | `"sanitize-html": "^2.17.3"` in dependencies; `@types/sanitize-html: "^2.16.1"` in devDependencies |

### Key Link Verification

| From                                       | To                                                            | Via                                       | Status | Details                                                                              |
| ------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| `blog-generator.ts`                        | `blogContentValidator.ts` (5 named imports)                    | `import { ... } from "./blogContentValidator.js"` | WIRED  | Line 24-30: `GeminiEmptyResponseError, GeminiTimeoutError, getPlainTextLength, sanitizeBlogHtml, slugifyTitle as slugifyTitleNFD` |
| `blog-generator.ts`                        | `blog-gemini.ts` (BLOG_GEMINI_TIMEOUT_MS)                      | extended import block                     | WIRED  | Line 16-22: includes `BLOG_GEMINI_TIMEOUT_MS` alongside existing model constants    |
| `blog-gemini.ts`                           | `process.env.BLOG_*`                                           | top-level const reads with `\|\|` fallback | WIRED  | Lines 13-26 — all 3 read once at module load                                         |
| `BlogGenerator.generate()` catch block     | `blog_generation_jobs.reason`                                  | `updateBlogGenerationJob({ status, reason })` | WIRED  | Lines 564-577: maps `GeminiTimeoutError → 'gemini_timeout'`, `GeminiEmptyResponseError → 'gemini_empty_response'`, `'invalid_html'` and `'content_length_out_of_bounds'` strings |
| `runPipeline` (post-generation)            | `createBlogPost` (sanitized content + NFD slug)                | `sanitizeBlogHtml(generatedPost.content)` | WIRED  | Line 432: sanitize → length-validate → mutate `generatedPost.content` → flow into `postInput.content` (line 463) |
| `withGeminiTimeout` helper                 | All 3 Gemini call sites                                       | `withGeminiTimeout(label, () => ...)`     | WIRED  | Topic (line 311), post (line 331), image (line 346) — 3 call sites + 1 helper definition (4 occurrences total) |

### Data-Flow Trace (Level 4)

| Artifact                              | Data Variable     | Source                                  | Produces Real Data | Status   |
| ------------------------------------- | ----------------- | --------------------------------------- | ------------------ | -------- |
| `runPipeline` → `createBlogPost`      | `postInput.content` | `generatedPost.content = sanitizedContent` (line 443) flowed from Gemini → sanitizer | YES — sanitized HTML from real Gemini output | FLOWING  |
| `runPipeline` → `buildSlug`           | `baseSlug`        | `slugifyTitleNFD(title)` (line 212) — NFD-normalized | YES — derived from generated title | FLOWING  |
| `BlogGenerator.generate` catch        | `reason`          | Typed-error matching on thrown errors   | YES — values flow to DB column | FLOWING  |
| `withGeminiTimeout` → `setTimeout`    | `BLOG_GEMINI_TIMEOUT_MS` | env-or-default at module load    | YES — defensive parsing | FLOWING  |

Note: Backend pipeline only — no UI artifacts to trace. End-to-end data flow confirmed by reading the function body of `runPipeline` (lines 414-503) which reads sanitized content into the InsertBlogPost payload.

### Behavioral Spot-Checks

| Behavior                                            | Command                                            | Result                  | Status |
| --------------------------------------------------- | -------------------------------------------------- | ----------------------- | ------ |
| TypeScript compiles cleanly                         | `npm run check`                                    | exit 0, no errors       | PASS   |
| `sanitize-html` package resolves                    | `node -e "require('sanitize-html')"`               | "OK" printed            | PASS   |
| `blog-generator.ts` ≤ 600 line cap (CLAUDE.md)      | `wc -l server/lib/blog-generator.ts`               | 598 lines               | PASS   |
| `blog-gemini.ts` ≤ 60 lines (plan budget)           | `wc -l server/lib/blog-gemini.ts`                  | 53 lines                | PASS   |
| `blogContentValidator.ts` ≤ 140 lines (plan budget) | `wc -l server/lib/blogContentValidator.ts`         | 124 lines               | PASS   |
| Local `slugifyTitle` removed                        | `grep -E "^function slugifyTitle\(" blog-generator.ts` | 0 matches            | PASS   |
| 3 timeout-wrapped Gemini call sites                 | `grep -c "withGeminiTimeout(" blog-generator.ts`   | 4 (1 def + 3 calls)     | PASS   |
| `GeminiEmptyResponseError` referenced ≥4 times      | `grep -c GeminiEmptyResponseError blog-generator.ts` | 4 (import + getGeminiText + image + catch) | PASS   |
| `GeminiTimeoutError` referenced ≥3 times            | `grep -c GeminiTimeoutError blog-generator.ts`     | 3 (import + helper + catch) | PASS   |
| `REGRAS DE FORMATAÇÃO` constant exists              | `grep -c "REGRAS DE FORMATAÇÃO" blog-generator.ts` | 1                       | PASS   |

### Requirements Coverage

| Requirement | Source Plan | Description                                                    | Status    | Evidence                                                                          |
| ----------- | ----------- | -------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| BLOG2-01    | 36-03       | pt-BR prompts + RSS context + allowed-tags instructions        | SATISFIED | `BRAND_VOICE_PT_BR` + RSS title/summary in both prompts; `FORMATTING_RULES_PT_BR` in post prompt with 10-tag allowlist |
| BLOG2-02    | 36-01, 36-03 | HTML sanitizer with strict allowlist                          | SATISFIED | `sanitize-html` config in `blogContentValidator.ts` with 10-tag allowlist + `<a>` transform; called in `runPipeline` before `createBlogPost`; `invalid_html` reason in catch |
| BLOG2-03    | 36-01, 36-03 | NFD slug normalization                                        | SATISFIED | `slugifyTitle` uses `.normalize("NFD")` + diacritic strip; `buildSlug` consumes the imported helper; no inline slug logic remains |
| BLOG2-04    | 36-03       | Content length 600..4000 plain text                           | SATISFIED | Constants defined; `getPlainTextLength(sanitizedContent)` measured post-sanitize; `content_length_out_of_bounds` thrown for both bounds |
| BLOG2-05    | 36-01, 36-03 | AbortController timeout + empty-candidates                    | SATISFIED | `withGeminiTimeout` wraps 3 call sites; both error classes exported + caught; reasons mapped in catch block |
| BLOG2-06    | 36-02       | Env-overridable models                                         | SATISFIED | 3 constants exported from `blog-gemini.ts` with documented fallbacks; `.env.example` documents all 3; no hardcoded model strings in `blog-generator.ts` |

REQUIREMENTS.md status table confirms all 6 marked **Complete** (BLOG2-01..06) and checkboxes `[x]`. No orphaned requirements for Phase 36.

### Anti-Patterns Found

| File                                       | Line | Pattern         | Severity | Impact |
| ------------------------------------------ | ---- | --------------- | -------- | ------ |
| (none)                                     | —    | —               | —        | —      |

No TODO/FIXME/placeholder comments, empty implementations, or hardcoded stub data found in modified files. Phase 35 contract preserved (`no_rss_items`, `selectNextRssItem`, `markRssItemUsed` placement intact).

### Decision Adherence (D-01..D-16 spot-check)

| Decision | Adherence | Evidence |
| -------- | --------- | -------- |
| D-01 (sanitize-html as canonical sanitizer) | YES | Sole sanitizer dependency; no dompurify/xss alternates installed |
| D-02 (10-tag allowlist) | YES | `ALLOWED_BLOG_TAGS` in blogContentValidator.ts has exactly 10 tags |
| D-03 (`<a>` policy: href only + http(s) only) | YES | `allowedSchemes: ["http","https"]`, `transformTags.a` forces rel/target |
| D-04 (NFD slug 80-char cap) | YES | `.normalize("NFD")` + `.slice(0,80)` + re-trim |
| D-05/D-06 (length bounds 600..4000 + invalid_html branch) | YES | Implemented in `runPipeline` lines 432-443 with double-check distinguishing `invalid_html` vs `content_length_out_of_bounds` |
| D-07 (BLOG_GEMINI_TIMEOUT_MS, defensive parse with `\|\|`) | YES | `Number(process.env.BLOG_GEMINI_TIMEOUT_MS) \|\| 30_000` (uses `\|\|`, not `??`) |
| D-08 (typed empty-candidates error) | YES | `GeminiEmptyResponseError` thrown from `getGeminiText` (line 393) and image path (line 354) |
| D-09 (env-overridable models, fallback `gemini-2.5-flash` / `gemini-2.0-flash-exp`) | YES | Defaults match D-09 verbatim |
| D-10 (RSS context injected into prompts) | YES | Both prompts include `rssItem.title` + `rssItem.summary`; post prompt also `rssItem.url` |
| D-11 (brand voice verbatim) | YES | All 3 lines match D-11 character-for-character |
| D-12 (REGRAS DE FORMATAÇÃO verbatim) | YES | All 6 bullets match D-12 character-for-character |
| D-13 (failure reason taxonomy mapped at app layer) | YES | Catch block maps 4 reasons; no DB migration needed |
| D-14 (typed errors live in blogContentValidator.ts) | YES | Both classes exported from validator module |
| D-15 (SANITIZE_OPTS at module top, single source) | YES | Defined once at lines 33-54 of blogContentValidator.ts |

### Human Verification Required

None. Phase 36 has no UI surface — it is a backend generator quality overhaul. All checks are programmatically verifiable:
- Sanitization, length validation, slug normalization, and error mapping verified via static reads of the pipeline.
- Behavioral validation of the timeout and empty-candidates paths can only be observed in production logs / next blog cron run; this is acceptable per phase scope and will surface in Phase 38 (Cron & Observability) admin UI.

### Gaps Summary

No gaps found. All 6 must-haves verified. Plan adherence is high — every grep pattern, line-count constraint, and key link from all three plans matches the implementation. Phase 35 contract preserved without regression. `npm run check` passes with zero new errors. File-size cap (CLAUDE.md ≤ 600 lines) honored at 598 lines.

Notable implementation notes:
- `blogContentValidator.ts` includes `rel` and `target` in `allowedAttributes.a` (lines 40) — necessary because sanitize-html applies `allowedAttributes` AFTER `transformTags` in newer versions; this is a correct adaptation, not a deviation. Plan 36-01 spec said `["href"]` only, but the actual implementation correctly handles the post-transform filtering. Net effect on output is identical (rel/target are forced by transformTags either way).
- The plan-spec file count budget (≤140 lines for validator, ≤60 for blog-gemini, ≤600 for blog-generator) all met with healthy headroom.

---

_Verified: 2026-05-04_
_Verifier: Claude (gsd-verifier)_
