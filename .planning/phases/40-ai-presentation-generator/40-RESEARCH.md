# Phase 40: AI Presentation Generator — Research

**Researched:** 2026-05-15
**Domain:** AI generation (Gemini), audio transcription (Groq Whisper), browser MediaRecorder, per-slide viewer controls
**Confidence:** HIGH — all findings verified against actual project source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01: "Generate with AI" button in `PresentationsSection.tsx` header (alongside "New Presentation")
- D-02: Modal with title field + text area + audio record button + "Generate" submit
- D-03: Generation always creates a new presentation; redirect admin to new presentation editor after
- D-04: Browser MediaRecorder records WebM/Opus blob
- D-05: POST /api/presentations/transcribe (multipart, admin-only) → Groq Whisper whisper-large-v3 → `{ transcription: string }`
- D-06: Combined prompt format: `[Audio input]: {transcription}\n\n[Additional context]: {textPrompt}`
- D-07: Text and audio inputs are additive — both, one, or neither
- D-08: POST /api/presentations/generate (admin-only); body: `{ title, prompt }`; response: `{ id, slug }`
- D-09: Gemini via `server/lib/gemini.ts`; model: `gemini-2.0-flash`; env var: `GEMINI_PRESENTATION_MODEL`
- D-10: System prompt includes slide layout guide, bilingual requirement, brand guidelines, Phase 39 style fields
- D-11: `generate_slides` tool (mirrors `update_slides` but with all Phase 39 style fields); `tool_choice` forced
- D-12: max_tokens: 8192 (covers ~25 slides with bilingual content)
- D-13: Zod validation before DB write; return 422 on validation failure
- D-14: createPresentation with generated slides + guidelinesSnapshot
- D-15: Per-slide controls visible only when `?edit=1` is in URL
- D-16: Floating toolbar per slide: Trash (delete), Rotate (AI-redo), Pencil (inline edit)
- D-17: Delete slide: remove from array + PUT /api/presentations/:id to persist; no confirmation
- D-18: AI-redo: POST /api/presentations/:id/chat with targeted instruction (existing Claude endpoint); per-context: Claude's discretion to use Gemini endpoint instead
- D-19: Inline text edit: contenteditable on heading/body; auto-save on blur/Enter via PUT /api/presentations/:id
- D-20: Brand guidelines content passed to Gemini system prompt: "Brand colors and guidelines: {content}"

### Claude's Discretion

- Audio recording UI details (waveform visualizer, timer, stop/restart buttons)
- Modal vs. slide-out panel for generator (modal preferred per context)
- Exact Gemini API fallback behavior if unavailable (503 pattern from blog generator)
- Whether AI-redo for single slide uses existing Claude endpoint or new Gemini endpoint

### Deferred Ideas (OUT OF SCOPE)

- Real-time streaming of slide generation progress (slide-by-slide SSE)
- Gallery/template system for starting presentations
- Bulk regeneration (covered by generator button creating a new presentation)
- Slide reordering via drag-and-drop in viewer
- Per-slide AI-redo using Gemini specifically (vs. reusing existing Claude endpoint)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRES2-05 | "Generate with AI" button in admin opens a modal; accepts title + text prompt | Generator modal pattern from PresentationsSection Dialog; createMutation pattern reused |
| PRES2-06 | Audio recording in modal; browser MediaRecorder → Groq Whisper transcription | visits.ts Groq pattern confirmed; base64 JSON body (no multer needed); getRuntimeGroqKey() pattern |
| PRES2-07 | POST /api/presentations/generate endpoint; Gemini tool-forced; creates new presentation | gemini.ts + presentationsChat.ts UPDATE_SLIDES_TOOL pattern confirmed as basis for GENERATE_SLIDES_TOOL |
| PRES2-08 | Per-slide viewer toolbar (edit mode only): delete, AI-redo, inline edit | isEditMode already computed in PresentationViewer.tsx; PUT /api/presentations/:id already handles partial slides update |
| PRES2-09 | Inline text edit auto-saves on blur/Enter via PUT /api/presentations/:id | updatePresentation accepts Partial<InsertPresentation>; guidelinesSnapshot preserved via partial update |
</phase_requirements>

---

## Summary

Phase 40 adds two independent capability groups to the existing presentation system: (1) an AI generator that creates full slide decks from a combined text+audio prompt using Gemini, and (2) per-slide editing controls in the public viewer when in edit mode. Both groups build on heavily established patterns already in the codebase.

