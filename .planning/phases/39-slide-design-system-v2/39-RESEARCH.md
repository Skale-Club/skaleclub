# Phase 39: Slide Design System v2 - Research

**Researched:** 2026-05-15
**Domain:** React slide viewer — schema extension, new layout variants, inline style rendering, CSS video background
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Everything is AI-driven. No color picker, alignment slider, or layout picker is built in the UI. The AI generates all visual properties; the viewer renders them.
- **D-02:** The schema must expose rich enough fields so the AI can produce varied, beautiful, and brand-coherent slides.
- **D-03:** Add an optional `style` sub-object to `SlideBlock`:
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
- **D-04:** All `style` fields are optional. Backwards compatible.
- **D-05:** No DB migration needed — `slides` column is JSONB. New fields appear naturally.
- **D-06:** Add 4 new layout values: `image-left`, `image-right`, `full-bleed-image`, `quote`
- **D-07:** `image-left` and `image-right` use `style.bgImageUrl` for the image panel. `full-bleed-image` uses `style.bgImageUrl` as background behind the content container.
- **D-08:** `quote` layout adds optional `attribution` / `attributionPt` field to `SlideBlock`.
- **D-09:** URL-only. AI sets `style.bgImageUrl` or `style.bgVideoUrl` to a public URL. No upload infrastructure added.
- **D-10:** For `bgVideoUrl`, render `<video autoPlay muted loop playsInline>` as slide background. Fallback: if video fails to load, show slide with no background.
- **D-11:** Brand colors — Phase 39 ensures schema can receive them; Phase 40 ensures the AI uses them.
- **D-12:** `UPDATE_SLIDES_TOOL` JSON schema in `server/routes/presentationsChat.ts` must be updated with new `style` object and new layout enum values.
- **D-13:** `SlideContent` component reads `slide.style` and applies it via `style` prop (inline CSS) on the slide wrapper. Tailwind hardcoded classes remain as defaults; inline styles override where `slide.style` is set.
- **D-14:** Background video: absolute-positioned element behind content. Pointer-events none, z-index below content.
- **D-15:** Content alignment applied via CSS `text-align` and Flexbox justify on the content wrapper.

### Claude's Discretion
- Layout choices for new variants (exact proportions, padding, responsive breakpoints)
- Whether `image-left`/`image-right` use `style.bgImageUrl` or a new `imageUrl` field — **use `style.bgImageUrl` for consistency**
- CSS gradient syntax for `bgColor`: CSS standard (`linear-gradient(...)`) preferred

### Deferred Ideas (OUT OF SCOPE)
- Manual visual editor (color picker, drag-and-drop)
- Image upload within slides — URL-only
- AI image generation (DALL-E, Imagen) for slides
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRES2-01 | SlideBlock schema extended with optional `style` sub-object (bgColor, textColor, headingColor, alignment, bgImageUrl, bgVideoUrl) — all fields optional | D-03/D-04: Zod `.optional()` pattern already used throughout slideBlockSchema. Add `style: styleSchema.optional()`. No DB migration (JSONB). |
| PRES2-02 | 4 new layout variants added to `layout` enum: `image-left`, `image-right`, `full-bleed-image`, `quote`. `quote` adds `attribution`/`attributionPt` fields. | D-06/D-07/D-08: Extend `z.enum([...])` in slideBlockSchema; add bilingual attribution fields following established pattern. |
| PRES2-03 | Public viewer renders all new layout variants and all `style` properties. `bgVideoUrl` renders autoplay muted looped video behind content. | D-13/D-14/D-15: SlideContent switch cases for 4 new layouts; slide wrapper uses inline `style` prop for bgColor/textColor/bgImageUrl; absolute-positioned `<video>` for bgVideoUrl. |
| PRES2-04 | UPDATE_SLIDES_TOOL JSON schema in presentationsChat.ts updated to include new `style` object and new layout enum values. | D-12: Hand-written JSON schema requires manual sync with Zod changes. |
</phase_requirements>

---

## Summary

Phase 39 is a pure TypeScript/React change with no DB migration, no new npm dependencies, and no new API routes. All work is confined to three files: `shared/schema/presentations.ts` (schema), `client/src/pages/PresentationViewer.tsx` (viewer), and `server/routes/presentationsChat.ts` (tool schema).

The schema extension follows the established `.optional()` Zod pattern already used for all existing SlideBlock fields. Backwards compatibility is guaranteed: existing slides have no `style` key; the viewer checks for its presence before applying overrides. The JSONB column in PostgreSQL auto-accommodates new keys — no migration required.

