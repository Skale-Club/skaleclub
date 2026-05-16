# Phase 39: Slide Design System v2 — Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the `SlideBlock` schema with optional visual styling properties (background color, text colors, alignment, background image/video URL) and add 4 new layout variants (`image-left`, `image-right`, `full-bleed-image`, `quote`). Update the public viewer to render all new properties. No DB migration required (JSONB column). No breaking change to existing slides. No manual UI controls — this is AI-driven design only.

</domain>

<decisions>
## Implementation Decisions

### Core Philosophy
- **D-01:** Everything is AI-driven. No color picker, alignment slider, or layout picker is built in the UI. The AI generates all visual properties; the viewer renders them. This is not a PowerPoint editor.
- **D-02:** The schema must expose rich enough fields so the AI can produce varied, beautiful, and brand-coherent slides.

### Schema Extension
- **D-03:** Add an optional `style` sub-object to `SlideBlock` (keeps the flat fields clean and groups visual props separately):
  ```ts
  style?: {
    bgColor?: string;         // CSS color (hex, hsl, or gradient string)
    textColor?: string;       // default body/bullet text color
    headingColor?: string;    // heading text color (can differ from body)
    alignment?: 'left' | 'center' | 'right';  // content alignment
    bgImageUrl?: string;      // full-slide background image URL
    bgVideoUrl?: string;      // full-slide background video URL (muted, looped)
  }
  ```
- **D-04:** All `style` fields are optional. Slides without `style` render exactly as before (zinc-950 dark theme). Backwards compatible.
- **D-05:** No DB migration needed — `slides` column is JSONB. The new fields appear naturally in stored JSON.

### New Layout Variants
- **D-06:** Add 4 new layout values to the `layout` enum:
  - `image-left` — image left ~40%, text right ~60%
  - `image-right` — text left ~60%, image right ~40%
  - `full-bleed-image` — full-screen background image with text overlay
  - `quote` — large centered pull-quote with optional attribution field
- **D-07:** `image-left` and `image-right` use `style.bgImageUrl` for the image panel. `full-bleed-image` uses `style.bgImageUrl` as the background behind the content container.
- **D-08:** `quote` layout adds an optional `attribution` / `attributionPt` field to `SlideBlock` (alongside heading/body pattern).

### Image & Video Handling
- **D-09:** URL-only. AI sets `style.bgImageUrl` or `style.bgVideoUrl` to a public URL. No upload infrastructure added in this phase.
- **D-10:** For `bgVideoUrl`, the viewer renders an `<video autoPlay muted loop playsInline>` tag as the slide background. Fallback: if video fails to load, show the slide with no background.

### Brand Color Coherence
- **D-11:** When the AI generates slides (Phase 40), the system prompt will include the brand color palette extracted from `brandGuidelines.content`. Phase 39 ensures the schema can receive colors; Phase 40 ensures the AI uses brand-consistent ones.
- **D-12:** The `UPDATE_SLIDES_TOOL` JSON schema in `server/routes/presentationsChat.ts` must be updated to include the new `style` object and the new layout enum values.

### Viewer Rendering
- **D-13:** `SlideContent` component in `PresentationViewer.tsx` reads `slide.style` and applies it via `style` prop (inline CSS) on the slide wrapper. Tailwind hardcoded classes remain as defaults; inline styles override where `slide.style` is set.
- **D-14:** Background video: rendered inside the slide `div` as an absolute-positioned element behind the content. Pointer-events none, z-index below content.
- **D-15:** Content alignment applied via CSS `text-align` and Flexbox justify on the content wrapper.

### Claude's Discretion
- Layout choices for new variants (exact proportions, padding, responsive breakpoints): Claude decides
- Whether `image-left`/`image-right` use `style.bgImageUrl` or a new `imageUrl` field at the slide level (Claude should choose `style.bgImageUrl` for consistency)
- CSS gradient syntax for `bgColor`: CSS standard (`linear-gradient(...)`) preferred over custom formats

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema
- `shared/schema/presentations.ts` — Current SlideBlock schema, all 8 layouts, Zod definitions, Drizzle table

### Viewer
- `client/src/pages/PresentationViewer.tsx` — All 8 layout renders, SlideContent component, slide wrapper structure

### AI Authoring
- `server/routes/presentationsChat.ts` — UPDATE_SLIDES_TOOL JSON schema and buildSystemPrompt — both must be updated with new fields and layouts

### Brand Guidelines
- `server/routes/brandGuidelines.ts` — Brand guidelines CRUD (Phase 40 will read this to inject colors into prompt)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `slideBlockSchema` (shared/schema/presentations.ts:7) — Zod schema to extend with `style` sub-object and new `layout` enum values
- `SlideContent` component (PresentationViewer.tsx:61) — Switch statement to extend with 4 new layout cases
- `UPDATE_SLIDES_TOOL` (presentationsChat.ts:12) — Hand-written JSON schema; must add `style` object + new layout enums

### Established Patterns
- All `SlideBlock` fields are optional except `layout` — new fields follow the same `.optional()` pattern
- No DB migration needed: slides stored as JSONB in `presentations.slides` — schema is additive
- Bilingual pattern: all text fields have `fieldPt` counterpart — `attribution`/`attributionPt` on `quote` layout follows the same convention
- `image-focus` layout currently renders `bg-zinc-800` as placeholder — this phase replaces it with real `style.bgImageUrl` rendering

### Integration Points
- `shared/schema/presentations.ts` — single source of truth; both server routes and client components import from here
- `server/routes/presentationsChat.ts` — UPDATE_SLIDES_TOOL must be in sync with the Zod schema
- `client/src/pages/PresentationViewer.tsx` — new layout cases and `style` rendering added here

</code_context>

<specifics>
## Specific Ideas

- User explicitly stated: "everything will be done through AI — it's not a PowerPoint tool, but the AI needs the ability to make visual changes to produce organized and beautiful presentations"
- "The AI needs to use a color system coherent with our branding" — brand guidelines color palette must be injected into the AI system prompt (addressed in Phase 40; schema supports it here)
- Images and videos: URL-only (user confirmed). No new upload infrastructure.

</specifics>

<deferred>
## Deferred Ideas

- Manual visual editor (color picker, drag-and-drop) — explicitly out of scope per user direction
- Image upload within slides — deferred; URL-only for now
- AI image generation (DALL-E, Imagen) for slides — deferred to future milestone

</deferred>

---

*Phase: 39-slide-design-system-v2*
*Context gathered: 2026-05-15*
