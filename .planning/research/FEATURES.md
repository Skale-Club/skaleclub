# Feature Landscape: AI-Authored Presentations (v1.4)

**Domain:** Conversational AI deck builder — admin chats with Claude to produce bilingual fullscreen presentations.
**Researched:** 2026-04-20
**Milestone:** v1.4 Admin Presentations Page

---

## Master Table

| Feature | Table Stakes | Differentiator | Anti-feature | Notes |
|---------|:---:|:---:|:---:|-------|
| Create presentation (name, slug, access code) | X | | | Same as estimates pattern |
| Chat prompt → Claude → structured slide JSON | X | | | Core authoring loop |
| Structured slide schema with typed layout variants | X | | | See §2 — blocks, not MDX |
| Per-slide re-generation (single slide edits) | | X | | See §3 — preferred over full regen |
| Full deck regeneration on major request | X | | | Fall-back when admin says "redo everything" |
| Brand guidelines document (system prompt) | | X | | First-class artifact, not inline prompt |
| Bilingual output EN + PT-BR per deck | | X | | See §4 — locale JSONB on slide row |
| Public viewer `/p/:slug` — fullscreen scroll-snap | X | | | Mirror of `/e/:slug` EstimateViewer |
| Language switcher on public viewer (`?lang=`) | | X | | URL param; no server round-trip |
| Access code gate on public viewer | X | | | Reuse estimates pattern verbatim |
| View tracking (`presentation_views` event-log) | X | | | Mirror `estimate_views` table |
| Slide reorder by admin (drag) | | X | | Low effort — dnd-kit already in app |
| Slide delete | X | | | |
| Admin slide preview (rendered slide list) | X | | | Before sharing publicly |
| WYSIWYG / direct text editing in browser | | | X | Out of scope per seed constraints |
| PPTX / PDF export | | | X | Deferred — avoid Playwright on Vercel |
| Image generation / AI picks stock photos | | | X | Admin supplies image URLs only |
| Per-user / per-client auth on public viewer | | | X | Access code sufficient |
| Slide comments / collaboration | | | X | Not an agency priority |
| Animation / transition editor | | | X | framer-motion handles basic transitions |

---

## §1 — Table Stakes vs Differentiators

### Table Stakes (product feels incomplete without these)

| Feature | Why Expected | Complexity |
|---------|--------------|------------|
| Chat → slides creation | The entire value prop | High — AI pipeline + structured output |
| Structured slide JSON stored in DB | Required for viewer rendering | Medium |
| Public fullscreen viewer `/p/:slug` | Delivery mechanism | Low — EstimateViewer is a direct template |
| Access code gate | Privacy for client-specific decks | Low — copy estimates pattern |
| View tracking | Admin needs to know if client watched | Low — copy estimate_views pattern |
| Slide delete + basic CRUD | Can't have unusable stale decks | Low |
| Admin slide list / preview | Admin needs to see what will render | Medium |
| EN + PT-BR bilingual output | Explicit product requirement | Medium |

### Differentiators (valued, not expected)

| Feature | Value Proposition | Complexity |
|---------|-------------------|------------|
| Brand guidelines document as system prompt | AI output stays on-brand without per-prompt reminders | Medium |
| Per-slide iterative editing | Preserves the rest of the deck — surgical chat edits | Medium |
| Drag reorder | Admin can restructure narrative after generation | Low |
| Language switcher on public viewer | Client flips to their language without a new link | Low |
| Slide variant system (layout types) | Claude picks appropriate layout per content type | Medium |

### Anti-features (explicitly excluded)

| Anti-Feature | Why Avoid | Alternative |
|--------------|-----------|-------------|
| WYSIWYG / in-browser slide editor | Contradicts the seed constraint; adds massive scope | Admin edits via chat |
| PPTX/PDF export | Requires Playwright — serverless-hostile on Vercel | Shareable URL is the deliverable |
| AI image generation | Unpredictable brand compliance, cost | Admin provides image URLs; Supabase storage for uploads |
| Full re-render on every chat turn | Destroys admin's approved slides | Per-slide scope with opt-in full regen |

---

## §2 — Structured Slide JSON Schema

**Recommendation: Typed blocks on a slide row. Not MDX, not raw HTML.**

### Why Not MDX or HTML

MDX and raw HTML string storage are common in CMS tools but are bad fits here:
- MDX requires a runtime parser (`@next/mdx` or `next-mdx-remote`) — this app is Vite + React, not Next.js.
- HTML blobs cannot be layout-variant-aware — the viewer component can't inspect the semantics of a blob to apply a two-column layout vs. a stat-callout layout.
- Both make per-slide AI edits fragile: the AI must parse its own previous output to edit it, which fails reliably.
- Both block server-side safety checks (e.g., stripping `<script>` tags).