The viewer pattern is straightforward: the slide wrapper `<motion.div>` gains an inline `style` object built from `slide.style`; new layout cases are added to the SlideContent switch statement. The absolute-positioned `<video>` pattern for `bgVideoUrl` follows the same z-index stacking already established by the `image-focus` layout (which uses `absolute inset-0`).

**Primary recommendation:** One plan is sufficient. Execute all four changes (schema, viewer new layouts, viewer style rendering, tool schema) in two waves: Wave 1 — schema file only; Wave 2 — viewer + tool schema (these are independent but small enough to ship together).

---

## Standard Stack

### Core (no new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 3.24.2 | Schema validation — extend slideBlockSchema | Already the single source of truth for SlideBlock |
| React | 18.3.1 | Viewer component rendering | Existing viewer |
| Tailwind CSS | 3.4.17 | Layout classes for new slide variants | Existing styling system |
| framer-motion | 11.18.2 | Slide transition wrapper | Already wraps SlideContent |
| TypeScript | 5.6.3 | Type derivation via `z.infer<>` | Project language |

### No New Dependencies
This phase requires zero new npm packages. All required primitives (`<video>`, inline styles, CSS flexbox, `z.object().optional()`) are native to the existing stack.

**Installation:** None required.

---

## Architecture Patterns

### File Scope
All changes are confined to:
1. `shared/schema/presentations.ts` — Zod schema + TS types
2. `client/src/pages/PresentationViewer.tsx` — SlideContent switch + slide wrapper
3. `server/routes/presentationsChat.ts` — UPDATE_SLIDES_TOOL JSON schema

### Pattern 1: Zod Optional Sub-Object Extension
**What:** Add a `style` object with all-optional fields to `slideBlockSchema`.
**When to use:** Any time the schema needs a grouping of optional visual properties.
**Established precedent:** Every existing SlideBlock field uses `.optional()`. The `stats` field uses a nested `z.array(z.object(...))`. The `style` field follows the same pattern.

```typescript
// Extend in shared/schema/presentations.ts
const slideStyleSchema = z.object({
  bgColor:       z.string().optional(),
  textColor:     z.string().optional(),
  headingColor:  z.string().optional(),
  alignment:     z.enum(['left', 'center', 'right']).optional(),
  bgImageUrl:    z.string().optional(),
  bgVideoUrl:    z.string().optional(),
});

export const slideBlockSchema = z.object({
  layout: z.enum([
    "cover", "section-break", "title-body", "bullets", "stats",
    "two-column", "image-focus", "closing",
    // NEW:
    "image-left", "image-right", "full-bleed-image", "quote",
  ]),
  heading:       z.string().optional(),
  headingPt:     z.string().optional(),
  body:          z.string().optional(),
  bodyPt:        z.string().optional(),
  bullets:       z.array(z.string()).optional(),
  bulletsPt:     z.array(z.string()).optional(),
  stats:         z.array(z.object({
    label:   z.string(),
    value:   z.string(),
    labelPt: z.string().optional(),
  })).optional(),
  // NEW: attribution for quote layout (bilingual, matches heading/headingPt pattern)
  attribution:   z.string().optional(),
  attributionPt: z.string().optional(),
  // NEW: visual style sub-object
  style:         slideStyleSchema.optional(),
});
```

**Critical:** `SlideBlock` and `SlideLayout` types are derived via `z.infer<>`, so they auto-update when the schema changes. No manual TS type edits needed.

### Pattern 2: Inline Style Override on Slide Wrapper
**What:** Build an inline `style` prop from `slide.style` and apply it to the slide wrapper div.
**When to use:** When AI-generated colors/backgrounds need to override Tailwind defaults.
**Key insight:** Tailwind classes provide defaults; inline styles win in CSS specificity — no `!important` needed.

```typescript
// In PresentationViewer.tsx — build wrapperStyle from slide.style
function buildSlideStyle(s?: SlideBlock['style']): React.CSSProperties {
  if (!s) return {};
  const css: React.CSSProperties = {};
  if (s.bgColor)     css.background = s.bgColor;
  if (s.textColor)   css.color = s.textColor;
  if (s.bgImageUrl && !s.bgVideoUrl) {
    css.backgroundImage = `url(${s.bgImageUrl})`;
    css.backgroundSize  = 'cover';
    css.backgroundPosition = 'center';
  }
  return css;
}
```

