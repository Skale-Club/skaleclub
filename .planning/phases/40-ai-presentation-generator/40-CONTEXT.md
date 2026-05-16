# Phase 40: AI Presentation Generator — Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an AI-powered presentation generator to the admin: a button that opens a modal with a text prompt field and an audio recording button. The combined input is sent to Gemini to generate a full slide deck from scratch. The public viewer gains per-slide controls (visible in edit mode only): delete individual slide, AI-redo single slide (Gemini regenerates it), and inline text edit for quick corrections.

</domain>

<decisions>
## Implementation Decisions

### Generator — Admin Entry Point
- **D-01:** A "Generate with AI" button is added to the header of `PresentationsSection.tsx` (alongside the existing "New Presentation" button).
- **D-02:** Clicking the button opens a modal/dialog with:
  - A text area for the context prompt (e.g. "Agency intro for a fintech client, 10 slides, formal tone")
  - An audio record button (browser MediaRecorder API) — replaces or supplements the text prompt
  - A title field for the new presentation
  - A "Generate" submit button
- **D-03:** Generation always creates a **new** presentation (never overwrites an existing one). After generation the admin is taken directly to the new presentation in the editor.

### Audio Input Flow
- **D-04:** Browser MediaRecorder records audio as WebM/Opus blob (native browser default, widest support).
- **D-05:** On stop: the blob is uploaded via `POST /api/presentations/transcribe` (multipart, admin-only). Server transcribes using Groq Whisper (`groq.audio.transcriptions.create`, model `whisper-large-v3`). Response: `{ transcription: string }`.
- **D-06:** Transcription is appended to the text prompt before generation: `[Audio input]: {transcription}\n\n[Additional context]: {textPrompt}`. If only audio provided, just the transcription is used.
- **D-07:** Audio and text inputs are additive — user can provide both, one, or the other.

### Generation Endpoint
- **D-08:** New endpoint: `POST /api/presentations/generate` (admin-only).
  - Body: `{ title: string, prompt: string }` — combined text+audio transcription already merged client-side
  - Response: `{ id: string, slug: string }` (the newly created presentation)
- **D-09:** Uses Gemini via `server/lib/gemini.ts` (OpenAI-compatible endpoint). Model: `gemini-2.0-flash` (fast for generation; configurable via env var `GEMINI_PRESENTATION_MODEL`).
- **D-10:** System prompt includes: slide layout guide, bilingual requirement (EN + pt-BR), brand guidelines from DB, and the new visual style fields from Phase 39 (bgColor, textColor, alignment, bgImageUrl). Gemini is instructed to use brand-coherent colors.
- **D-11:** Uses a `generate_slides` tool (same structure as `update_slides` in presentationsChat.ts but with all new Phase 39 fields included). Forces tool invocation (`tool_choice`).
- **D-12:** `max_tokens: 8192` — covers ~25 slides with full bilingual content.
- **D-13:** Zod-validates the returned slides before persisting. On validation failure: return 422 with the error detail.
- **D-14:** Creates the presentation in DB (`storage.createPresentation`) with the generated slides and a `guidelinesSnapshot` of the current brand guidelines.

### Per-Slide Viewer Controls (edit mode only)
- **D-15:** Per-slide controls are **only visible when `?edit=1` is in the URL**. Public viewers see no controls.
- **D-16:** Each slide shows a small floating toolbar in the top-right corner of the slide area (appears on hover or always visible in edit mode):
  - Trash icon → delete slide
  - Rotate/refresh icon → AI-redo (regenerate this single slide via Gemini)
  - Pencil icon → inline text edit
- **D-17:** **Delete slide:** Removes the slide from the array and calls `PUT /api/presentations/:id` to persist. No confirmation prompt (slides can be regenerated with AI-redo).
- **D-18:** **AI-redo single slide:** Calls `POST /api/presentations/:id/chat` (existing Claude endpoint) with a targeted instruction: `"Regenerate only slide at index N. Keep all other slides identical."`. The existing chat endpoint already supports this pattern (preserve-other-slides instruction).
  - Claude's discretion: alternatively, create a dedicated Gemini endpoint for per-slide redo if coherence with the generator is preferred. The existing chat endpoint is simpler.
- **D-19:** **Inline text edit:** Clicking pencil turns `heading` and `body` fields into contenteditable `div` elements within the slide. On blur or Enter: auto-saves via `PUT /api/presentations/:id`. Only heading and body are editable inline — complex fields (bullets, stats) require the JSON editor.

