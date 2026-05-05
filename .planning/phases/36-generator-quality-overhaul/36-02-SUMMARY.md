---
phase: 36-generator-quality-overhaul
plan: 02
subsystem: infra
tags: [gemini, env-vars, blog-generator, config, ops]

requires:
  - phase: 22-blog-generator-engine
    provides: server/lib/blog-gemini.ts singleton (BLOG_CONTENT_MODEL, BLOG_IMAGE_MODEL, getBlogGeminiClient, resolveBlogGeminiApiKey)
provides:
  - env-overridable BLOG_CONTENT_MODEL constant (fallback gemini-2.5-flash)
  - env-overridable BLOG_IMAGE_MODEL constant (fallback gemini-2.0-flash-exp)
  - new BLOG_GEMINI_TIMEOUT_MS constant (Number(env) || 30_000) ready for Plan 36-03 AbortController wiring
  - .env.example documentation for all three vars
affects: [36-03-gemini-call-hardening, 37-admin-blog-job-history, 38-cron-observability]

tech-stack:
  added: []
  patterns:
    - "Module-level env var read with `||` defensive fallback (single source of truth, no per-call cost)"
    - "Number(env) || N pattern for numeric env vars (handles undefined/NaN/zero/non-numeric uniformly)"

key-files:
  created: []
  modified:
    - server/lib/blog-gemini.ts (29 → 53 lines; added 3 exports, preserved 2 existing)
    - .env.example (35 → 45 lines; new Phase 36 section between Anthropic + Build Configuration)

key-decisions:
  - "BLOG_IMAGE_MODEL fallback locked to 'gemini-2.0-flash-exp' (verified — preserves Phase 22 production default; rejected speculative 'gemini-2.5-flash-image-preview' from CONTEXT)"
  - "Defensive parse uses `||` not `??` so 0/NaN/empty-string also fall back to 30_000 (matches CONTEXT 'Specifics' mandate)"
  - "All three constants read once at module load — no per-call overhead, no hot-reload complexity (D-09)"

patterns-established:
  - "Top-level env-var const exports in lib modules: `process.env.X || 'default'` for strings, `Number(process.env.X) || N` for numbers"
  - "Phase 36 env vars documented under a dedicated section in .env.example with comments naming the source file (server/lib/blog-gemini.ts) and explaining fallback behavior"

requirements-completed: [BLOG2-05, BLOG2-06]

duration: ~3min
completed: 2026-05-05
---

# Phase 36 Plan 02: Env-Overridable Gemini Models + Timeout Constant

**Three env-var-overridable constants exported from blog-gemini.ts (BLOG_CONTENT_MODEL, BLOG_IMAGE_MODEL, BLOG_GEMINI_TIMEOUT_MS) with defensive `||` fallbacks, ready for Plan 36-03 AbortController integration.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-05T03:11:00Z
- **Completed:** 2026-05-05T03:13:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `BLOG_CONTENT_MODEL` now overridable via `process.env.BLOG_CONTENT_MODEL` (fallback `gemini-2.5-flash` per D-09)
- `BLOG_IMAGE_MODEL` now overridable via `process.env.BLOG_IMAGE_MODEL` (fallback `gemini-2.0-flash-exp` — verified current production value)
- New `BLOG_GEMINI_TIMEOUT_MS` exported as `Number(env) || 30_000` (D-07) — Plan 36-03 will consume it for AbortController wiring
- `.env.example` documents all three new vars under a dedicated Phase 36 section with comments explaining defaults
- Existing exports (`resolveBlogGeminiApiKey`, `getBlogGeminiClient`) and consumer imports in `server/lib/blog-generator.ts` are unchanged — zero call-site impact
- `npm run check` passes clean

## Task Commits

Each task was committed atomically (with `--no-verify` per Wave 1 parallel execution policy):

1. **Task 1: Make blog-gemini.ts model IDs env-overridable + add timeout constant** — `aa6ae99` (feat)
2. **Task 2: Document the three new env vars in .env.example** — `6317bb2` (docs)

## Files Created/Modified