The wrapper where this applies is the `<motion.div>` that already exists in PresentationViewer. For full-bleed layouts (`full-bleed-image`, `image-left`, `image-right`), the wrapper must be `absolute inset-0` so the image fills the entire slide — this matches the existing `image-focus` layout pattern.

### Pattern 3: New Layout Cases in SlideContent Switch
**What:** Add 4 `case` blocks to the `SlideContent` switch statement.
**Existing precedent:** `image-focus` already uses `absolute inset-0` for full-bleed layouts.

```typescript
// image-left: ~40% image panel left, ~60% text right
case 'image-left':
  return (
    <div className="w-full h-full absolute inset-0 flex flex-col md:flex-row">
      <div
        className="md:w-2/5 bg-zinc-800 bg-cover bg-center"
        style={slide.style?.bgImageUrl ? { backgroundImage: `url(${slide.style.bgImageUrl})` } : {}}
      />
      <div className="md:w-3/5 flex items-center justify-start px-8 py-12 md:py-0 md:px-16 lg:px-24">
        <div className="max-w-2xl">
          {heading && <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight">{heading}</h2>}
          {body && <p className="text-lg md:text-xl lg:text-2xl text-zinc-400 leading-relaxed">{body}</p>}
        </div>
      </div>
    </div>
  );

// image-right: ~60% text left, ~40% image panel right
case 'image-right':
  return (
    <div className="w-full h-full absolute inset-0 flex flex-col md:flex-row">
      <div className="md:w-3/5 flex items-center justify-start px-8 py-12 md:py-0 md:px-16 lg:px-24">
        <div className="max-w-2xl">
          {heading && <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight">{heading}</h2>}
          {body && <p className="text-lg md:text-xl lg:text-2xl text-zinc-400 leading-relaxed">{body}</p>}
        </div>
      </div>
      <div
        className="md:w-2/5 bg-zinc-800 bg-cover bg-center"
        style={slide.style?.bgImageUrl ? { backgroundImage: `url(${slide.style.bgImageUrl})` } : {}}
      />
    </div>
  );

// full-bleed-image: background fills entire slide, text overlay with scrim
case 'full-bleed-image':
  return (
    <div className="text-center relative z-10">
      {heading && <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight drop-shadow-lg">{heading}</h2>}
      {body && <p className="text-base md:text-lg lg:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed drop-shadow">{body}</p>}
    </div>
  );

// quote: large centered pull-quote with optional attribution
case 'quote':
  const attribution = resolveField(slide.attribution, slide.attributionPt, lang);
  return (
    <div className="text-center max-w-3xl mx-auto">
      <p style={{ fontFamily: "'Outfit', sans-serif" }} className="text-3xl md:text-4xl lg:text-5xl font-semibold text-white leading-snug mb-8">
        &ldquo;{heading}&rdquo;
      </p>
      {attribution && (
        <p className="text-zinc-400 text-base md:text-lg uppercase tracking-widest">— {attribution}</p>
      )}
    </div>
  );
```

### Pattern 4: Background Video Rendering
**What:** Absolute-positioned `<video>` behind the content.
**Key constraints from D-10/D-14:** autoplay, muted, loop, playsInline. Pointer-events none. Below content in z-index.

```typescript
// Render inside the slide wrapper, before SlideContent
{slide.style?.bgVideoUrl && (
  <video
    key={slide.style.bgVideoUrl}
    autoPlay
    muted
    loop
    playsInline
    className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
    onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
  >
    <source src={slide.style.bgVideoUrl} />
  </video>
)}
```

The `key={slide.style.bgVideoUrl}` forces React to remount the video element when the URL changes (avoids stale video sources). The `onError` handler satisfies D-10's fallback requirement without adding state.

### Pattern 5: Alignment Application
**What:** Map `style.alignment` to CSS flexbox and text-align.
**How:** Pass alignment as inline style on the content wrapper inside SlideContent.

```typescript
// Utility — used in the SlideContent wrapper
function alignmentStyle(alignment?: 'left' | 'center' | 'right'): React.CSSProperties {
  if (!alignment) return {};
  return {
    textAlign: alignment,
    alignItems: alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center',
  };
}
```

### Pattern 6: UPDATE_SLIDES_TOOL Extension
**What:** Add `style` object and new layout enum values to the hand-written JSON schema.
**Why hand-written:** `zod-to-json-schema` is NOT installed (confirmed in existing comment in presentationsChat.ts line 10).

