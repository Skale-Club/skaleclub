# Research Summary — v1.4 Admin Presentations Page

**Project:** Skale Club — Admin Presentations Page
**Domain:** AI-authored bilingual slide decks with fullscreen public viewer
**Researched:** 2026-04-20
**Confidence:** HIGH (stack + architecture), MEDIUM (AI pipeline + slide schema)

---

## Stack Additions

| Library | Version | Why | Already Exists? |
|---------|---------|-----|-----------------|
| `@anthropic-ai/sdk` | `^0.90.0` | Native streaming + tool_use + prompt caching — not available through OpenAI-compat shim | No — must install |
| `react-markdown` | `^10.1.0` | Full block markdown (headings, tables) for slide body text; existing markdown.tsx is inline-only | No — must install |
| `remark-gfm` | `^4.0.1` | GFM tables/strikethrough; Claude emits GFM syntax naturally | No — must install |

### Do NOT Add

| Package | Reason |
|---------|--------|
| `@ai-sdk/anthropic` (Vercel AI SDK) | Adds abstraction over an already clean SDK; unnecessary indirection with Express SSE |
| `i18next` / `react-i18next` | Project already has `useTranslation`; bilingual slides use JSONB locale keys, not a runtime framework |
| `reveal.js` / `impress.js` | External slide runtimes conflict with scroll-snap viewer architecture; 100–400 KB for zero gain |
| `pptxgenjs` / `playwright` | Export deferred to future milestone; Playwright is serverless-hostile on Vercel |
| `react-quill` / `tiptap` or any WYSIWYG | Seed constraint explicitly rules out a visual editor — admin edits via chat only |
| `rehype-highlight` / `highlight.js` | No code blocks in slide content; significant bundle weight for unused feature |

---

## Feature Table Stakes

### Must-Have for v1.4

- Chat prompt to Claude to structured slide JSON (core value prop)
- Structured SlideBlock[] JSONB stored in DB, typed with Zod discriminated union
- Brand guidelines document stored as DB singleton — consumed as Claude system prompt
- Bilingual output: EN + PT-BR per slide, stored as locale keys within each block (heading / headingPt)
- Public fullscreen viewer /p/:slug — isolated from Navbar/Footer, scroll-snap, framer-motion
- Access code gate on public viewer (copy estimates pattern verbatim)
- View tracking (presentation_views event-log, mirrors estimate_views)
- Slide delete + basic CRUD in admin
- Admin slide preview (see rendered deck before sharing)
- Per-slide re-generation as default; full deck regen as explicit opt-in
- Language switcher on public viewer via ?lang=en|pt-BR (client-side state, no re-fetch)

### Differentiators

- Brand guidelines as a first-class editable DB artifact (not inline per-prompt text)
- Per-slide edit scope — surgical chat edits preserve approved slides
- Drag reorder (dnd-kit already installed — low effort)
- Outline-first UX: Claude proposes structure before generating full content
- Typed layout variants (cover, bullets, stats, two-column, closing, etc.) — Claude picks layout per content type

### Explicitly Deferred

- PPTX / PDF export (requires Playwright — serverless-hostile)
- AI image selection / generation (brand compliance unpredictable)
- quote, team, case-study layout variants (additive — no schema change needed; ship in v1.5)
- WYSIWYG / direct text editing (out of scope per seed constraint)
- Chat history persistence across sessions (nice-to-have; presentation_messages table addable later)

---

## Architecture Decisions

### Key Schema Decisions

- **Inline bilingual JSONB** — each SlideBlock carries heading + headingPt (not separate rows per locale). Single row per deck; atomic saves; language switch is pure React state.
- **Separate presentation_brand_guidelines singleton table** — company_settings is already overloaded; guidelines are independently versioned and authored. Hard 400 on missing guidelines at authoring time — no silent empty-string fallback.
- **guidelinesSnapshot JSONB on presentations** — snapshot of active guidelines at save time mirrors the services JSONB snapshot pattern from v1.2. Old presentations render consistently after brand changes.
- **JSONB slides on presentations row (not normalized slides table)** — no query ever fetches individual slides independently; inline keeps reads to one row.
- **/p/:slug isolation via isPresentationRoute guard in App.tsx** — character-for-character copy of isEstimateRoute guard added at line 120. Route added before the layout branch.

