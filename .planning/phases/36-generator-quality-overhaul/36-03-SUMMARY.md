---
phase: 36-generator-quality-overhaul
plan: 03
subsystem: blog-automation
tags: [blog-generator, sanitize-html, gemini-timeout, pt-br-prompts, abort-controller, integration]

# Dependency graph
requires:
  - phase: 36-generator-quality-overhaul
    plan: 01
    provides: blogContentValidator.ts (sanitizeBlogHtml, getPlainTextLength, slugifyTitle, GeminiTimeoutError, GeminiEmptyResponseError)
  - phase: 36-generator-quality-overhaul
    plan: 02
    provides: BLOG_GEMINI_TIMEOUT_MS env-overridable timeout exported from blog-gemini.ts
provides:
  - production-grade BlogGenerator with pt-BR prompts (D-11 brand voice + D-12 REGRAS)
  - AbortController timeout wrapping on every Gemini call site (topic, post, image)
  - HTML sanitization + plain-text length gate (600..4000) before createBlogPost
  - 4 new failure reasons in blog_generation_jobs.reason: invalid_html, content_length_out_of_bounds, gemini_timeout, gemini_empty_response
  - NFD-normalized slugs via slugifyTitleNFD (replaces inline regex)
affects: [37-admin-blog-job-history, 38-cron-observability, BLOG2-01, BLOG2-02, BLOG2-03, BLOG2-04, BLOG2-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.race against setTimeout for AbortController-style timeouts on SDKs without native AbortSignal support"
    - "String-message matching for thrown Error('reason_code') from helper functions to map onto reason taxonomy at the orchestrator catch block (avoids new error classes for app-internal flow)"
    - "Module-level prompt constants (BRAND_VOICE_PT_BR, FORMATTING_RULES_PT_BR) joined into prompts via template literals — keeps verbatim D-11/D-12 blocks in one place"

key-files:
  created: []
  modified:
    - server/lib/blog-generator.ts (568 → 598 lines; net +30; +90 logic, -60 via slug helper extract + comment trims + defaultStorage shorthand)

key-decisions:
  - "D-05 implemented: plain-text length validated AFTER sanitization on bounds [MIN_PLAIN_TEXT_CHARS=600, MAX_PLAIN_TEXT_CHARS=4000]"
  - "D-06 implemented: failure classification — sanitized < 600 with original >= 600 -> 'invalid_html'; otherwise out-of-bounds -> 'content_length_out_of_bounds'; D-08 typed errors flow through unchanged"
  - "D-07 implemented: withGeminiTimeout(label, run) helper wraps every Gemini call in Promise.race against setTimeout-driven GeminiTimeoutError; AbortController forward-compatible (no-op today on @google/genai 1.50.x)"
  - "D-08 implemented: getGeminiText + generateImageWithGemini both throw GeminiEmptyResponseError on empty candidates (image errors swallowed by runPipeline's existing try/catch as non-fatal warnings — Phase 22 contract preserved)"
  - "D-10 implemented: single user-message prompt with brand voice block prepended (no system/user split needed for OpenAI-compat endpoint)"
  - "D-11 implemented: BRAND_VOICE_PT_BR module-level constant, verbatim 3-line pt-BR block, prepended to both text prompts"
  - "D-12 implemented: FORMATTING_RULES_PT_BR module-level constant, verbatim 6-line REGRAS block, appended only to post-generation prompt"
  - "D-13 implemented: 4 new reason values added at app layer (no DB migration) — invalid_html, content_length_out_of_bounds, gemini_timeout, gemini_empty_response"

patterns-established:
  - "Verbatim locked-text blocks (CONTEXT D-11/D-12) live as module constants and are referenced via template literals inside prompt builders — single source of truth + grep-friendly"
  - "Compact prompt builders use template literals (\\n-joined) instead of array.join('\\n') when line count is at risk — same output, fewer source lines"
  - "Method-shorthand (`name: async (args) => ...`) for IStorage proxy adapters when explicit `async name(args) { return ... }` form is too verbose to fit line caps"

requirements-completed: [BLOG2-01, BLOG2-02, BLOG2-03, BLOG2-04, BLOG2-05]

# Metrics
duration: ~7min
completed: 2026-05-05
---

# Phase 36 Plan 03: Generator Integration (Wave 2) Summary

**BlogGenerator now ships with pt-BR brand voice prompts, 30s AbortController timeout on every Gemini call, strict HTML sanitization with 600..4000 plain-text length gate, NFD-normalized slugs, and four new failure reasons mapped from typed errors — all delivered in one file under the 600-line CLAUDE.md cap.**

## Performance

- **Duration:** ~7 min (409 seconds wall clock)
- **Started:** 2026-05-05T03:21:53Z
- **Completed:** 2026-05-05T03:28:42Z
- **Tasks:** 3 (atomic commits)
- **Files modified:** 1 (`server/lib/blog-generator.ts`)
- **Net lines:** +30 (568 → 598; under 600 cap)

## Accomplishments

- **BLOG2-01 — pt-BR + RSS context + allowed-tag instructions delivered.** Both text prompts (topic + post) start with the verbatim D-11 `BRAND_VOICE_PT_BR` block and inject `rssItem.title` + `rssItem.summary` (post prompt also includes `rssItem.url`). Post prompt ends with the verbatim D-12 `FORMATTING_RULES_PT_BR` block listing the 10 allowed tags and 9 forbidden tags.
- **BLOG2-02 — HTML sanitization with failure on unsalvageable.** `sanitizeBlogHtml(generatedPost.content)` runs in `runPipeline` AFTER `generatePost` and BEFORE the image block + `createBlogPost`. Sanitized content overwrites `generatedPost.content` so the saved DB row contains the cleaned HTML. When sanitization drops plain-text below 600 chars and the original was >= 600, the throw `Error('invalid_html')` propagates up through the catch block and the job is marked failed with `reason: 'invalid_html'`.
- **BLOG2-03 — NFD slug normalization.** Inline `slugifyTitle` function deleted; `buildSlug` now calls the imported `slugifyTitleNFD` (alias for `slugifyTitle` from blogContentValidator.ts). The `|| 'blog-post'` fallback is preserved at the caller (validator's slugifyTitle returns `''` for empty input vs. the deleted local fn's `'blog-post'` baked-in default).
- **BLOG2-04 — length bounds enforced.** Plain-text length outside `[MIN_PLAIN_TEXT_CHARS, MAX_PLAIN_TEXT_CHARS]` (600, 4000) throws `Error('content_length_out_of_bounds')`, mapped to `reason: 'content_length_out_of_bounds'` in the catch block.
- **BLOG2-05 — AbortController + empty-candidates.** `withGeminiTimeout(label, run)` helper races every Gemini call against a `BLOG_GEMINI_TIMEOUT_MS` setTimeout that rejects with `GeminiTimeoutError`. Wrapped at all 3 call sites: topic generation, post generation, and image generation. `getGeminiText` + `generateImageWithGemini` both throw `GeminiEmptyResponseError` when `response.candidates` is empty.
- **Catch-block reason mapping.** `BlogGenerator.generate()` catch block now examines errors before calling `updateBlogGenerationJob`: `GeminiTimeoutError` → `'gemini_timeout'`, `GeminiEmptyResponseError` → `'gemini_empty_response'`, `Error.message === 'invalid_html'` → `'invalid_html'`, `Error.message === 'content_length_out_of_bounds'` → same. Lock-release + rethrow behavior preserved.
- **Phase 35 contract preserved byte-equivalent.** `selectNextRssItem` placement (before `acquireLock`), `no_rss_items` skip path, and `markRssItemUsed(rssItem.id, post.id)` after `createBlogPost` are all intact. `grep -c "no_rss_items"` returns 3 (unchanged from post-Phase-35 state plus skip-job creation).
- **File budget honored.** `server/lib/blog-generator.ts` finished at 598 lines — 2 lines under the CLAUDE.md 600-line cap. Hit 641 lines after raw Task 2 application; trimmed to 598 by converting prompt arrays to template literals (no behavioral change) + collapsing multi-line comments + applying method-shorthand to `defaultStorage`.
- **`npm run check` clean** at every commit.

## Task Commits

1. **Task 1: Add validator imports + pt-BR prompt constants + withGeminiTimeout helper** — `7bbbf28` (feat)
2. **Task 2: Rewire prompts (pt-BR + RSS context + REGRAS), wrap Gemini calls, swap slug helper** — `b2d973e` (feat)
3. **Task 3: Sanitize + length-validate post content; map typed errors to failure reasons** — `0582164` (feat)

## Files Created/Modified

- `server/lib/blog-generator.ts` (568 → 598 lines, +30 net) — full integration of Wave 1 outputs:
  - 5-name import block from `./blogContentValidator.js` added (`GeminiEmptyResponseError`, `GeminiTimeoutError`, `getPlainTextLength`, `sanitizeBlogHtml`, `slugifyTitle as slugifyTitleNFD`)
  - `BLOG_GEMINI_TIMEOUT_MS` added to existing `./blog-gemini.js` import (now 5 named imports)
  - 4 new module-level constants: `BRAND_VOICE_PT_BR`, `FORMATTING_RULES_PT_BR`, `MIN_PLAIN_TEXT_CHARS`, `MAX_PLAIN_TEXT_CHARS`
  - 1 new helper: `withGeminiTimeout<T>(label, run)`
  - 3 prompt builders rewritten to pt-BR (`generateTopicWithGemini`, `generatePostWithGemini`, `generateImageWithGemini`)
  - 1 catch block rewritten to map typed/value errors to reason taxonomy
  - Local `slugifyTitle` function removed; `buildSlug` now calls `slugifyTitleNFD || 'blog-post'`
  - `getGeminiText` + `generateImageWithGemini` gain empty-candidates check (D-08)
  - Sanitize+validate block inserted in `runPipeline` between `generatePost` and the image block

## Code Paths Added

- **`withGeminiTimeout<T>(label, run)`** — Promise.race wrapper. Creates an AbortController (forward-compat) + setTimeout that rejects with `GeminiTimeoutError(\`Gemini ${label} exceeded ${BLOG_GEMINI_TIMEOUT_MS}ms\`)`. Cleared via `clearTimeout` in finally block. The SDK call itself continues in the background after timeout — we just stop waiting (acceptable per Phase 36 scope; retry is Phase 38).
- **Sanitize + validate block in `runPipeline`** — runs sanitizer first, measures plain-text length on sanitized HTML, distinguishes `invalid_html` (sanitizer stripped salvageable content) from `content_length_out_of_bounds` (length issue independent of sanitization). Mutates `generatedPost.content = sanitizedContent` so the saved post body contains the cleaned HTML.
- **Catch-block reason taxonomy** — typed errors checked first (`error instanceof GeminiTimeoutError`, `error instanceof GeminiEmptyResponseError`), then string-message match for the two non-class errors thrown directly from `runPipeline` (no new error class needed; keeps blogContentValidator.ts minimal per D-14). Unmapped errors leave `reason: null` and persist `error: message` for debug.

## Decisions Made

- **Followed plan as specified for D-05/D-06/D-07/D-08/D-10/D-11/D-12/D-13.** All eight phase decisions implemented verbatim.
- **String-message matching over new error classes for length/HTML failures.** Keeps the blogContentValidator.ts surface area at exactly two error classes (`GeminiTimeoutError`, `GeminiEmptyResponseError`) per D-14. Length/HTML errors are throw-and-catch within blog-generator.ts, so a `throw new Error('invalid_html')` paired with a `message === 'invalid_html'` match in the same module is the cheapest precise mapping. Saves a file edit + an export.
- **Template-literal prompt builders over `array.join('\n')`.** Same wire-format output, ~10 fewer source lines per builder. Triggered by the 600-line cap pressure. Verifiable by hashing the prompt string before/after; both forms produce byte-identical output.
- **Method-shorthand for `defaultStorage`.** `name: async (args) => (await getStorage()).name(args)` instead of `async name(args) { return (await getStorage()).name(args); }` — saves 14 lines across 7 methods, no semantic change. TypeScript infers identical types.
- **Comment trims (Rule 3 — line cap was a blocking issue).** Multi-line JSDoc and `// ───── separators` were collapsed to single-line `//` comments where the rationale is captured in the SUMMARY/CONTEXT instead. Surface-area comments preserved (e.g., D-08 explanation in `getGeminiText`, D-13 mapping rationale in catch block).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] TypeScript inference on generic withGeminiTimeout call site**