```typescript
// In server/routes/presentationsChat.ts
// Add to the layout enum array:
enum: [
  "cover", "section-break", "title-body", "bullets", "stats",
  "two-column", "image-focus", "closing",
  "image-left", "image-right", "full-bleed-image", "quote"
],

// Add alongside existing properties in the slide item:
attribution:   { type: "string" },
attributionPt: { type: "string" },
style: {
  type: "object",
  properties: {
    bgColor:       { type: "string" },
    textColor:     { type: "string" },
    headingColor:  { type: "string" },
    alignment:     { type: "string", enum: ["left", "center", "right"] },
    bgImageUrl:    { type: "string" },
    bgVideoUrl:    { type: "string" },
  },
},
```

### Anti-Patterns to Avoid

- **Using `bgImageUrl` as a direct `<img>` element instead of `background-image` CSS:** The image panel in `image-left`/`image-right` must fill the panel with `backgroundSize: cover` — an `<img>` tag doesn't achieve this without extra CSS and creates accessibility concerns.
- **Attempting to use Tailwind arbitrary values for dynamic URLs:** `bg-[url(...)]` does not work with dynamic runtime values in Tailwind v3 (purged at build time). Use inline `style={{ backgroundImage: \`url(${url})\` }}` instead.
- **Applying `slide.style.textColor` with a Tailwind class:** Inline style must be used; dynamic color values cannot be JIT-compiled by Tailwind.
- **Putting `<video>` outside the slide wrapper:** The video must be inside the slide's `<motion.div>` so it participates in Framer Motion's slide transition animation (enter/exit with the slide).
- **Not keying `<video>` on the URL:** Without `key={url}`, React reuses the DOM node and the old video keeps playing when the URL changes.
- **Applying `bgColor` and `bgImageUrl` both via `background` shorthand:** If bgColor is a gradient (`linear-gradient(...)`) AND bgImageUrl is also set, they conflict. Decision: `bgImageUrl` takes priority; `bgColor` is only applied when `bgImageUrl` is absent (or combine via CSS `background` layering).
- **Modifying `image-focus` layout to use `style.bgImageUrl`:** CONTEXT.md D-07 notes the `image-focus` placeholder (`bg-zinc-800`) should be replaced with real image rendering — this is a fix to the existing layout, not just new cases.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS gradient parsing/validation | Custom gradient validator | Accept any CSS string for `bgColor` | CSS handles all valid values natively; invalid values fail silently (no layout break) |
| Video fallback state machine | `useState` + `onError` → hide video | Native `onError` event on `<video>` + inline style display:none | One-liner; no re-render cost |
| Alignment utilities | Custom flexbox class generator | Inline `style` object from `alignmentStyle()` helper | 3 lines; avoids dynamic Tailwind class generation problems |
| JSON Schema sync | Auto-generate from Zod | Manual hand-written JSON schema (existing pattern) | Project explicitly notes `zod-to-json-schema` is not installed |

---

## Common Pitfalls

### Pitfall 1: `image-focus` Layout Must Also Be Updated
**What goes wrong:** The plan adds 4 new layouts but forgets that `image-focus` currently renders `bg-zinc-800` as a placeholder (confirmed in PresentationViewer.tsx line 146). CONTEXT.md D-07 explicitly states this phase replaces it with real `style.bgImageUrl` rendering.
**Why it happens:** Reading the CONTEXT quickly and missing the note in `code_context` section.
**How to avoid:** Include `image-focus` update in the same task as `image-left`/`image-right` — same rendering pattern.
**Warning signs:** If PRES2-03 verification shows `image-focus` still renders solid zinc block.

### Pitfall 2: Framer Motion `motion.div` Wrapper vs. SlideContent Wrapper
**What goes wrong:** The slide wrapper in PresentationViewer is a `<motion.div>` with classes `relative z-10 px-8 max-w-3xl ...`. For absolute-inset layouts (`image-left`, `image-right`, `full-bleed-image`), this wrapper constrains the layout to `max-w-5xl` with padding — the image panel won't bleed to the screen edge.
**Why it happens:** Existing layouts (title-body, bullets, etc.) are content-box centered. The new full-bleed layouts need the wrapper to step out.
**How to avoid:** The `image-focus` layout already solves this — it uses `absolute inset-0` inside `SlideContent`, breaking out of the Framer `div`'s max-width constraint by positioning absolutely relative to the outer container. The `image-left`, `image-right`, and `full-bleed-image` cases must use the same `absolute inset-0` approach, consistent with `image-focus` (line 145 of PresentationViewer.tsx).
**Warning signs:** Image panels constrained to center column width, not full screen width.