### Phase Build Order

| Phase # | Focus | Key Deliverable |
|---------|-------|-----------------|
| 1 | Schema + Migration | shared/schema/presentations.ts, 3 new tables, raw SQL tsx migration, @anthropic-ai/sdk in package.json |
| 2 | Storage + CRUD API | All storage methods in storage.ts, server/routes/presentations.ts (non-AI endpoints), registration in routes.ts |
| 3 | Brand Guidelines | Guidelines endpoints, BrandGuidelinesEditor.tsx, Admin wiring for guidelines sub-section |
| 4 | AI Authoring Endpoint | server/lib/presentation-prompt.ts, SSE streaming endpoint, Anthropic SDK integration with tool_use |
| 5 | Admin Chat UI | PresentationsSection.tsx, PresentationChatEditor.tsx, SlidePreview.tsx, full Admin.tsx wiring |
| 6 | Public Viewer | PresentationViewer.tsx, isPresentationRoute guard, access-code gate, language switcher, view tracking |

Phases 5 and 6 can be built in parallel after Phase 4 completes.

### Modified Files

```
shared/schema.ts                            — add barrel re-export for presentations schema
server/storage.ts                           — 8 new storage methods
server/routes.ts                            — registerPresentationsRoutes(app) call
client/src/App.tsx                          — isPresentationRoute guard + PresentationViewer lazy import
client/src/pages/Admin.tsx                  — PresentationsSection import, render, slugMap, sectionsWithOwnHeader, layout branch
client/src/components/admin/shared/types.ts — presentations added to AdminSection union
client/src/components/admin/shared/constants.ts — SIDEBAR_MENU_ITEMS entry
client/src/lib/translations.ts              — PT strings for any new t() calls
package.json                                — @anthropic-ai/sdk dependency
```

---

## Watch Out For

| Pitfall | Risk | Prevention | Phase |
|---------|------|------------|-------|
| Writing streamed JSON fragments to DB | JSON.parse on partial input_json_delta throws; corrupt JSONB silently stored | Accumulate full tool_use delta server-side; Zod-validate only after content_block_stop; write to DB only on success | 4 |
| Routing through OpenAI-compat shim for Anthropic | Loses tool_use grammar, prompt caching, Structured Outputs beta | Install @anthropic-ai/sdk; create server/lib/anthropic.ts; keep separate from getActiveAIClient() | 1 (blocker) |
| compression() middleware buffering SSE | All tokens arrive simultaneously; 504 on Vercel if Claude takes >30s | Call res.flush() after every res.write(); set X-Accel-Buffering: no header | 4 |
| /p/:slug landing inside standard layout branch | Navbar, Footer, ChatWidget overlay fullscreen slides | Add isPresentationRoute guard in App.tsx before layout branch — mirror of isEstimateRoute | 6 |
| Language toggle via Wouter Link causing full re-mount | IntersectionObserver torn down; scroll snaps to top | Store language in useState; reflect in URL via history.replaceState only | 6 |

---

## Open Questions

- **Slide schema shape alignment**: FEATURES.md uses nested content: { en, pt-BR } objects; ARCHITECTURE.md uses flat heading + headingPt fields. Align on one shape before writing the migration — load-bearing for every downstream component.
- **tool_use vs Structured Outputs beta**: Structured Outputs (constrained decoding) is beta for Sonnet 4.5 / Opus 4.1 only. Decide at Phase 4 whether to use tool_use (safer, all models) or Structured Outputs beta. Research recommends tool_use.
- **Anthropic SDK model ID**: Confirm exact Claude Opus/Sonnet model ID string via the Anthropic models list endpoint at Phase 4 start — IDs change between versions.
- **Slide image source**: Admin uploads via existing Supabase endpoint, or Claude suggests URLs? Clarify before Phase 5 to determine whether DragDropUploader reuse is needed.
- **Brand guidelines character cap**: PITFALLS.md recommends capping at 2,000 characters with a live counter. Confirm this UX constraint before Phase 3.
- **/p/ prefix reservation**: Verify getPageSlugsValidationError in shared/pageSlugs.ts gets p added alongside e and f — missing entry allows page slug collision that silently breaks all presentation public links.

---

*Research completed: 2026-04-20*
*Ready for roadmap: yes*