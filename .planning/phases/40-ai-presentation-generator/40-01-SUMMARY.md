---
phase: 40-ai-presentation-generator
plan: 01
subsystem: api
tags: [gemini, groq, presentations, ai, transcription, generation]

# Dependency graph
requires:
  - 39-01 (extended slideBlockSchema with 12 layouts + style fields)
  - server/lib/gemini.ts (getGeminiClient)
  - server/lib/ai-provider.ts (getRuntimeGeminiKey, getRuntimeGroqKey)
  - server/routes/_shared.ts (requireAdmin)
provides:
  - POST /api/presentations/transcribe — Groq Whisper audio-to-text endpoint
  - POST /api/presentations/generate — Gemini slide generation endpoint
  - GENERATE_SLIDES_TOOL in OpenAI-compat format
  - registerPresentationsGeneratorRoutes exported from server/routes/presentationsGenerator.ts
affects:
  - server/routes.ts (two new lines: import + registration call)
  - 40-02-PLAN.md (admin UI calls these two endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Groq dynamic import for audio transcription — same pattern as other Groq audio usage"
    - "Gemini via OpenAI-compat client with forced tool_choice — same as presentationsChat.ts but OpenAI format not Anthropic"
    - "buildUniquePresentationSlug duplicated verbatim from presentations.ts — self-contained, no shared utility"
    - "guidelinesSnapshot bypasses insertPresentationSchema — passed directly to storage.createPresentation"

key-files:
  created:
    - server/routes/presentationsGenerator.ts
  modified:
    - server/routes.ts

key-decisions:
  - "GENERATE_SLIDES_TOOL in OpenAI-compatible format (type:function) NOT Anthropic format (input_schema) — Gemini uses OpenAI-compat endpoint"
  - "tool_choice uses { type: 'function', function: { name: 'generate_slides' } } NOT Anthropic { type: 'tool', name: '...' }"
  - "arguments field is a JSON string — must call JSON.parse(toolCall.function.arguments)"
  - "Groq SDK dynamically imported inside handler — avoids top-level module load failure when GROQ_API_KEY not set"
  - "GEMINI_PRESENTATION_MODEL env var for model override, defaults to gemini-2.0-flash"
  - "422 returned when Zod validation of generated slides fails (not 500)"

# Metrics
duration: ~5min
completed: 2026-05-16
---

# Phase 40 Plan 01: AI Presentation Generator — Backend Endpoints Summary

**Groq Whisper transcription endpoint + Gemini GENERATE_SLIDES_TOOL generation endpoint; both admin-gated, Zod-validated, registered before wildcard routes in routes.ts**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-16T01:45:52Z
- **Completed:** 2026-05-16T01:51:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created + 1 modified)

## Accomplishments

- Created `server/routes/presentationsGenerator.ts` (240 lines) with two admin-authenticated endpoints:
  - `POST /api/presentations/transcribe` — strips data-URL prefix, converts base64 to Buffer, dynamically imports Groq SDK, calls `whisper-large-v3`, returns `{ transcription: string }`
  - `POST /api/presentations/generate` — resolves Gemini key from runtime cache / env / DB, calls Gemini with forced `GENERATE_SLIDES_TOOL`, Zod-validates slides array, persists via `storage.createPresentation` with `guidelinesSnapshot`, returns `{ id, slug }`
- Defined `GENERATE_SLIDES_TOOL` in OpenAI-compatible format (not Anthropic format) with all 12 layout values from Phase 39
- Wrote `buildGeneratorSystemPrompt(guidelines)` describing all 12 layouts with bilingual and brand-color instructions
- Added import and registration call to `server/routes.ts` (2 lines; generator registered after `registerPresentationsChatRoutes`)
- `npm run check` exits 0 with no TypeScript errors

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Create presentationsGenerator.ts | e2c6aa8 | server/routes/presentationsGenerator.ts (created) |
| Task 2: Register routes in routes.ts | 4d1bcb9 | server/routes.ts (2 lines added) |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notable Implementation Notes

- Merged `main` into worktree branch before execution to pull Phase 39 schema changes (slideBlockSchema extended from 8 to 12 layouts + style fields). The worktree was branched from `f9c6290` before Phase 39 commits.
- `GENERATE_SLIDES_TOOL` includes `attribution`/`attributionPt` fields (for `quote` layout) and full `style` sub-object, matching the Phase 39 extended `slideBlockSchema`.
- The plan's acceptance criterion `grep '"type": "function"'` uses double-quoted key format; actual TypeScript uses `type: "function" as const` — the tool format is correctly OpenAI-compatible.

## Known Stubs

None — both endpoints are fully wired. API key resolution, Groq transcription, Gemini generation, Zod validation, and DB persistence are all implemented.

## Self-Check: PASSED

- `server/routes/presentationsGenerator.ts` exists and exports `registerPresentationsGeneratorRoutes`
- `server/routes.ts` has both import (line 31) and call (line 146)
- `npm run check` exits 0
- Commits e2c6aa8 and 4d1bcb9 exist in git log
