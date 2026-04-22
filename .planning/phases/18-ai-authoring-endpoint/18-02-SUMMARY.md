---
phase: 18-ai-authoring-endpoint
plan: "02"
subsystem: api
tags: [anthropic, sse, streaming, zod, presentations, claude]

# Dependency graph
requires:
  - phase: 18-ai-authoring-endpoint
    provides: plan 01 — ANTHROPIC_API_KEY documented, slideBlockSchema unit test confirming all 8 variants valid
  - phase: 17-brand-guidelines
    provides: server/routes/brandGuidelines.ts with getBrandGuidelines storage method
  - phase: 15-schema-foundation
    provides: shared/schema/presentations.ts with slideBlockSchema, Presentation type, storage methods

provides:
  - POST /api/presentations/:id/chat — SSE streaming endpoint accepting { message } and returning progress/done/error events
  - server/routes/presentationsChat.ts — registered via registerPresentationsChatRoutes
  - PRES-11: slides + guidelinesSnapshot + version+1 persisted after Claude stream
  - PRES-12: Zod z.array(slideBlockSchema) validation gate on every DB write
  - PRES-13: full current slides injected as user context for targeted slide edits

affects: [19-public-viewer, future-admin-chat-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSE streaming pattern: flushHeaders() before any await, all post-header errors via res.write(data: {type:error})"
    - "Anthropic.Tool type from default import (not named Tool export — not in top-level SDK index)"
    - "Force tool_choice: { type: 'tool', name: 'update_slides' } to prevent plain-text Claude responses"
    - "Pre-flight getAnthropicClient() call before SSE headers to return 503 JSON on missing API key"

key-files:
  created:
    - server/routes/presentationsChat.ts
  modified:
    - server/routes.ts

key-decisions:
  - "Import Anthropic default (not { Tool }) — Tool is in Anthropic namespace, not top-level SDK export; use Anthropic.Tool as type annotation"
  - "All pre-SSE errors (400/401/403/404/503) use res.json(); post-header errors use res.write(data: {type:error,...})"
  - "tool_choice forced to specific tool — prevents Claude from replying in prose when guidelines say to use the tool"

patterns-established:
  - "SSE endpoint pre-flight pattern: validate body → check API key → load DB rows → then and only then call res.flushHeaders()"
  - "Anthropic streaming: client.messages.stream() with stream.on('inputJson') for progress ticks + stream.finalMessage() for result"

requirements-completed:
  - PRES-11
  - PRES-12
  - PRES-13

# Metrics
duration: ~3min
completed: 2026-04-22
---

# Phase 18 Plan 02: AI Authoring Endpoint — SSE Streaming Chat Route Summary

**POST /api/presentations/:id/chat SSE endpoint streams Claude tool_use responses, Zod-validates SlideBlock[], and persists slides + guidelinesSnapshot + version+1 to the DB**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-22T00:41:41Z
- **Completed:** 2026-04-22T00:44:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `server/routes/presentationsChat.ts` with `registerPresentationsChatRoutes` — a fully-featured SSE streaming endpoint that loads brand guidelines as the Claude system prompt, injects the full current slides array as user context, forces `update_slides` tool invocation, streams `progress` events on each `inputJson` tick, and writes a `done` event with the validated slides array on completion
- Registered the new route in `server/routes.ts` with a single import + call alongside the existing `presentations` and `brandGuidelines` siblings
- Auto-fixed a TypeScript deviation: `Tool` is not exported from the top-level `@anthropic-ai/sdk` index — the correct type is `Anthropic.Tool` from the default import namespace

## Task Commits

Each task was committed atomically:

1. **Task 1: Create server/routes/presentationsChat.ts** - `618098d` (feat)
2. **Task 2: Register presentationsChat routes in server/routes.ts** - `f264745` (feat)

## Files Created/Modified

- `server/routes/presentationsChat.ts` — New SSE chat endpoint; exports `registerPresentationsChatRoutes`; UPDATE_SLIDES_TOOL static JSON Schema; buildSystemPrompt injects brand guidelines; chatBodySchema validates { message }; full pre-flight before SSE headers; Zod validation gate on all DB writes
- `server/routes.ts` — Added import + registration call for `registerPresentationsChatRoutes`

## Decisions Made

- **Anthropic.Tool type:** The `Tool` named export does not exist in `@anthropic-ai/sdk`'s top-level index. The type lives in the `Anthropic` namespace (available via the default import). Fixed to `Anthropic.Tool` without any plan consultation since it's a Rule 1 auto-fix (TypeScript error preventing compilation).
- **Pre-SSE pre-flight ordering:** Body validation → API key check → DB lookups → `res.flushHeaders()`. This ensures 400/404/503 errors return clean JSON responses, not partial SSE streams.
- **Forced tool_choice:** `{ type: "tool", name: "update_slides" }` prevents Claude from replying in prose when the system prompt instructs tool use — critical for deterministic structured output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Tool type import from @anthropic-ai/sdk**
- **Found during:** Task 1 (create presentationsChat.ts) — TypeScript check
- **Issue:** Plan specified `import type { Tool } from "@anthropic-ai/sdk"` but `Tool` is not a named export at the package's top-level index; only available as `Anthropic.Tool` via the default import
- **Fix:** Changed to `import Anthropic from "@anthropic-ai/sdk"` and typed the constant as `Anthropic.Tool`
- **Files modified:** `server/routes/presentationsChat.ts`
- **Verification:** `npm run check` exits 0
- **Committed in:** `618098d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript compilation error)
**Impact on plan:** Fix necessary for compilation. Behavior is identical — `Anthropic.Tool` is the same interface as the planned `Tool`.

## Issues Encountered

- `@anthropic-ai/sdk` v0.90.0 (as specified in the plan) does not re-export `Tool` as a named export from the top-level package index. The type is available only via the `Anthropic` namespace. Resolved with `Anthropic.Tool` typing.

## User Setup Required

Developer must have a real `ANTHROPIC_API_KEY` in their local `.env` to exercise the endpoint. The key was documented in `.env.example` in Plan 18-01.

## Known Stubs

None — this plan creates a backend API endpoint. No UI or data-flow stubs introduced.

## Next Phase Readiness

- Phase 18 (AI Authoring Endpoint) is feature-complete: Wave 0 foundations (18-01) + SSE endpoint (18-02) both shipped
- `POST /api/presentations/:id/chat` is live; unauthenticated requests return 401 before SSE headers are sent; missing API key returns 503; valid admin sessions stream progress/done events
- PRES-11, PRES-12, PRES-13 all exercised by this single endpoint
- Ready for admin chat UI (future phase) to consume the SSE stream

## Self-Check: PASSED

- `server/routes/presentationsChat.ts` — FOUND
- `server/routes.ts` — contains `registerPresentationsChatRoutes` (2 matches: import + call)
- Commits `618098d`, `f264745` — FOUND in git log
- `npm run check` — exits 0
- `npx tsx server/lib/__tests__/slideBlockSchema.test.ts` — PASS: All 8 SlideBlock variants validate correctly

---
*Phase: 18-ai-authoring-endpoint*
*Completed: 2026-04-22*