### Recommended Slide Block Schema (Zod)

Each presentation stores a `slides` JSONB column of type `Slide[]`. Each slide has:

```typescript
type SlideLayout =
  | "cover"         // title + subtitle + background image, hero full-bleed
  | "section-break" // chapter divider — large centered heading, minimal content
  | "title-body"    // heading + paragraphs (1-2 column variants)
  | "bullets"       // heading + ordered/unordered bullet list
  | "stats"         // 2-4 prominent metric callouts
  | "two-column"    // left text block + right text/image block
  | "image-focus"   // image dominant, caption below
  | "quote"         // pull quote + attribution
  | "team"          // grid of person cards (name, role, optional photo URL)
  | "case-study"    // problem / approach / result three-panel
  | "closing"       // CTA variant — headline, sub, contact detail

interface Slide {
  id: string;           // uuid — stable across edits
  order: number;
  layout: SlideLayout;
  content: {
    title?: { en: string; "pt-BR": string };
    subtitle?: { en: string; "pt-BR": string };
    body?: { en: string; "pt-BR": string };     // markdown allowed; viewer renders
    bullets?: { en: string[]; "pt-BR": string[] };
    stats?: Array<{ value: string; label: { en: string; "pt-BR": string } }>;
    image?: { url: string; alt: { en: string; "pt-BR": string } };
    quote?: { text: { en: string; "pt-BR": string }; attribution: string };
    team?: Array<{ name: string; role: { en: string; "pt-BR": string }; photoUrl?: string }>;
    cta?: { label: { en: string; "pt-BR": string }; detail: string };
    columns?: Array<{
      heading?: { en: string; "pt-BR": string };
      body?: { en: string; "pt-BR": string };
      image?: { url: string; alt: { en: string; "pt-BR": string } };
    }>;
  };
  speakerNotes?: string; // not shown in viewer; used in chat to give Claude context
}
```

Note: locale-neutral fields (image URLs, stat numeric values, person names, attributions) are stored flat. Only human-readable strings get locale keys.

This schema is narrow enough that:
- Claude can fill it reliably with structured outputs.
- The viewer component switches on `layout` with a clear type contract.
- Per-slide edits are surgical: Claude receives the existing `Slide` object, modifies only the fields it needs, returns the updated object.
- Zod validation at the API boundary catches malformed output before it reaches the DB.

**Confidence:** MEDIUM — schema is synthesized from open-source tools (slide-deck-ai, presenton, Relevance AI) and Anthropic structured outputs docs. The exact field list should be validated in the discuss phase.

---

## §3 — Iterative Editing: Per-Slide vs Full Regeneration

**Recommendation: Per-slide edit as the default. Full regen as an explicit opt-in.**

### Industry Pattern (2025/2026)

The ecosystem has converged on per-slide editing as the superior UX:
- Beautiful.ai: "improve one slide, test different layouts, regenerate visuals, or preserve exact text without wiping the rest of the deck."
- Emergent: "changing a metric or value proposition without manually editing multiple slides."
- SlidesPilot: applies changes to each slide individually.
- Full-regen (Decktopus pattern) is the fallback for "explore new styles."

### How to Implement It

The chat endpoint receives: `{ scope: "slide" | "deck", slideId?: string, message: string }`.

- `scope: "slide"` — backend fetches only that slide's current JSON, sends it plus brand guidelines as context to Claude, Claude returns a modified `Slide` object, backend merges it back into the `slides` array.
- `scope: "deck"` — backend sends the full `slides` array plus guidelines, Claude returns a new `Slide[]`, backend replaces the array.
- The admin UI infers scope from context: typing in a slide-specific input sends `scope: "slide"`; a top-level "Redo the whole deck" message sends `scope: "deck"`.

### Claude Structured Output vs Tool Use

Anthropic released Structured Outputs (public beta, Nov 2025) for Claude Sonnet 4.5 and Opus 4.1. This guarantees schema-compliant JSON via constrained decoding — more reliable than JSON mode. The presentations endpoint should use the direct Anthropic SDK (not OpenRouter) so structured outputs can be used.

The existing chat integration uses OpenRouter (OpenAI-compatible) which supports `response_format: { type: "json_object" }` but not constrained decoding. For presentations, direct Anthropic SDK is recommended — quality matters more than cost here, and it is the flagship authoring surface.

**Confidence:** HIGH for the per-slide pattern; MEDIUM for structured outputs (public beta as of research date).

---

## §4 — Bilingual Storage: Locale JSONB Key per Field vs Separate Rows

**Recommendation: Locale JSONB key per translatable field on the slide. Single `presentations` row per deck.**

### Options Compared