### Pitfall 3: TypeScript `switch` Exhaustiveness — `attribution` Field Access
**What goes wrong:** `slide.attribution` and `slide.attributionPt` don't yet exist on `SlideBlock` type. Accessing them in the `quote` case before the schema is updated causes `TS2339: Property 'attribution' does not exist`.
**Why it happens:** If Wave 2 (viewer) is coded before Wave 1 (schema), the TS type won't have the new fields.
**How to avoid:** Schema file (Wave 1) must be committed before viewer edits (Wave 2). Or code Wave 1 and Wave 2 in a single plan task that touches schema first.

### Pitfall 4: `buildSystemPrompt` Must Mention New Layouts
**What goes wrong:** UPDATE_SLIDES_TOOL JSON schema gets the new layout values, but `buildSystemPrompt` still says `"layout field matching one of: cover, section-break, title-body, bullets, stats, two-column, image-focus, closing"`. The AI won't use the new layouts because they're not in its instructions.
**Why it happens:** The tool schema and the system prompt text are separate strings — updating one doesn't update the other.
**How to avoid:** Update `buildSystemPrompt` in the same task as the UPDATE_SLIDES_TOOL update. The system prompt enum list (line 64 of presentationsChat.ts) must be extended with the 4 new layout names.

### Pitfall 5: `headingColor` Applied to All Text vs. Headings Only
**What goes wrong:** `headingColor` is intended for heading text only (D-03 spec: "can differ from body"). If `textColor` is applied to the whole wrapper, `headingColor` must override inline on the heading `<h1>`/`<h2>` elements.
**Why it happens:** The wrapper gets `color: textColor` which cascades; the heading element needs an explicit override.
**How to avoid:** In SlideContent cases, apply `style={{ color: slide.style?.headingColor }}` directly on the `<h1>`/`<h2>` elements when `headingColor` is set.

### Pitfall 6: `bgColor` Gradient String Conflicts with `bgImageUrl`
**What goes wrong:** If `bgColor` is a gradient (`linear-gradient(...)`) and `bgImageUrl` is also set, `background: gradient` overrides `backgroundImage: url(...)` because they both use the `background` CSS property.
**How to avoid:** Priority rule: if `bgImageUrl` is set, don't apply `bgColor` as a background (use it as a fallback overlay or ignore it). Use `background-image` for the URL and a separate `background-color` property for solid color fallbacks only.

---

## Code Examples

### Verified: Existing `image-focus` Layout Pattern (absolute inset-0)
```typescript
// Source: client/src/pages/PresentationViewer.tsx line 143-154
case 'image-focus':
  return (
    <div className="w-full h-full absolute inset-0 flex flex-col md:flex-row">
      <div className="flex-1 bg-zinc-800" />
      <div className="flex-1 flex items-center justify-center md:justify-start px-8 py-12 md:py-0 md:px-16 lg:px-24">
        <div className="max-w-2xl">
          {heading && <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="...">...</h2>}
          {body && <p className="...">...</p>}
        </div>
      </div>
    </div>
  );
```
This is the exact structural template for `image-left`, `image-right`, and `full-bleed-image`.

### Verified: Bilingual Field Pattern
```typescript
// Source: shared/schema/presentations.ts — all bilingual fields follow this pattern
heading:       z.string().optional(),
headingPt:     z.string().optional(),
// attribution follows the same pattern:
attribution:   z.string().optional(),
attributionPt: z.string().optional(),
```

### Verified: resolveField Helper Already Available
```typescript
// Source: client/src/pages/PresentationViewer.tsx line 56-59
function resolveField(en: string | undefined, pt: string | undefined, activeLang: string): string {
  if (activeLang === 'pt-BR') return pt || en || '';
  return en || '';
}
// attribution uses the same helper:
const attribution = resolveField(slide.attribution, slide.attributionPt, lang);
```