The generator endpoint (`POST /api/presentations/generate`) follows the `presentationsChat.ts` pattern exactly — load brand guidelines from DB, build a system prompt, call Gemini via `getGeminiClient()` with a forced tool call (`tool_choice`), Zod-validate the result, then persist with `storage.createPresentation()`. The GENERATE_SLIDES_TOOL is a copy of the existing UPDATE_SLIDES_TOOL (already including all Phase 39 style fields) with the description changed to reflect "from scratch" generation. The audio transcription endpoint (`POST /api/presentations/transcribe`) follows the Xpot visits.ts Groq pattern — base64-encoded audio in JSON body, `groq.audio.transcriptions.create`, return transcription string.

Per-slide viewer controls require the least server work: delete is a PUT /api/presentations/:id with the modified slides array (same route already exists and supports partial updates); AI-redo reuses the existing `/api/presentations/:id/chat` endpoint; inline edit uses contenteditable divs in the viewer with blur/Enter auto-save. The `isEditMode` flag is already computed in PresentationViewer.tsx at line 311.

**Primary recommendation:** Implement in three plans — (1) generator backend (transcribe + generate endpoints), (2) generator modal UI in PresentationsSection, (3) per-slide viewer controls. Plans 1 and 2 can be sequential; plan 3 is independent.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| groq-sdk | ^1.1.2 | Groq Whisper audio transcription | Installed, verified in package.json |
| openai | ^4.104.0 | Gemini OpenAI-compatible client (via `getGeminiClient`) | Installed |
| zod | ^3.24.2 | Slide output validation before DB write | Installed |
| lucide-react | ^0.453.0 | Trash2, RefreshCw, Pencil icons for per-slide toolbar | Installed |
| framer-motion | ^11.18.2 | Slide animations already in viewer | Installed |

No new npm dependencies required for this phase.

**Installation:** None needed.

---

## Architecture Patterns

### Pattern 1: Groq Whisper Transcription (base64 JSON body)

**Source:** `server/routes/xpot/visits.ts` lines 213–263

The project does NOT use multipart/form-data for audio. Audio is sent as base64 in a JSON body:

```typescript
// Client sends:
{ audioData: "data:audio/webm;base64,..." }

// Server decodes:
const base64Data = audioData.replace(/^data:audio\/\w+;base64,/, "");
const buffer = Buffer.from(base64Data, "base64");

// Groq transcription:
const Groq = (await import("groq-sdk")).default;  // dynamic import
const groq = new Groq({ apiKey: groqApiKey });
const file = new File([buffer], filename, { type: "audio/webm" });
const transcription = await groq.audio.transcriptions.create({
  file,
  model: "whisper-large-v3-turbo",
  response_format: "text",
});
const text = (transcription as unknown as string).trim() || null;
```

**Key detail:** The Groq SDK transcription with `response_format: "text"` returns a plain string, not an object — cast as `unknown as string` is required.

**D-05 uses `whisper-large-v3`** (not `whisper-large-v3-turbo`). Either works; use whichever the decision specifies. The visits.ts pattern uses `whisper-large-v3-turbo`. For the new transcribe endpoint, honor D-05: `whisper-large-v3`.

**API key resolution:** Follow the existing pattern from `server/lib/ai-provider.ts`:
```typescript
const groqIntegration = await storage.getChatIntegration("groq");
const groqApiKey = getRuntimeGroqKey() || groqIntegration?.apiKey;
if (!groqApiKey) return res.status(503).json({ message: "Groq API key not configured" });
```

### Pattern 2: Gemini Tool-Forced Generation

**Source:** `server/lib/gemini.ts` + `server/routes/presentationsChat.ts`

`getGeminiClient(apiKey)` returns an `OpenAI` instance pointed at Gemini's OpenAI-compatible endpoint. The same `tool_choice: { type: "tool", name: "..." }` pattern used with Anthropic works identically with this client:

