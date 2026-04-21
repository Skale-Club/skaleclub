# Stack Research — Admin Presentations Page (v1.4)

**Domain:** AI-authored bilingual slide decks with fullscreen public viewer
**Researched:** 2026-04-20
**Confidence:** HIGH — verified against npm registry, existing codebase, Anthropic SDK docs

---

## Context: What Already Exists

This milestone builds on a fully wired stack. Before listing additions, here is what the
codebase already provides:

| Capability | How it exists |
|---|---|
| AI calls (OpenAI/Groq/OpenRouter) | `server/lib/ai-provider.ts`, `openai` ^4.104.0 |
| Fullscreen scroll-snap viewer | `EstimateViewer.tsx` — `snap-y snap-mandatory`, framer-motion |
| JSONB snapshot storage | `estimates` table pattern, Drizzle `jsonb().$type<T>()` |
| Supabase asset uploads | `uploadLinksPageAsset` in `server/routes/uploads.ts` |
| Admin chat UI shell | `ChatSection.tsx` — message list, input, streaming-ready layout |
| i18n layer | `useTranslation` + `client/src/lib/translations.ts` |
| Markdown rendering | `client/src/lib/markdown.tsx` — inline bold/italic/code/links |
| Tailwind typography plugin | `@tailwindcss/typography` 0.5.15 already in `tailwind.config.ts` |
| Drag-reorder | `@dnd-kit/sortable` ^10.0.0 already installed |
| shadcn/ui primitives | All Radix-backed components already installed |

---

## New Dependencies Required

### 1. Claude API — Streaming Text Generation (server-side)

**Package:** `@anthropic-ai/sdk`
**Version:** `^0.90.0` (latest as of 2026-04-20, verified via npm registry)
**Install:** `npm install @anthropic-ai/sdk`

**Why this instead of routing through the existing `openai` client pointing at OpenRouter:**
The presentations feature uses Claude as a *dedicated, opinionated authoring tool* — brand
guidelines injected as a system prompt, structured JSON output enforced via tool calls or
guided generation, and a specific model selection (claude-sonnet-4-5 or claude-opus-4 for
quality). Routing through OpenRouter would work for basic inference but loses
`client.messages.stream()` helper ergonomics that give `.on('text', cb)` event emitters and
`.finalMessage()` — the cleanest path to SSE relay in Express without managing raw chunk
parsing. The native SDK also makes tool-call / structured output patterns significantly
easier to implement reliably.

**Streaming API surface used:**

```typescript
// server side — relay to client via SSE
const stream = anthropic.messages.stream({
  model: "claude-sonnet-4-5",
  max_tokens: 4096,
  system: brandGuidelinesPrompt,
  messages: conversationHistory,
});

res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");

for await (const event of stream) {
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
  }
}
res.write("data: [DONE]\n\n");
res.end();
```

**Client side — consume SSE with native `EventSource` (no extra library):**

```typescript
const es = new EventSource("/api/presentations/chat");
es.onmessage = (e) => {
  if (e.data === "[DONE]") { es.close(); return; }
  const { text } = JSON.parse(e.data);
  setStreamingBuffer(prev => prev + text);
};
```

The `EventSource` API is native to browsers. No client-side SSE library needed.

---

### 2. Markdown Rendering in Slide Body (client-side)

**Package:** `react-markdown`
**Version:** `^10.1.0` (latest as of 2026-04-20, verified via npm registry)
**Install:** `npm install react-markdown`

**Why:** Claude's slide body text will include markdown formatting — headings, bold, bullet
lists, emphasis. The existing `client/src/lib/markdown.tsx` is a hand-rolled inline-only
parser that handles `**bold**`, `*italic*`, `` `code` ``, and links. It explicitly does NOT
handle headings (`# H1`) or nested block-level elements. Slide body content will require
full block markdown. `react-markdown` is the standard React ecosystem choice, processes a
superset of what the hand-rolled parser does, and integrates with Tailwind's existing
`prose` class (the `@tailwindcss/typography` plugin is already installed).

**Key integration point:** wrap slide body rendering in `<ReactMarkdown className="prose prose-invert prose-sm max-w-none">`. No additional class configuration needed since the typography plugin is already present in `tailwind.config.ts`.

**Companion package:** `remark-gfm`
**Version:** `^4.0.1` (latest, verified npm registry)
**Install:** `npm install remark-gfm`

**Why:** Adds GitHub-Flavored Markdown support — tables, strikethrough, task lists. Claude
will naturally emit GFM syntax in structured content. Without this plugin, table syntax
in slide bodies renders as broken text.

---

### 3. No Syntax Highlighting Library Needed

Slide content is narrative text (agency pitch, service descriptions, case studies). Code
blocks are not expected in presentation slides. If a code block appears, the existing
inline `` `code` `` rendering in `markdown.tsx` is sufficient for the rare case.

**Do NOT install:** `rehype-highlight`, `highlight.js`, `prism-react-renderer`. These add
200+ KB to the bundle for a feature that is not part of the slide content model.

---

### 4. Bilingual Content Storage — No Library Needed

Store EN and PT-BR content as sibling fields within each slide JSONB block:

```typescript
// Slide block shape (stored in presentations.slides JSONB)
type SlideBlock = {
  id: string;           // uuid
  layout: "title" | "body" | "bullets" | "image" | "split";
  order: number;
  content: {
    en: {
      title?: string;
      body?: string;
      bullets?: string[];
    };
    "pt-BR": {
      title?: string;
      body?: string;
      bullets?: string[];
    };
  };
  imageUrl?: string;    // language-agnostic — same image for both locales
};
```

**Why this approach:** Keeps both locales in a single DB row (one `presentations` record per
deck, not one per language). Language switching in the public viewer becomes a pure React
state change — no re-fetch, no route change needed beyond the `?lang=` query param. Matches
the JSONB snapshot pattern already validated in v1.2. The existing `useTranslation` hook
does not need to change — its static UI strings stay there; slide *content* lives in the DB.

**Do NOT install:** `i18next`, `react-i18next`, `next-intl`, `lingui`, or any i18n library.
The project already has `useTranslation` backed by a static `translations.ts` map. A full
i18n framework for what is effectively a two-locale content switcher inside a single
JSONB document is over-engineering.

---

## Summary Table: New Additions Only

| Library | Version | Environment | Purpose |
|---|---|---|---|
| `@anthropic-ai/sdk` | `^0.90.0` | server | Claude API — streaming chat + structured slide generation |
| `react-markdown` | `^10.1.0` | client | Full block-markdown rendering for slide body content |
| `remark-gfm` | `^4.0.1` | client | GFM support (tables, task lists) for react-markdown |

Total: **3 new packages**, all production dependencies.

---

## Do NOT Add

| Package | Reason |
|---|---|
| `@ai-sdk/anthropic` (Vercel AI SDK) | Adds abstractions over an already clean SDK; unnecessary indirection; the native `@anthropic-ai/sdk` streaming API is simple enough to use directly with Express SSE |
| `playwright` | PPTX/PDF export is explicitly out of scope for this milestone; Playwright on Vercel serverless is a blocker anyway |
| `slides-grab` / `reveal.js` / `impress.js` | External slide runtimes conflict with the architectural decision to render slides in the app's own scroll-snap viewer; these add 100–400 KB of render engine for zero gain |
| `i18next` / `react-i18next` | Project has its own `useTranslation` with static map; bilingual slides use per-locale JSONB fields, not a runtime i18n framework |
| `rehype-highlight` / `highlight.js` | No code blocks expected in slide content; adds significant bundle weight for an unused feature |
| `react-quill` / `tiptap` / any WYSIWYG | The seed document explicitly rules out WYSIWYG editing; the milestone constraint is "no visual editor in the browser" |
| `pptxgenjs` / `docx` | Export features deferred to a future milestone; not in scope |
| `@uppy/*` (additional uppy plugins) | Supabase asset upload pattern already works via existing `uploadLinksPageAsset`; no new uppy capability needed |

---

## Integration Notes

### Server: Anthropic Key Management

Follow the existing pattern in `server/lib/ai-provider.ts`. Add a `runtimeAnthropicKey`
cache alongside the existing `runtimeOpenAiKey`. The presentations authoring endpoint
should check: runtime cache → `process.env.ANTHROPIC_API_KEY` → `chatIntegrations` table
(add a `"anthropic"` provider row).

### Server: SSE Route

Express supports SSE natively. Set `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
`Connection: keep-alive`, then `res.write()` per chunk. No WebSocket, no `ws` package
changes. The `ws` package (`^8.18.0`) is already installed for other purposes and should
not be repurposed for slide streaming — SSE is simpler and sufficient for one-directional
server-to-client text chunks.

### Client: Streaming Buffer Pattern

The admin chat editor should accumulate streaming text in a `useState` buffer during
generation, then replace it with the finalized parsed JSON when the `[DONE]` sentinel
arrives. This avoids rendering partially valid JSON mid-stream.

### Client: Scroll-Snap Viewer

No new package needed. The public `/p/:slug` viewer is a direct extension of
`EstimateViewer.tsx`: `h-screen overflow-y-scroll snap-y snap-mandatory` container with
`snap-start snap-always` sections. framer-motion (`^11.18.2`, already installed) handles
per-section enter animations. IntersectionObserver (native browser API) handles nav dot
highlighting.

---

## Environment Variables to Add

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Direct key for slide authoring (or stored in `chatIntegrations` DB row) |

---

## Sources

- npm registry: `@anthropic-ai/sdk` 0.90.0 — `npm info @anthropic-ai/sdk version`
- npm registry: `react-markdown` 10.1.0 — `npm info react-markdown version`
- npm registry: `remark-gfm` 4.0.1 — `npm info remark-gfm version`
- Anthropic streaming docs: https://docs.anthropic.com/en/api/messages-streaming
- Anthropic TypeScript SDK: https://github.com/anthropics/anthropic-sdk-typescript
- Existing `tailwind.config.ts` — `@tailwindcss/typography` already present
- Existing `EstimateViewer.tsx` — scroll-snap pattern confirmed, no external library used
- Existing `server/lib/ai-provider.ts` — key cache pattern to follow for Anthropic key