### Verified: Framer Motion Wrapper Structure
```typescript
// Source: client/src/pages/PresentationViewer.tsx lines 390-401
<motion.div
  key={currentIndex}
  custom={direction}
  variants={slideVariants}
  initial="enter"
  animate="center"
  exit="exit"
  transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
  className="relative z-10 px-8 max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto w-full"
>
  <SlideContent slide={currentSlide} lang={lang} />
</motion.div>
```
For full-bleed layouts, `SlideContent` uses `absolute inset-0` which escapes the `max-w-5xl` constraint, referencing the outer `absolute inset-0 flex items-center justify-center overflow-hidden` div at line 387.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (CLAUDE.md: "Manual QA only — no test framework available") |
| Config file | N/A |
| Quick run command | `npm run check` (TypeScript type-check only) |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| PRES2-01 | `slideBlockSchema` accepts `style` sub-object, all fields optional | manual | `npm run check` (TS type-check) | Zod parse verification in chat endpoint already in place |
| PRES2-02 | 4 new layouts accepted by Zod, `attribution`/`attributionPt` fields present | manual | `npm run check` | Existing enum validation in presentationsChat.ts covers this |
| PRES2-03 | Viewer renders new layouts and style properties | manual/visual | Browser QA | Use `?edit` mode with localStorage draft JSON |
| PRES2-04 | UPDATE_SLIDES_TOOL schema includes new layouts and `style` object | manual | `npm run check` + send test message in admin chat | AI must use new layouts in response |

### Sampling Rate
- **Per task commit:** `npm run check` — TypeScript must remain clean
- **Phase gate:** Manual browser QA using existing `?edit` preview mode before `/gsd:verify-work`

### Wave 0 Gaps
None — no test framework to configure. `npm run check` already works. Manual QA uses the existing `?edit&preview` URL mechanism in PresentationViewer.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes within the existing codebase. No external tools, services, CLIs, or runtimes beyond the project's existing Node.js + npm stack are required. No new API keys needed.

---

## Runtime State Inventory

Step 2.5: NOT APPLICABLE — this is not a rename/refactor/migration phase. The JSONB column auto-accommodates new fields. Existing slides have no `style` key and no `attribution` key; they continue to render via `default:` case fallback and undefined checks. No stored data migration is required.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `image-focus` renders `bg-zinc-800` placeholder | This phase: replace with real `style.bgImageUrl` background | Makes existing layout actually functional |
| All slide styling is hardcoded Tailwind | This phase: inline `style` prop overrides for AI-set colors | Opens dynamic branding capability |
| 8 layout enum values | This phase: 12 layout enum values | Richer AI design palette |

---

## Open Questions

1. **`full-bleed-image` text readability without scrim**
   - What we know: When `bgImageUrl` fills the slide entirely, white text on bright images may be unreadable.
   - What's unclear: Should the viewer add a default dark scrim overlay, or is that the AI's responsibility (using dark `bgColor` or dark images)?
   - Recommendation: Add a subtle fixed scrim (`bg-black/30 absolute inset-0`) specifically for the `full-bleed-image` and `image-left`/`image-right` layouts. This is Claude's discretion (D-06/layout proportions) and is a viewer concern, not schema concern. The scrim layer should be between the background image and the content.

2. **`image-focus` layout — which panel gets `style.bgImageUrl`?**
   - What we know: The existing `image-focus` case has `flex-1 bg-zinc-800` on left, text on right. D-07 says this phase replaces that placeholder.
   - What's unclear: Does it match the image-left pattern (left panel = image, right panel = text), or does it have a different split?
   - Recommendation: Treat `image-focus` as equivalent to `image-left` for rendering purposes — left panel becomes the background image panel using `style.bgImageUrl`. The distinction in naming is semantic/legacy; the implementation is identical.

---

## Sources

### Primary (HIGH confidence)
- `shared/schema/presentations.ts` — Live codebase read: existing slideBlockSchema, Zod patterns, JSONB column confirmation
- `client/src/pages/PresentationViewer.tsx` — Live codebase read: SlideContent switch (all 8 cases), motion.div wrapper structure, image-focus absolute-inset pattern
- `server/routes/presentationsChat.ts` — Live codebase read: UPDATE_SLIDES_TOOL hand-written JSON schema, buildSystemPrompt, confirmed `zod-to-json-schema` not installed
- `shared/schema.ts` — Live codebase read: barrel re-export; `presentations.ts` exported directly; no separate index file needed

### Secondary (MEDIUM confidence)
- `CLAUDE.md` — Project constraints: manual QA only, no test framework, 600-line file cap, TypeScript strict mode
- `.planning/phases/39-slide-design-system-v2/39-CONTEXT.md` — All locked decisions verified against live code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools are existing project dependencies; no research into new libraries needed
- Architecture: HIGH — patterns are directly visible in existing SlideContent code; image-focus provides the exact structural template
- Pitfalls: HIGH — derived from direct code inspection of the 3 canonical files (schema, viewer, chat route) plus TypeScript type propagation reasoning

**Research date:** 2026-05-15
**Valid until:** Stable (no external dependencies; valid until any of the 3 canonical files are modified)