**Option A — Two separate presentation rows (one per locale)**
```
presentations: id, slug, locale ('en' | 'pt-BR'), slides JSONB, ...
```
- Pro: Simple queries — `WHERE slug = ? AND locale = ?`
- Con: Slug must be shared across rows (FK or compound unique index)
- Con: Duplicates all metadata (title, access_code, view tracking FK) per locale
- Con: `presentation_views` needs a locale column to be meaningful
- Con: Creating a new locale version is a full-table write

**Option B — Locale JSONB key per content field on each slide (recommended)**
```typescript
title?: { en: string; "pt-BR": string }
```
- Pro: Single row per deck — all metadata unified
- Pro: View tracking table needs no locale column
- Pro: Admin can trigger "translate all slides to PT-BR" as one Claude call
- Pro: Locale-neutral fields (image URLs, stat values) stored once
- Pro: Adding a third language later is additive (add a key to the JSONB)
- Con: Viewer needs a locale fallback: `slide.content.title?.[lang] ?? slide.content.title?.en`

**Option C — Full slides array per locale as separate JSONB columns**
```
presentations: id, slug, slides_en JSONB, slides_pt_br JSONB, ...
```
- Pro: Easy to regenerate one locale independently
- Con: Doubles the JSONB payload; partial updates (edit slide 3) must read/write the full locale array

**Decision: Option B** — locale JSONB key per translatable field.

Rationale: matches the project's existing `useTranslation` / `translations.ts` pattern; keeps the `presentations` table simple and additive; the public viewer already handles `?lang=en|pt-BR` as a URL param; the admin flow becomes: generate EN → then one chat turn "translate all slides to PT-BR" → Claude returns same structure with `pt-BR` keys populated.

**Confidence:** HIGH (pattern grounded in PostgreSQL multilingual JSONB documentation and project architecture review).

---

## §5 — Admin Chat-to-Slides UX

**What makes a great conversational deck builder UX** (grounded in Beautiful.ai, Emergent, DeckSpeed patterns):

### Must-Have UX Elements

| Element | Description | Complexity |
|---------|-------------|------------|
| Outline-first | First Claude turn proposes a slide outline (titles + layouts only). Admin approves before content is generated. Avoids regenerating a full deck after the admin rejects the structure. | Medium |
| Live slide list panel | Slides render in a scrollable preview panel as they're generated. Admin sees the deck take shape — not a spinner followed by a dump. | Medium |
| Scope indicator | Chat input shows which slide is "active" (e.g., "Editing Slide 3: Case Study"). Unscoped messages go to deck level. | Low |
| Streaming assistant response | Claude streams text; the final JSON is committed to DB on stream end. Exact same SSE pattern as existing ChatSection. | Low |
| "Undo last AI change" | Reverts slides array to previous version. Requires a `slides_history` JSONB column or version counter. | Medium |
| Brand guidelines indicator | Badge showing "Guidelines: Active" so admin knows Claude is constrained. Click opens the guidelines editor. | Low |
| PT-BR generation action | Explicit button/command: "Translate to PT-BR" triggers a bulk translate turn scoped to all slides. Separates translation from authoring. | Low |
| Copy public link | Same as estimates list — one-click copy of `/p/:slug` or `/p/:slug?lang=pt-BR`. | Low |

### Anti-UX Patterns to Avoid

| Anti-Pattern | Why Bad | Fix |
|--------------|---------|-----|
| Chat overwrites all slides on every message | Admin loses approved slides | Per-slide scope by default |
| No visual feedback during generation | Admin doesn't know if Claude is working | Stream tokens; show spinner per-slide |
| Monolithic "Save" button | Confusion about what is persisted | Auto-save after each AI commit (same as estimates dialog) |
| Inline JSON visible in chat | Breaks reading flow | Render structured output as a slide card in the message list, not raw JSON |
| Language toggle produces a full page reload | Ruins the viewer experience | `?lang=` param read client-side; React state swap only |

### System Prompt Architecture

The brand guidelines document is stored as a `guidelines` text column on the `presentations` table (or a separate `brand_guidelines` singleton table). On every AI authoring request, the server:
1. Fetches the current guidelines text.
2. Prepends it as the `system` message.
3. Appends the current slide JSON (scoped to the target slide or full array).
4. Sends the user's chat message as the `user` turn.

This ensures Claude is never called without brand constraints. It also means the admin can update guidelines mid-session without restarting the conversation.

**Confidence:** MEDIUM (synthesized from Beautiful.ai UX descriptions, DeckSpeed review, Emergent documentation, and existing ChatSection implementation analysis).

---

## §6 — Must-Have Slide Layout Variants for Agency Decks

Grounded in analysis of agency pitch deck best practices (Storydoc, Visme, Medium agency pitch series) and the existing EstimateViewer section types.

### Core Variants (must ship in v1.4)