- **Found during:** Task 2 (after Edit 2.D applied to `generateImageWithGemini`)
- **Issue:** `withGeminiTimeout("image", () => (client.models as any).generateContent(...))` — TypeScript inferred the generic `T` as `{}` (empty object) because the inner `Promise<any>` from the cast didn't propagate cleanly through the arrow function return type. Compile errors: `TS2339: Property 'candidates' does not exist on type '{}'` at the empty-candidates check.
- **Fix:** Added explicit generic parameter `withGeminiTimeout<any>("image", () => ...)`. Topic + post call sites are unaffected because their inner `getGeminiText` call has a stable `Promise<string>` return type that TypeScript infers cleanly.
- **Files modified:** server/lib/blog-generator.ts
- **Verification:** `npm run check` clean after the explicit-generic-cast.
- **Committed in:** `b2d973e` (Task 2 commit)

**2. [Rule 3 — Blocking] 600-line cap exceeded after raw plan application**

- **Found during:** End of Task 2 (file at 641 lines), end of Task 3 (file at 617 lines)
- **Issue:** The plan's literal code (verbatim multi-line array prompt builders + multi-line comment blocks + multi-line JSDoc) pushed the file to 641 after Task 2 and 617 after Task 3 — over the CLAUDE.md 600-line hard cap. The plan acknowledged this risk explicitly ("Hard cap: 600 (CLAUDE.md). If over, the most likely culprit is over-long inline JSDoc — trim to single-line where possible.") and pre-authorized comment trims as the remediation strategy.
- **Fix:**
  1. Converted both pt-BR prompt builders from `array.join('\n')` to template-literal form (zero behavioral change — same wire output).
  2. Collapsed multi-line comments to single-line where the rationale is captured in CONTEXT/SUMMARY.
  3. Applied method-shorthand to the 7-method `defaultStorage` adapter.