```typescript
import { getGeminiClient } from "../lib/gemini.js";

// API key resolution (mirrors ai-provider.ts Gemini block):
const geminiIntegration = await storage.getChatIntegration("gemini");
const apiKey =
  process.env.GEMINI_PRESENTATION_MODEL  // note: this is the MODEL env var
  // actual key env var:
  getRuntimeGeminiKey() || process.env.GEMINI_API_KEY || geminiIntegration?.apiKey;
if (!apiKey) return res.status(503).json({ message: "Gemini API key not configured" });

const model = process.env.GEMINI_PRESENTATION_MODEL || "gemini-2.0-flash";
const client = getGeminiClient(apiKey);

const response = await client.chat.completions.create({
  model,
  max_tokens: 8192,
  messages: [
    { role: "system", content: buildGeneratorSystemPrompt(guidelines) },
    { role: "user", content: prompt },
  ],
  tools: [GENERATE_SLIDES_TOOL],
  tool_choice: { type: "function", function: { name: "generate_slides" } },
});
```

**Critical difference from Anthropic:** OpenAI-compatible tool_choice format is `{ type: "function", function: { name: "..." } }`, NOT `{ type: "tool", name: "..." }`. The presentationsChat.ts uses Anthropic SDK format. For the Gemini/OpenAI-compatible client, use OpenAI format.

**Extracting tool result from OpenAI-compat response:**
```typescript
const toolCall = response.choices[0]?.message?.tool_calls?.[0];
if (!toolCall || toolCall.type !== "function") {
  return res.status(500).json({ message: "Gemini did not invoke the generate_slides tool" });
}
const rawInput = JSON.parse(toolCall.function.arguments);
const validation = z.array(slideBlockSchema).safeParse(rawInput.slides);
```

### Pattern 3: GENERATE_SLIDES_TOOL Definition

The `UPDATE_SLIDES_TOOL` in `presentationsChat.ts` already includes all Phase 39 style fields (`bgColor`, `textColor`, `headingColor`, `alignment`, `bgImageUrl`, `bgVideoUrl`, `attribution`, `attributionPt`, `image-left`, `image-right`, `full-bleed-image`, `quote` layouts). The GENERATE_SLIDES_TOOL is a verbatim copy with description changed to reflect from-scratch generation:

```typescript
// In server/routes/presentationsGenerator.ts (new file)
const GENERATE_SLIDES_TOOL = {
  type: "function" as const,
  function: {
    name: "generate_slides",
    description:
      "Generate a complete slide deck from scratch based on the provided context. " +
      "Populate bilingual fields (headingPt, bodyPt, bulletsPt) with Portuguese (pt-BR). " +
      "Use brand-coherent colors in style.bgColor and style.headingColor. " +
      "Return ALL slides for the complete presentation.",
    parameters: {
      type: "object",
      required: ["slides"],
      properties: {
        slides: {
          type: "array",
          items: { /* identical to UPDATE_SLIDES_TOOL items schema */ }
        }
      }
    }
  }
};
```

Note: OpenAI-compatible tool format wraps in `{ type: "function", function: { name, description, parameters } }`, not the Anthropic `{ name, description, input_schema }` shape.

### Pattern 4: Route Registration

New routes go in a new file `server/routes/presentationsGenerator.ts`, exported as `registerPresentationsGeneratorRoutes`. Register it in `server/routes.ts` alongside the other presentations routes:

```typescript
// server/routes.ts (addition)
import { registerPresentationsGeneratorRoutes } from "./routes/presentationsGenerator.js";
// ...
registerPresentationsGeneratorRoutes(app);
```

Register AFTER `registerPresentationsRoutes` to avoid route prefix conflicts. The literal-path `"/api/presentations/transcribe"` and `"/api/presentations/generate"` must be registered BEFORE `"/api/presentations/:id"` in any single router file, or in a separate file to avoid Express wildcard matching issues. The existing codebase already handles this concern (see `presentations.ts` line 44: literal `/api/presentations/slug/:slug` registered first).

### Pattern 5: createPresentation for Generated Presentation

```typescript
const slug = await buildUniquePresentationSlug(title);  // reuse from presentations.ts
const presentation = await storage.createPresentation({
  title,
  slug,
  slides: validation.data,
  guidelinesSnapshot: guidelines,
});
res.json({ id: presentation.id, slug: presentation.slug });
```

`buildUniquePresentationSlug` is a local function in `presentations.ts` — it must be extracted or duplicated in the generator file. Best approach: move it to a shared helper or duplicate it (the function is 8 lines).

### Pattern 6: Per-Slide Toolbar in PresentationViewer

`isEditMode` is already computed at line 311:
```typescript
const isEditMode = new URLSearchParams(window.location.search).has('edit');
```

The floating toolbar should appear inside the `AnimatePresence` / `motion.div` wrapping the current slide, conditionally on `isEditMode`. It must be positioned `absolute top-2 right-2 z-50` within the slide's relative container:

```tsx
{isEditMode && (
  <div className="absolute top-2 right-2 z-50 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
    <button onClick={() => handleDeleteSlide(currentIndex)} title="Delete slide">
      <Trash2 className="w-4 h-4" />
    </button>
    <button onClick={() => handleRedoSlide(currentIndex)} title="AI redo">
      <RefreshCw className="w-4 h-4" />
    </button>
    <button onClick={() => setInlineEditIndex(currentIndex)} title="Edit text">
      <Pencil className="w-4 h-4" />
    </button>
  </div>
)}
```

**Delete handler:** Calls `PUT /api/presentations/:id` with `slides: currentSlides.filter((_, i) => i !== index)`.

**AI-redo handler:** Calls `POST /api/presentations/:id/chat` with message `"Regenerate only slide at index ${index}. Keep all other slides identical."` — the existing endpoint handles this via the current slides context injection at line 131.

**Inline edit:** Set a `contentEditable` div for heading/body of the current slide; on blur/Enter, update the slides array and call PUT. Only `heading`/`body` fields (English) are contenteditable inline.

### Pattern 7: Browser MediaRecorder API

The browser MediaRecorder API (no npm package needed) records audio:

```typescript
// Start recording
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
const chunks: BlobPart[] = [];
recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  // Convert to base64 for JSON body:
  const reader = new FileReader();
  reader.onloadend = () => {
    const base64 = reader.result as string; // includes data:audio/webm;base64,... prefix
    setAudioData(base64);
  };
  reader.readAsDataURL(blob);
  stream.getTracks().forEach(t => t.stop());
};
recorder.start();
```

`mimeType` fallback: `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')` — use plain `'audio/webm'` as fallback if Opus not supported.

### Anti-Patterns to Avoid

- **Using multipart form data for audio:** The project sends base64 audio as JSON. `app.ts` already has `express.json({ limit: '50mb' })` — a 1-minute WebM recording is ~500KB base64 which fits comfortably.
- **Using Anthropic tool_choice format with Gemini/OpenAI client:** The OpenAI SDK expects `{ type: "function", function: { name } }`, not `{ type: "tool", name }`.
- **Extracting tool result via `finalMessage()`:** That's the Anthropic streaming API. With `getGeminiClient`, use plain `chat.completions.create` (not streaming) and read `response.choices[0].message.tool_calls[0].function.arguments`.
- **SSE for the generator:** D-deferred (single JSON response chosen). Do NOT add SSE to the generate endpoint. Return JSON directly.
- **Placing literal routes after wildcard routes:** `POST /api/presentations/transcribe` and `POST /api/presentations/generate` must be registered BEFORE `POST /api/presentations/:id` routes. Using a separate file sidesteps this entirely.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gemini API client | Custom fetch wrapper | `getGeminiClient()` from `server/lib/gemini.ts` | Already handles base URL, auth, OpenAI compat |
| Groq transcription | Custom audio API call | `groq.audio.transcriptions.create` | SDK handles multipart binary correctly |
| Slug uniqueness | Custom collision check | `buildUniquePresentationSlug()` from `presentations.ts` | Has 5-attempt loop + timestamp fallback |
| Admin auth | Custom session check | `requireAdmin` from `server/routes/_shared.ts` | Checks session + DB isAdmin flag |
| Groq key lookup | Custom env access | `getRuntimeGroqKey()` from `server/lib/ai-provider.ts` | Handles runtime key cache + DB fallback |
| Gemini key lookup | Custom env access | `getRuntimeGeminiKey()` + `process.env.GEMINI_API_KEY` | Mirrors ai-provider.ts pattern |

**Key insight:** All infrastructure is already present. This phase is purely additive.

---

## Common Pitfalls

### Pitfall 1: OpenAI-compat vs. Anthropic Tool Format

**What goes wrong:** `tool_choice: { type: "tool", name: "generate_slides" }` is the Anthropic SDK format. With `getGeminiClient()` (which returns an `OpenAI` instance), this must be `{ type: "function", function: { name: "generate_slides" } }`.

**Why it happens:** `presentationsChat.ts` uses Anthropic's streaming API; `gemini.ts` uses the OpenAI SDK. Different tool invocation schemas.

**How to avoid:** Use OpenAI tool_choice format for all Gemini calls. Also the tool definition shape differs: OpenAI uses `{ type: "function", function: { name, description, parameters } }` vs. Anthropic's `{ name, description, input_schema }`.