### Brand Color Injection
- **D-20:** At generation time, the server reads `brandGuidelines.content` and extracts/passes it to Gemini's system prompt in a structured format: "Brand colors and guidelines: {content}". Gemini is instructed to use these colors in `style.bgColor` and `style.headingColor` fields.

### Claude's Discretion
- Audio recording UI details (waveform visualizer, timer, stop/restart buttons): Claude decides based on shadcn/ui available components
- Modal vs. slide-out panel for the generator: Claude decides (modal preferred for simplicity)
- Exact Gemini model fallback behavior if API is unavailable: same pattern as blog generator (503 response with clear message)
- Whether AI-redo for a single slide uses the existing Claude endpoint or a new Gemini endpoint

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### AI Integration
- `server/routes/presentationsChat.ts` — Existing SSE chat endpoint; UPDATE_SLIDES_TOOL pattern; per-slide preserve logic
- `server/lib/gemini.ts` — Gemini via OpenAI-compatible client (use this for generator, not the Anthropic client)
- `server/lib/anthropic.ts` — Anthropic client (for AI-redo if reusing existing chat endpoint)

### Audio Transcription
- Groq SDK already installed (`groq-sdk` in package.json) — use `groq.audio.transcriptions.create` with `whisper-large-v3`
- Check `server/routes/` for existing Groq audio usage patterns

### Admin UI
- `client/src/components/admin/PresentationsSection.tsx` — Add "Generate with AI" button here; follow existing button+dialog patterns
- `client/src/pages/PresentationViewer.tsx` — Add per-slide edit controls here (in `?edit=1` mode)

### Schema (Phase 39 dependency)
- `shared/schema/presentations.ts` — Phase 40 depends on the extended SlideBlock schema from Phase 39 (new style fields, new layouts, all must be in the generator prompt)

### Storage Layer
- `server/storage.ts` — `createPresentation()` and `updatePresentation()` methods

### Brand Guidelines
- `server/routes/brandGuidelines.ts` — GET endpoint; storage method `getBrandGuidelines()`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `groq-sdk` (installed) — `groq.audio.transcriptions.create` for Whisper transcription; same pattern likely used in voice/chat features
- `server/lib/gemini.ts` — OpenAI-compatible Gemini client; use its `chat.completions.create` with tool_choice forced
- `UPDATE_SLIDES_TOOL` pattern (presentationsChat.ts) — replicate as `GENERATE_SLIDES_TOOL` for the generation endpoint
- `requireAdmin` middleware (`server/routes/_shared.ts`) — reuse for all new endpoints
- `storage.createPresentation()` — creation entry point; already handles versioning and slug

### Established Patterns
- SSE streaming: used in presentationsChat.ts — generation endpoint can use the same pattern or plain JSON (generation takes ~5-10s; SSE preferred for UX)
- Zod validation before DB write: mandatory per project pattern (PRES-12)
- `tool_choice: { type: "tool", name: "..." }` — forces tool invocation; same pattern works with Gemini via OpenAI SDK
- `guidelinesSnapshot` saved alongside slides on every write — generation endpoint must follow this pattern
- Dialog/modal pattern: used in PresentationsSection for "New Presentation" — reuse same Dialog component from shadcn/ui

### Integration Points
- `PresentationsSection.tsx` — header area gets "Generate with AI" button; existing list/editor state management
- `PresentationViewer.tsx` — `isEditMode` flag already computed; per-slide toolbar added inside the `SlideContent` wrapper in edit mode
- `App.tsx` route `/p/:slug` — no changes needed; `?edit=1` already handled

</code_context>

<specifics>
## Specific Ideas

- User specified both text field AND audio recording button as inputs for the generator — both must be present in the modal, not mutually exclusive
- "Botão de gerar apresentacao via IA" — it's a clear CTA button in the admin, prominent alongside New Presentation
- Audio: the user envisions speaking context about the presentation (e.g., describing a client, their needs, the agency's angle) — the transcription becomes the creative brief for Gemini
- Per-slide controls: delete, AI-redo, inline edit — all three confirmed by user
- Gemini specified as the AI provider for the generator (not Claude/Anthropic)

</specifics>

<deferred>
## Deferred Ideas

- Real-time streaming of slide generation progress (slide-by-slide SSE) — deferred; single response with all slides is simpler
- Gallery/template system for starting presentations — deferred
- Bulk regeneration (regenerate all slides) — covered by generator button creating a new presentation
- Slide reordering via drag-and-drop in viewer — deferred to future phase
- Per-slide AI-redo using Gemini specifically (vs. reusing existing Claude endpoint) — Claude's discretion

</deferred>

---

*Phase: 40-ai-presentation-generator*
*Context gathered: 2026-05-15*
