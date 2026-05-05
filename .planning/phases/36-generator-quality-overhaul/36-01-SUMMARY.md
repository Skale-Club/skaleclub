---
phase: 36-generator-quality-overhaul
plan: 01
subsystem: blog-automation

tags: [sanitize-html, blog, validator, slug, gemini-errors, pure-module]

# Dependency graph
requires:
  - phase: 35-rss-fetcher-and-topic-selection
    provides: BlogGenerator pipeline shape (rssItem threading, structured skip/fail returns) — Plan 36-03 will plug this validator into that pipeline.
provides:
  - server/lib/blogContentValidator.ts — pure module exporting sanitizeBlogHtml, getPlainTextLength, slugifyTitle, GeminiTimeoutError, GeminiEmptyResponseError, ALLOWED_BLOG_TAGS
  - sanitize-html@2.17.3 dependency (D-01 canonical sanitizer)
  - @types/sanitize-html@2.16.1 dev dependency
affects: [36-03-PLAN, blog-generator, blog-quality, BLOG2-04, BLOG2-05, BLOG2-06]

# Tech tracking
tech-stack:
  added: [sanitize-html@2.17.3, @types/sanitize-html@2.16.1]
  patterns:
    - "Pure helper module with file-local SANITIZE_OPTS const and exported error classes (mirrors server/lib/rssFetcher.ts shape)"
    - "transformTags-forced attributes must also be in allowedAttributes — sanitize-html applies allowedAttributes AFTER transformTags"

key-files:
  created:
    - server/lib/blogContentValidator.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "D-01 implemented: sanitize-html chosen as canonical HTML sanitizer (single lib per concern)"
  - "D-02 implemented: 10-tag allowlist (p, h2, h3, ul, ol, li, strong, em, a, blockquote) exported as ALLOWED_BLOG_TAGS const"
  - "D-03 implemented: anchors restricted to http(s) schemes; rel/target forced via transformTags"
  - "D-04 implemented: slugifyTitle uses .normalize('NFD') + combining-mark strip + 80-char cap"
  - "D-08 implemented: GeminiTimeoutError + GeminiEmptyResponseError as distinct named Error subclasses"
  - "D-14 implemented: dedicated module location (server/lib/blogContentValidator.ts)"
  - "D-15 implemented: SANITIZE_OPTS module-level const at top of file"
  - "Deviation Rule 1: rel and target added to allowedAttributes for <a> — required for transformTags-forced attributes to survive sanitize-html's post-transform attribute filter (see Deviations)"

patterns-established:
  - "Pure helper module: only npm imports (sanitize-html), zero project-internal imports — keeps the orchestrator (Plan 36-03 generator) as the only side-effect surface"
  - "Force-attributes via transformTags MUST be allowlisted in allowedAttributes — documented as inline comment for future phases"
  - "Typed error classes for Gemini failure modes — distinct .name strings allow generator-level switch by reason"

requirements-completed: [BLOG2-02, BLOG2-03]

# Metrics
duration: ~7min
completed: 2026-05-05
---

# Phase 36 Plan 01: Blog Content Validator Summary

**Pure HTML sanitizer + slug generator + typed Gemini error classes shipped as a dependency-free module ready for Plan 36-03 to consume.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-05T03:11:52Z
- **Completed:** 2026-05-05T03:18:21Z
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 2 (package.json, package-lock.json)

## Accomplishments

- `sanitize-html@2.17.3` + `@types/sanitize-html@2.16.1` installed and verified (`npm ls sanitize-html` clean, single resolved version)
- `server/lib/blogContentValidator.ts` (124 lines, well under 600-line CLAUDE.md cap) ships with six exports — `ALLOWED_BLOG_TAGS`, `sanitizeBlogHtml`, `getPlainTextLength`, `slugifyTitle`, `GeminiTimeoutError`, `GeminiEmptyResponseError`
- Behavioral verification (npx tsx smoke test) confirmed every sanitizer/slug invariant in the plan: NFD slug for "Análise de CRM em 2026" → `analise-de-crm-em-2026`, 80-char cap holds, `javascript:` href stripped while text preserved, https anchors emerge with forced `rel="noopener noreferrer nofollow" target="_blank"`, and disallowed tags (script, h1, img, br, table) get stripped while their text children are preserved
- `npm run check` passes with zero new errors

## Task Commits

1. **Task 1: Add sanitize-html dependency** — `203472d` (chore)
2. **Task 2: Create server/lib/blogContentValidator.ts** — `ee91c0a` (feat)

_Plan 36-02 was running in parallel under Wave 1 — its commits (`aa6ae99`, `6317bb2`, `c8b5b0e`) are interleaved in `git log` but touch disjoint files (server/lib/blog-gemini.ts, .env.example, 36-02-SUMMARY.md). No merge conflicts._

## Files Created/Modified

- `server/lib/blogContentValidator.ts` (NEW, 124 lines) — pure module exporting the sanitizer, plain-text length helper, slug generator, allowlist const, and two typed Gemini Error subclasses. No DB, no Gemini, no env reads. Only `sanitize-html` import.
- `package.json` — added `sanitize-html` to dependencies (`^2.17.3`), `@types/sanitize-html` to devDependencies (`^2.16.1`).
- `package-lock.json` — npm-managed lockfile update for the dependency tree (12 transitive packages).