- `server/lib/blog-gemini.ts` — Added env-var reads with `||` fallbacks for two model IDs, new `BLOG_GEMINI_TIMEOUT_MS` numeric export (`Number(env) || 30_000`), section comments explaining D-07/D-09 rationale; existing API-key resolver and singleton client preserved verbatim
- `.env.example` — New "Blog Generator (Phase 36 — optional overrides)" section between Anthropic block and Build Configuration block, documenting `BLOG_CONTENT_MODEL`, `BLOG_IMAGE_MODEL`, `BLOG_GEMINI_TIMEOUT_MS` with their default values

## Decisions Made

- **D-09 BLOG_IMAGE_MODEL fallback verified before locking.** CONTEXT.md guessed `gemini-2.5-flash-image-preview` but flagged "verify before locking". Direct read of `server/lib/blog-gemini.ts` (Phase 22) confirmed the production value was `gemini-2.0-flash-exp`. Locked the fallback to that to avoid silent regression. Documented in CONTEXT note + frontmatter.
- **D-07 defensive parse uses `||` not `??`.** This was explicitly mandated in CONTEXT "Specifics" — `Number("") || 30_000`, `Number("0") || 30_000`, `Number("abc") || 30_000` all fall back. Only positive finite numbers override. `??` would let `0` through, which would mean "no timeout" → bug.
- **Read-once-at-module-load.** No re-evaluation per call. Plan 36-03 will import these at call sites; if ops need to change a value, redeploy is required (acceptable per D-09).

## Deviations from Plan

None — plan executed exactly as written.

The plan included a verification step ("grep blog-generator.ts to confirm the current image model literal"). Verification confirmed `BLOG_IMAGE_MODEL` was already imported from `blog-gemini.ts` (not redeclared in `blog-generator.ts`), and the canonical value in `blog-gemini.ts` was `gemini-2.0-flash-exp` — matching the locked fallback.

## Issues Encountered

None.

## User Setup Required

None — the new env vars are optional with safe defaults baked into the code. Ops may set them at deploy time if a model is deprecated (per D-09 motivation), but no setup is required for the current production behavior to continue unchanged.

## Next Phase Readiness

**Ready for Plan 36-03 (Gemini call hardening — Wave 2):**
- `BLOG_GEMINI_TIMEOUT_MS` is importable from `./blog-gemini.js` for the AbortController wrapper Plan 36-03 will add to `getGeminiText` and `generateImageWithGemini` call sites in `server/lib/blog-generator.ts`
- Plan 36-03's import block extension is mechanical — add `BLOG_GEMINI_TIMEOUT_MS` to the existing 4-name import in `blog-generator.ts` line 17-21
- No call sites currently consume `BLOG_GEMINI_TIMEOUT_MS` — it is dead-export-ready until Plan 36-03 wires it in (intentional — keeps Plan 36-02 a pure config change)

**Ready for Plan 36-01 (validator module — Wave 1, parallel):**
- No file overlap; both plans modified disjoint files (Plan 36-01 owns `blogContentValidator.ts` + `blog-generator.ts` slug logic, Plan 36-02 owns `blog-gemini.ts` + `.env.example`)

---

## Self-Check: PASSED

- `server/lib/blog-gemini.ts` exists — FOUND
- `.env.example` exists — FOUND
- Commit `aa6ae99` (Task 1) — FOUND in `git log`
- Commit `6317bb2` (Task 2) — FOUND in `git log`
- `npm run check` exits 0 — VERIFIED
- All three exports present (`BLOG_CONTENT_MODEL`, `BLOG_IMAGE_MODEL`, `BLOG_GEMINI_TIMEOUT_MS`) — VERIFIED via grep
- All three env vars documented in `.env.example` (count = 3) — VERIFIED via grep
- Defensive parse uses `||` not `??` — VERIFIED via grep
- Fallbacks match D-07/D-09 (`gemini-2.5-flash`, `gemini-2.0-flash-exp`, `30_000`) — VERIFIED via grep

---
*Phase: 36-generator-quality-overhaul*
*Completed: 2026-05-05*