- **Result:** File at 598 lines (under the cap with 2-line buffer). All grep verifications still pass; behavioral output unchanged.
- **Files modified:** server/lib/blog-generator.ts
- **Verification:** `wc -l server/lib/blog-generator.ts` returns 598; `npm run check` clean; all `grep -c` invariants from the plan's verification block hold.
- **Committed in:** `b2d973e` (Task 2 trims) + `0582164` (Task 3 trims)

**Note on grep count semantics for `withGeminiTimeout(`:** The plan's acceptance criterion `grep -c "withGeminiTimeout(" server/lib/blog-generator.ts` was expected to return ≥ 3 (3 call sites + 1 declaration = 4). The actual count is 2 because `withGeminiTimeout(` (with literal paren) does not match `withGeminiTimeout<any>("image"` — the generic-type arrow's `<` precedes the paren. The count without paren is 4 (1 declaration + 3 call sites). The behavioral contract is satisfied: 3 distinct call sites for topic, post, and image generation. Reported via `grep -c "withGeminiTimeout"` not `grep -c "withGeminiTimeout("`.

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking compiler / line-cap issues, both pre-authorized by the plan).
**Impact on plan:** Plan executed in full with the cap-driven trimming the plan itself anticipated. Behavioral contracts unchanged; verbatim D-11/D-12 blocks preserved as module constants; all 5 BLOG2-0X requirements delivered.

