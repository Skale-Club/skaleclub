---
phase: 40-ai-presentation-generator
plan: 02
subsystem: ui
tags: [react, presentations, ai, gemini, groq, audio, mediarecorder, modal]

# Dependency graph
requires:
  - 40-01 (POST /api/presentations/transcribe and POST /api/presentations/generate endpoints)
  - client/src/components/admin/PresentationsSection.tsx (existing list + create UI)
provides:
  - GenerateModal embedded in PresentationsSection with title, prompt, audio recording, and generate mutation
  - "Generate with AI" button in PresentationsSection header
  - D-06 merged prompt format combining transcription + text context
  - D-03 post-generation navigation via setSelectedId
affects:
  - PresentationsSection admin UI (additive only — existing list, create dialog, editor unaffected)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MediaRecorder with MIME fallback chain (audio/webm;codecs=opus > audio/webm > audio/mp4)"
    - "Two-step mutation: transcribe audio then generate presentation in single mutationFn"
    - "D-06 additive prompt merge: [Audio input] + [Additional context] combined with newlines"
    - "Generator modal co-located in PresentationsSection — consistent with existing Dialog pattern"

key-files:
  created: []
  modified:
    - client/src/components/admin/PresentationsSection.tsx

key-decisions:
  - "GenerateModal co-located in PresentationsSection (not a separate file) — consistent with existing Dialog co-location pattern"
  - "generateMutation calls transcription then generation sequentially in single mutationFn — simpler UX than two separate user actions"
  - "Generate button disabled when no title OR when neither prompt nor audio is present — prevents empty generation"
  - "setSelectedId(result.id) in onSuccess navigates directly to editor — no intermediate confirmation"
  - "transcriptionPreview state shown in modal during generation — instant feedback that audio was processed"

requirements-completed: [PRES2-05, PRES2-06]

# Metrics
duration: ~2min
completed: 2026-05-16
---

# Phase 40 Plan 02: AI Presentation Generator — Frontend Modal Summary

**GenerateModal with MediaRecorder audio capture, D-06 merged prompt, and post-generation editor navigation added to PresentationsSection.tsx**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-16T01:58:25Z
- **Completed:** 2026-05-16T02:01:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `Sparkles`, `Mic`, `MicOff`, `StopCircle` icons to lucide-react import in `PresentationsSection.tsx`
- Added 7 generator modal state variables: `isGenerateOpen`, `genTitle`, `genPrompt`, `audioData`, `isRecording`, `transcriptionPreview`, plus `mediaRecorderRef` and `audioChunksRef` refs
- Added `startRecording()` with MIME fallback chain (audio/webm;codecs=opus → audio/webm → audio/mp4), `FileReader` base64 encoding on stop, and microphone-denied toast
- Added `stopRecording()` that calls `mediaRecorderRef.current?.stop()`
- Added `generateMutation` that: (1) conditionally transcribes audio via `POST /api/presentations/transcribe`, (2) builds D-06 merged prompt (`[Audio input]: ... \n\n[Additional context]: ...`), (3) calls `POST /api/presentations/generate`, (4) navigates admin to new presentation editor via `setSelectedId(result.id)`
- Added "Generate with AI" `<Button variant="outline">` with Sparkles icon before existing "New Presentation" button in SectionHeader action slot
- Added GenerateModal `<Dialog>` with title `<Input>`, context `<Textarea>`, record/stop audio `<Button>`, transcription preview `<p>`, and Generate `<Button>` disabled when no title or no content (prompt/audio)
- `npm run check` exits 0 — zero TypeScript errors

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Add GenerateModal to PresentationsSection.tsx | 2c63bb7 | client/src/components/admin/PresentationsSection.tsx (+173 lines) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both API endpoints (transcribe + generate) are fully implemented in Plan 40-01. The modal is fully wired to both endpoints. `setSelectedId(result.id)` navigates to the existing PresentationEditor component which was already functional.

## Self-Check: PASSED

- `client/src/components/admin/PresentationsSection.tsx` exists and contains all required patterns
- Commit 2c63bb7 exists in git log
- `npm run check` exits 0
- All acceptance criteria grep checks pass:
  - "Generate with AI" present at line 600
  - `isGenerateOpen` declared at line 253
  - `generateMutation` defined at line 386
  - `[Audio input]` D-06 format at line 399
  - `setSelectedId(result.id)` at line 420
  - `MediaRecorder.isTypeSupported` at lines 271/273
  - Generate disabled guard `!genTitle.trim()` at line 934
