---
phase: 15-schema-foundation
plan: "02"
subsystem: server/lib
tags: [anthropic, sdk, singleton, ai-integration]
dependency_graph:
  requires: []
  provides: [server/lib/anthropic.ts, getAnthropicClient()]
  affects: [Phase 18 AI Authoring Endpoint]
tech_stack:
  added: ["@anthropic-ai/sdk ^0.90.0"]
  patterns: [lazy-init singleton, env-guard throw]
key_files:
  created:
    - server/lib/anthropic.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Default import `import Anthropic from '@anthropic-ai/sdk'` (not named) — SDK ships only a default export; named import would fail at runtime"
  - "Standalone singleton, no coupling to getActiveAIClient() — Anthropic API shape is completely different from OpenAI/Groq shim"
  - "No runtimeKey cache mechanism in Phase 15 — Phase 18 can extend if settings-stored keys are needed"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-21"
  tasks: 2
  files: 3
---

# Phase 15 Plan 02: Anthropic SDK Singleton Summary

Anthropic SDK installed as production dependency and `getAnthropicClient()` lazy-init singleton created following the `getSupabaseAdmin()` pattern.

## What Was Built

- **`package.json`**: Added `@anthropic-ai/sdk ^0.90.0` under `dependencies` (not devDependencies)
- **`server/lib/anthropic.ts`**: Lazy-init Anthropic client singleton — module-level `null` variable, guards on `ANTHROPIC_API_KEY`, throws with a clear error message on missing env var

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install @anthropic-ai/sdk as production dependency | 793b326 | package.json, package-lock.json |
| 2 | Create server/lib/anthropic.ts singleton | 4d83eac | server/lib/anthropic.ts |

## Decisions Made

- **Default import**: `import Anthropic from "@anthropic-ai/sdk"` — the SDK ships its class as a default export; `import { Anthropic }` (named) would fail at runtime. Confirmed in RESEARCH.md Pattern 5.
- **Standalone singleton**: `getAnthropicClient()` is completely separate from `getActiveAIClient()` in `server/lib/ai-provider.ts`. The Anthropic API surface (`messages.create` with `model`, `max_tokens`, streaming) is incompatible with the OpenAI-shaped shim.
- **No runtimeKey mechanism**: Phase 15 ships the simplest correct implementation. Phase 18 can extend with database-stored key lookup if needed.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `getAnthropicClient()` is fully wired. It will throw `"ANTHROPIC_API_KEY must be set to use the Anthropic API"` in environments without the key, which is the correct behavior until Phase 18 wires it to actual API calls.

## Self-Check: PASSED

- `server/lib/anthropic.ts` exists and has correct content
- Commits 793b326, 4d83eac exist in git log
- `npm run check` exits 0
- `@anthropic-ai/sdk` appears under `"dependencies"` in package.json