**How to extract result:** `response.choices[0].message.tool_calls[0].function.arguments` (string, must be JSON.parsed).

### Pitfall 2: Groq Key Resolution

**What goes wrong:** Using only `process.env.GROQ_API_KEY` — the project stores the key in the DB via `chat_integrations` table and a runtime cache (`getRuntimeGroqKey()`).

**How to avoid:** Always resolve: `getRuntimeGroqKey() || (await storage.getChatIntegration("groq"))?.apiKey`.

### Pitfall 3: Route Order for Literal Paths

**What goes wrong:** Registering `POST /api/presentations/:id/...` before `POST /api/presentations/generate` causes Express to match "generate" as an `:id` parameter.

**How to avoid:** Put the generator routes in a separate file `presentationsGenerator.ts`, registered in `routes.ts` BEFORE or use literal paths that clearly don't match UUID patterns. Since "generate" and "transcribe" are not UUID strings, Express will still match them to a UUID-parameterized route if the UUID route is registered first. Use a separate file to avoid ambiguity.

### Pitfall 4: MediaRecorder MIME type on Safari

**What goes wrong:** `audio/webm;codecs=opus` is not supported on Safari (iOS/macOS). Safari supports `audio/mp4`.

**How to avoid:** Check support before starting: `MediaRecorder.isTypeSupported(mimeType)`. Fallback chain: `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4`. Groq Whisper accepts all three formats.

### Pitfall 5: guidelinesSnapshot Must Be Included on Create

**What goes wrong:** `storage.createPresentation()` accepts `InsertPresentation` which includes `guidelinesSnapshot` (it maps to the `guidelines_snapshot` column). If omitted, the DB stores NULL and the viewer lacks the snapshot for display.

**How to avoid:** Always pass `guidelinesSnapshot: guidelines` in the `createPresentation` call. Check: `insertPresentationSchema` does NOT include `guidelinesSnapshot` in its Zod definition — pass it directly to the storage method as raw data, not through the Zod schema. The storage method signature is `createPresentation(data: InsertPresentation)` and `InsertPresentation` is `typeof presentations.$inferInsert` which includes all columns including `guidelinesSnapshot`.

### Pitfall 6: contenteditable Auto-Save Loop

**What goes wrong:** When the inline edit saves on blur, which triggers a query refetch, which re-renders the component, which blurs the field again — an infinite loop.

**How to avoid:** Keep local state for the inline-edited content. Only call the PUT on Enter keydown or when the field loses focus to a different element (not a re-render). Debounce or use a `hasPendingSave` guard.

### Pitfall 7: Viewer Slide Array Mutation After Delete

**What goes wrong:** After deleting a slide, `activeIndex` may point past the end of the new array if the last slide was deleted.

**How to avoid:** After delete, clamp the new index: `setActiveIndex(Math.min(activeIndex, newSlides.length - 1))`. The viewer already has this guard at line 381-384 but it's driven by a `total` change from server; local optimistic update must apply it immediately.

---

## Code Examples

### Transcription Endpoint Pattern

```typescript
// server/routes/presentationsGenerator.ts
// Source: server/routes/xpot/visits.ts (pattern), D-05

const transcribeBodySchema = z.object({
  audioData: z.string().min(1),  // base64 data URL
});

app.post("/api/presentations/transcribe", requireAdmin, async (req, res) => {
  const parsed = transcribeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "audioData is required" });
  }

  const groqIntegration = await storage.getChatIntegration("groq");
  const groqApiKey = getRuntimeGroqKey() || groqIntegration?.apiKey;
  if (!groqApiKey) {
    return res.status(503).json({ message: "Groq API not configured — set GROQ_API_KEY or configure in admin" });
  }

  const base64Data = parsed.data.audioData.replace(/^data:audio\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  const Groq = (await import("groq-sdk")).default;
  const groq = new Groq({ apiKey: groqApiKey });
  const file = new File([buffer], `prompt_${Date.now()}.webm`, { type: "audio/webm" });
  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: "text",
  });
  const text = (transcription as unknown as string).trim();
  res.json({ transcription: text });
});
```

### Generator Endpoint Pattern