## Verification Commands Executed

```bash
# Compile
npm run check                                                                # exit 0

# Line cap (HARD)
test "$(wc -l < server/lib/blog-generator.ts)" -le 600                       # PASS (598)

# Imports correct
grep -E "BLOG_GEMINI_TIMEOUT_MS" server/lib/blog-generator.ts                # 1 match
grep -E 'from "./blogContentValidator.js"' server/lib/blog-generator.ts      # 1 match

# Prompt blocks present (verbatim D-11 + D-12)
grep -c "Você é um redator da Skale Club" server/lib/blog-generator.ts        # 1
grep -c "REGRAS DE FORMATAÇÃO (obrigatórias):" server/lib/blog-generator.ts   # 1

# Three Gemini call sites all wrapped (declaration + 3 call sites = 4)
grep -c "withGeminiTimeout" server/lib/blog-generator.ts                      # 4

# Empty-candidates check exists in both text + image paths
grep -c "GeminiEmptyResponseError" server/lib/blog-generator.ts               # 4

# Sanitizer + length validator wired in runPipeline
grep -c "sanitizeBlogHtml(generatedPost.content)" server/lib/blog-generator.ts # 1
grep -c "getPlainTextLength" server/lib/blog-generator.ts                      # 3

# Slug uses NFD-normalized helper, local function removed
grep -c "slugifyTitleNFD" server/lib/blog-generator.ts                         # 2
grep -cE "^function slugifyTitle\(" server/lib/blog-generator.ts               # 0

# All four new failure reasons appear in the catch block
grep -c "gemini_timeout" server/lib/blog-generator.ts                          # 1
grep -c "gemini_empty_response" server/lib/blog-generator.ts                   # 2
grep -c "invalid_html" server/lib/blog-generator.ts                            # 2
grep -c "content_length_out_of_bounds" server/lib/blog-generator.ts            # 3

# Phase 35 contract preserved
grep -c "no_rss_items" server/lib/blog-generator.ts                            # 3
grep -c "selectNextRssItem" server/lib/blog-generator.ts                       # 2
grep -c "markRssItemUsed" server/lib/blog-generator.ts                         # 2
```