| Layout | Purpose | Agency Use Case |
|--------|---------|-----------------|
| `cover` | Full-bleed hero, title + subtitle + background image | First impression; includes logo and tagline |
| `section-break` | Chapter divider, large centered heading | Separates major deck sections (About / Services / Results) |
| `title-body` | Heading + 1-2 paragraphs | Agency intro, "What We Do" slide |
| `bullets` | Heading + bullet list (ordered or unordered) | Services list, process steps, capabilities |
| `stats` | 2-4 metric callouts with value + label | "Results" — 200% ROI, 50 clients, 5-star rating |
| `two-column` | Left text + right image or text | Problem / Solution; Service with screenshot |
| `image-focus` | Image dominant with caption | Portfolio/case study visual proof point |
| `closing` | CTA — headline + sub-headline + contact detail | "Let's talk" with email / WhatsApp |

### Extended Variants (nice to have, can be added iteratively)

| Layout | Purpose | Deferrable? |
|--------|---------|-------------|
| `quote` | Large pull quote + attribution | Yes — add in v1.5 if needed |
| `team` | Grid of person cards | Yes — most agency decks include this |
| `case-study` | Problem / Approach / Result three-panel | Yes — high value for social proof |

### Naming Convention Rationale

Layouts are named by semantic content type, not visual style. This is critical because:
- Claude picks the layout based on what the slide is *about*, not how it should look.
- The viewer component maps layout to React component. Renaming layouts later breaks every stored slide.
- Keeping names stable and semantic means the JSON schema is durable across design refresh iterations.

---

## §7 — Feature Dependencies

```
Brand guidelines doc → Chat authoring endpoint (guidelines = system prompt input)
Chat authoring endpoint → Structured slide JSON → Public viewer
Structured slide JSON → Bilingual content (locale keys inside content fields)
Bilingual content → Language switcher on public viewer
Access code gate → View tracking (only count views after gate is passed)
Slide list panel → Per-slide edit scope (need to know which slide is "active")
Outline-first UX → Full-deck generate (outline = first-pass deck with layout only)
```

---

## §8 — MVP Phase Recommendation

### Phase 1 — Schema + AI Pipeline
- `presentations` table: slug, title, access_code, guidelines text, slides JSONB (locale-keyed content), created_at, updated_at
- `presentation_views` event-log table (mirror estimate_views)
- POST `/api/presentations/generate` — takes guidelines + user message + current slides → returns updated slides array
- Direct Anthropic SDK (not OpenRouter) for structured outputs guarantee

### Phase 2 — Admin Editor Surface
- Presentations list tab in Admin (mirrors Estimates tab)
- New/Edit dialog with title + access code fields
- Chat panel (borrow ChatSection shell) with slide preview panel
- Per-slide scope selector
- "Translate to PT-BR" action button

### Phase 3 — Public Viewer
- `/p/:slug` route, isolated from Navbar/Footer via `isPresentationRoute` guard
- Language via `?lang=en|pt-BR` — client-side only
- Scroll-snap viewer (fork EstimateViewer, replace sections with `SlideRenderer` that switches on `layout`)
- View tracking (POST `/api/presentations/slug/:slug/view` on first load, after access code verify)

### Defer to v1.5
- PPTX export
- AI image selection
- `quote`, `case-study`, `team` layout variants (additive — no schema change)
- Asset library

---

## Sources

- [Beautiful.ai iterative editing description](https://www.beautiful.ai/)
- [Emergent AI deck builder — context-aware propagation](https://emergent.sh/learn/best-ai-deck-builders)
- [DeckSpeed conversational model review](https://skywork.ai/skypage/en/deckspeed-review-conversational-ai/1976851622979629056)
- [Claude structured outputs (public beta Nov 2025)](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Presenton JSON slide schema docs](https://docs.presenton.ai/guide/create-presentation-from-json)
- [slide-deck-ai: LLM to JSON to PPTX pipeline](https://github.com/barun-saha/slide-deck-ai)
- [Agency pitch deck anatomy — Storydoc](https://www.storydoc.com/blog/agency-pitch-deck-examples)
- [Visme agency deck sections](https://visme.co/blog/agency-pitch-deck/)
- [PostgreSQL multilingual JSONB — Phrase blog](https://phrase.com/blog/posts/best-database-structure-for-keeping-multilingual-data/)
- [Multilingual DB design patterns — DEV Community](https://dev.to/adnanbabakan/how-to-design-a-multilingual-database-structure-a-practical-guide-35nf)
- [arxiv: Talk to Your Slides — LLM slide editing agent (2505.11604)](https://arxiv.org/html/2505.11604v1)
- [Vellum: structured outputs vs JSON mode vs function calling](https://www.vellum.ai/blog/when-should-i-use-function-calling-structured-outputs-or-json-mode)