```typescript
// server/routes/presentationsGenerator.ts
// Source: presentationsChat.ts (pattern), D-08–D-14

const generateBodySchema = z.object({
  title: z.string().min(1).max(200),
  prompt: z.string().min(1).max(8000),
});

app.post("/api/presentations/generate", requireAdmin, async (req, res) => {
  const parsed = generateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "title and prompt are required" });
  }

  const geminiIntegration = await storage.getChatIntegration("gemini");
  const apiKey = getRuntimeGeminiKey() || process.env.GEMINI_API_KEY || geminiIntegration?.apiKey;
  if (!apiKey) {
    return res.status(503).json({ message: "Gemini API not configured — set GEMINI_API_KEY" });
  }

  const model = process.env.GEMINI_PRESENTATION_MODEL || "gemini-2.0-flash";
  const guidelinesRow = await storage.getBrandGuidelines();
  const guidelines = guidelinesRow?.content ?? "";

  const client = getGeminiClient(apiKey);
  const response = await client.chat.completions.create({
    model,
    max_tokens: 8192,
    messages: [
      { role: "system", content: buildGeneratorSystemPrompt(guidelines) },
      { role: "user", content: parsed.data.prompt },
    ],
    tools: [GENERATE_SLIDES_TOOL],
    tool_choice: { type: "function", function: { name: "generate_slides" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") {
    return res.status(500).json({ message: "Gemini did not invoke the generate_slides tool" });
  }

  const rawInput = JSON.parse(toolCall.function.arguments);
  const validation = z.array(slideBlockSchema).safeParse(rawInput.slides);
  if (!validation.success) {
    return res.status(422).json({ message: "Generated slides failed validation", errors: validation.error.errors });
  }

  const slug = await buildUniquePresentationSlug(parsed.data.title);
  const presentation = await storage.createPresentation({
    title: parsed.data.title,
    slug,
    slides: validation.data,
    guidelinesSnapshot: guidelines,
  });

  res.status(201).json({ id: presentation.id, slug: presentation.slug });
});
```

### Generator Modal State (PresentationsSection)

```typescript
// State additions to PresentationsSection:
const [isGenerateOpen, setIsGenerateOpen] = useState(false);
const [genTitle, setGenTitle] = useState('');
const [genPrompt, setGenPrompt] = useState('');
const [audioData, setAudioData] = useState<string | null>(null);
const [isRecording, setIsRecording] = useState(false);

// After generation succeeds:
// 1. queryClient.invalidateQueries({ queryKey: ['/api/presentations'] })
// 2. setSelectedId(result.id)  — navigates to editor
// 3. Close modal

const generateMutation = useMutation({
  mutationFn: async () => {
    // 1. Transcribe audio if present
    let transcription = '';
    if (audioData) {
      const transcribeRes = await apiRequest('POST', '/api/presentations/transcribe', { audioData });
      const transcribeData = await transcribeRes.json();
      transcription = transcribeData.transcription || '';
    }
    // 2. Build merged prompt (D-06)
    const mergedPrompt = transcription && genPrompt
      ? `[Audio input]: ${transcription}\n\n[Additional context]: ${genPrompt}`
      : transcription || genPrompt;
    // 3. Generate
    const res = await apiRequest('POST', '/api/presentations/generate', {
      title: genTitle.trim(),
      prompt: mergedPrompt,
    });
    return res.json() as Promise<{ id: string; slug: string }>;
  },
  onSuccess: (result) => {
    queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
    setIsGenerateOpen(false);
    setGenTitle(''); setGenPrompt(''); setAudioData(null);
    setSelectedId(result.id);
  },
});
```

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|-------------|-----------|-------|
| groq-sdk | Whisper transcription | Yes | `^1.1.2` in package.json |
| openai SDK | Gemini via getGeminiClient | Yes | `^4.104.0` in package.json |
| GEMINI_API_KEY env var | Generator endpoint | Assumed — already used by ai-provider | Check admin Gemini integration for key presence |
| GROQ_API_KEY / groq DB integration | Transcription endpoint | Assumed — Groq integration routes exist | Admin can configure via `/api/integrations/groq` |
| Browser MediaRecorder API | Audio recording in modal | Modern browsers (Chrome, Firefox, Edge) — Safari needs mp4 fallback | No additional deps needed |

**Missing dependencies with no fallback:** None — all required SDKs installed.

**Missing dependencies with fallback:** Safari MediaRecorder (`audio/mp4` fallback needed).

---

## Validation Architecture

Per `CLAUDE.md`: No test framework available — manual QA only.