All numeric expectations hold and `npm run check` exits 0.

## Issues Encountered

- **TypeScript generic inference quirk** on `withGeminiTimeout` when wrapping `(client.models as any).generateContent(...)` — fixed with explicit `<any>` generic parameter at the image call site (text call sites unaffected because their inner `getGeminiText` returns `Promise<string>` which infers cleanly).
- **Line cap pressure** — plan acknowledged this risk; remediated via template-literal prompts + comment compaction + method-shorthand. Behavioral output unchanged.

## User Setup Required

None. Environment variables (`BLOG_GEMINI_TIMEOUT_MS`, `BLOG_CONTENT_MODEL`, `BLOG_IMAGE_MODEL`) remain optional with safe defaults baked into `server/lib/blog-gemini.ts` (Plan 36-02).

## Next Phase Readiness

**For Phase 37 (admin job-history UI):**
- 4 new `reason` values now appear in `blog_generation_jobs.reason`:
  - `'invalid_html'` — sanitizer stripped salvageable content below 600 chars
  - `'content_length_out_of_bounds'` — sanitized plain-text outside [600, 4000]
  - `'gemini_timeout'` — AbortController fired (default 30s, override via `BLOG_GEMINI_TIMEOUT_MS`)
  - `'gemini_empty_response'` — Gemini returned empty `candidates` array (content filter or model outage)
- These are additive to the existing 6 skip reasons (`no_settings`, `disabled`, `posts_per_day_zero`, `too_soon`, `locked`, `no_rss_items`). Phase 37's job-history table needs a label/translation for each.
- No DB migration was needed (D-13 / D-16) — the `reason` column is already a free-text column.

**For Phase 38 (cron observability + retry):**
- `GeminiTimeoutError` and `GeminiEmptyResponseError` are typed Error subclasses (distinct `.name`) — Phase 38 retry-with-backoff can branch on them precisely (`error instanceof GeminiTimeoutError` for retryable network/load issues vs. `GeminiEmptyResponseError` which is more often a content-filter trigger and may not retry productively).
- The `withGeminiTimeout` helper currently returns the SDK's resolved value or rejects on timeout — Phase 38 can wrap it in a retry decorator without modifying the helper itself.

**No blockers.** Phase 36 is feature-complete with respect to the requirements scope.

## Self-Check: PASSED

- FOUND: server/lib/blog-generator.ts (598 lines)
- FOUND: 7bbbf28 (Task 1 commit) in `git log`
- FOUND: b2d973e (Task 2 commit) in `git log`
- FOUND: 0582164 (Task 3 commit) in `git log`
- FOUND: BRAND_VOICE_PT_BR (1 occurrence) in blog-generator.ts
- FOUND: FORMATTING_RULES_PT_BR (1 occurrence) in blog-generator.ts
- FOUND: withGeminiTimeout (4 occurrences: 1 declaration + 3 call sites) in blog-generator.ts
- FOUND: sanitizeBlogHtml(generatedPost.content) (1 occurrence) in blog-generator.ts
- FOUND: GeminiTimeoutError (3 occurrences: import + helper + catch) in blog-generator.ts
- FOUND: GeminiEmptyResponseError (4 occurrences: import + getGeminiText + image + catch) in blog-generator.ts
- VERIFIED: file ≤ 600 lines (598)
- VERIFIED: `npm run check` exits 0
- VERIFIED: no `^function slugifyTitle\(` match (local helper removed)

---
*Phase: 36-generator-quality-overhaul*
*Completed: 2026-05-05*
