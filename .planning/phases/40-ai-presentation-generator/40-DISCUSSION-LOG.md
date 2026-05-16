# Phase 40: AI Presentation Generator — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 40-ai-presentation-generator
**Areas discussed:** Generator UI, Audio input, Per-slide controls

---

## Generator UI Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| Button in PresentationsSection header | Alongside "New Presentation" | ✓ (Claude's choice) |
| Inline panel within existing editor | | |
| Separate page | | |

**User's choice:** "Do recommended." → Claude chose header button + modal.

---

## Audio Input Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Browser MediaRecorder → Groq Whisper | Existing SDK, transcription appended to prompt | ✓ (Claude's choice) |
| Server-side recording | Not applicable for browser | |
| External service | Unnecessary; Groq already installed | |

**User's pre-decision:** "Also a button to record audio for inputs that will be used to generate this presentation."
**Claude's choice:** MediaRecorder → upload blob → Groq Whisper transcription → append to text prompt.

---

## Per-Slide Viewer Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Edit mode only (?edit=1) | Controls only visible to admin in edit mode | ✓ (Claude's choice) |
| Always visible for authenticated admin | Admin auth check in viewer | |
| New admin-only viewer route | Separate URL | |

**Controls confirmed by user:** Delete slide, AI-redo single slide, inline text edit.
**Claude's choices:**
- Edit mode only (no auth check needed in public viewer)
- Small floating toolbar per slide (top-right corner, on hover)
- AI-redo reuses existing POST /api/presentations/:id/chat endpoint
- Inline edit: only heading and body fields (contenteditable)

---

## Claude's Discretion

- Modal vs. slide-out panel for generator UI (Claude chose modal)
- Audio recording UI details (waveform, timer, stop button)
- Exact Gemini model + fallback error handling
- Whether AI-redo uses Claude or Gemini endpoint
- SSE vs. plain JSON for generation response

## Deferred Ideas

- Real-time per-slide streaming during generation
- Template gallery / starter presentations
- Slide reordering in viewer
- Bulk slide regeneration