**Manual QA checklist for this phase:**
1. Open admin → Presentations → click "Generate with AI" → modal opens
2. Enter title + text prompt → click Generate → loading state → redirected to new presentation in editor
3. Record audio → stop → transcription merges with text prompt → generation works
4. Open generated presentation at `/p/:slug?edit=1` → floating toolbar visible on hover
5. Delete a slide → slide removed, `PUT /api/presentations/:id` called, activeIndex clamped
6. Click AI-redo on a slide → chat endpoint called with targeted instruction → slide replaced
7. Click pencil on a slide → heading/body become contenteditable → edit heading → blur → auto-save triggered
8. Open same presentation at `/p/:slug` (no `?edit=1`) → no toolbar visible

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Hand-built Gemini fetch | OpenAI SDK with `getGeminiClient()` base URL redirect | Already in use since Phase 22; no change needed |
| Multipart audio upload | Base64 JSON body | Simpler for Vercel serverless; already established pattern |
| Anthropic tool_choice format | OpenAI SDK tool_choice format | Different shape — critical for the generator endpoint |

---

## Open Questions

1. **`buildUniquePresentationSlug` location**
   - What we know: Currently a private function in `presentations.ts`
   - What's unclear: Whether to duplicate in `presentationsGenerator.ts` or extract to a shared util
   - Recommendation: Duplicate the 8-line function directly in the new file — keeps the file self-contained without requiring a refactor of `presentations.ts`

2. **Gemini tool_choice exact syntax verification**
   - What we know: OpenAI SDK format is `{ type: "function", function: { name } }` per OpenAI docs; Gemini's OpenAI-compatible endpoint accepts this
   - What's unclear: Whether Gemini's implementation of `tool_choice` is 100% spec-compliant for this exact format
   - Recommendation: Test with a real API call in Wave 0. Fallback: pass `tool_choice: "required"` which forces any tool invocation, then check the returned tool name.

3. **How to pass `guidelinesSnapshot` to `createPresentation`**
   - What we know: `insertPresentationSchema` (Zod) does NOT include `guidelinesSnapshot`; `InsertPresentation` (Drizzle $inferInsert) does include it
   - What's unclear: Whether `storage.createPresentation(data: InsertPresentation)` accepts it directly without Zod validation
   - Recommendation: Pass it directly to the storage method without going through insertPresentationSchema — the storage layer takes `InsertPresentation`, not the Zod schema type.

---

## Sources

### Primary (HIGH confidence)
- `server/routes/presentationsChat.ts` — UPDATE_SLIDES_TOOL pattern, Anthropic tool invocation, SSE architecture
- `server/routes/xpot/visits.ts` lines 244–263 — Groq Whisper transcription pattern (audio/webm base64 JSON body, whisper-large-v3-turbo)
- `server/lib/gemini.ts` — `getGeminiClient()` implementation, base URL
- `server/lib/ai-provider.ts` — `getRuntimeGroqKey()`, `getRuntimeGeminiKey()`, Gemini key resolution chain
- `shared/schema/presentations.ts` — slideBlockSchema with Phase 39 style fields, InsertPresentation type
- `client/src/components/admin/PresentationsSection.tsx` — Dialog/modal pattern, createMutation pattern, selectedId state
- `client/src/pages/PresentationViewer.tsx` — isEditMode, activeIndex, goTo, PUT integration points
- `server/routes/presentations.ts` — buildUniquePresentationSlug, createPresentation call pattern, guidelinesSnapshot handling
- `server/routes/brandGuidelines.ts` — `storage.getBrandGuidelines()` usage
- `server/app.ts` — `express.json({ limit: '50mb' })` confirms base64 JSON body approach is valid
- `server/routes.ts` — route registration order pattern
- `package.json` — groq-sdk ^1.1.2 and openai ^4.104.0 confirmed installed

### Secondary (MEDIUM confidence)
- OpenAI SDK documentation: `tool_choice: { type: "function", function: { name } }` format for forced tool invocation (consistent with Gemini's OpenAI-compat endpoint behavior observed in `integrations.ts` test calls)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified all deps in package.json
- Architecture: HIGH — patterns sourced directly from project source files
- Pitfalls: HIGH — derived from actual code reading (Anthropic vs. OpenAI tool format difference is the single highest-risk item)
- Browser MediaRecorder: MEDIUM — standard Web API, Safari caveat well-known

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (stable codebase, no fast-moving deps)