## Decisions Made

- **Followed plan as specified for D-01/D-02/D-03/D-04/D-08/D-14/D-15.** All seven decisions from 36-CONTEXT.md implemented verbatim where the plan's literal code matched the decision.
- **One deviation applied (Rule 1 — see below):** `allowedAttributes.a` was widened from `["href"]` to `["href", "rel", "target"]` because sanitize-html applies the allowlist AFTER `transformTags` runs, so transform-forced attributes get filtered out otherwise. The model-supplied `rel`/`target` attributes are still effectively neutralized — the transform overwrites them — so the security guarantee of D-03 is preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Widened `allowedAttributes.a` so transform-forced rel/target survive**

- **Found during:** Task 2 (validator behavioral smoke test)
- **Issue:** The plan's literal code (`allowedAttributes: { a: ["href"] }` with `transformTags.a` adding `rel`/`target`) produced `<a href="https://example.com">x</a>` — the forced rel/target were stripped. Direct test of sanitize-html confirmed the library applies `allowedAttributes` AFTER `transformTags`, so any attribute forced by the transform must also appear in the allowlist or it gets filtered. The plan's success criterion explicitly required `<a href="https://example.com" rel="noopener noreferrer nofollow" target="_blank">x</a>` for legitimate URLs, which is impossible with the literal config.
- **Fix:** Changed `allowedAttributes: { a: ["href"] }` → `allowedAttributes: { a: ["href", "rel", "target"] }`. The transform still overwrites both attributes with the canonical safe values, so model-supplied rel/target are effectively rejected (they're replaced, not preserved). Inline comment documents this for future maintainers.
- **Files modified:** server/lib/blogContentValidator.ts
- **Verification:** Smoke test now emits the exact expected output: `<a href="https://example.com" rel="noopener noreferrer nofollow" target="_blank">x</a>`. javascript: anchor still stripped of href (text preserved as `<a rel="..." target="_blank">x</a>`), preserving D-03 security guarantee.
- **Committed in:** `ee91c0a` (Task 2 commit, integrated into the initial file)

**Note on plan acceptance criterion conflict:** The plan stated `SANITIZE_OPTS.allowedAttributes.a is ["href"] (no rel, no target listed — those are forced by transformTags)`. This criterion was based on an incorrect assumption about sanitize-html's processing order. The fix is the only way to satisfy the more important behavioral acceptance criterion (`sanitizeBlogHtml(<a href="https://example.com">x</a>)` returns the rel/target-decorated anchor). Plan 36-03 should be aware of this when reading the validator's source — the inline comment explains the rationale.

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix required to meet behavioral spec)
**Impact on plan:** Necessary correction; the security and behavioral contracts are fully satisfied. No scope creep.

## Issues Encountered

- 30 npm vulnerabilities reported during `npm install sanitize-html` (3 low, 13 moderate, 13 high, 1 critical) — these are pre-existing in the dependency tree and unrelated to this plan. Out of scope (per scope-boundary rule). Did not run `npm audit fix` to avoid touching unrelated packages.

## User Setup Required

None — the validator is a pure module with no external configuration. Plan 36-02 (running in parallel) handles env-var documentation for the model IDs and timeout.

## Next Phase Readiness

- **For Plan 36-03 (generator integration):** Import names are stable and exported as named symbols:
  ```ts
  import {
    sanitizeBlogHtml,
    getPlainTextLength,
    slugifyTitle,
    GeminiTimeoutError,
    GeminiEmptyResponseError,
    ALLOWED_BLOG_TAGS,
  } from "./blogContentValidator.js";
  ```
- **Error class .name strings** for the `reason` taxonomy mapping (D-13):
  - `GeminiTimeoutError` → `reason: 'gemini_timeout'`
  - `GeminiEmptyResponseError` → `reason: 'gemini_empty_response'`
- **Length validation pattern** for D-05/D-06: call `getPlainTextLength(sanitizeBlogHtml(raw))` and gate on `600 ≤ len ≤ 4000`. Below 600 with prior-tag-strip → `'invalid_html'`; outside bounds otherwise → `'content_length_out_of_bounds'`.
- **Slug usage** for buildSlug (D-04): `${slugifyTitle(title) || 'blog-post'}-${Date.now()}` — caller still owns the empty-string fallback and the timestamp suffix.
- **No blockers.** Plan 36-03 (Wave 2) can begin immediately after 36-01 + 36-02 verification.

## Self-Check: PASSED

- FOUND: server/lib/blogContentValidator.ts
- FOUND: .planning/phases/36-generator-quality-overhaul/36-01-SUMMARY.md
- FOUND: 203472d (Task 1 commit)
- FOUND: ee91c0a (Task 2 commit)
- FOUND: sanitize-html in package.json
- FOUND: @types/sanitize-html in package.json

---
*Phase: 36-generator-quality-overhaul*
*Completed: 2026-05-05*
