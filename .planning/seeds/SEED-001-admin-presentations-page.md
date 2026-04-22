---
id: SEED-001
status: dormant
planted: 2026-04-20
planted_during: v1.3 Links Page Upgrade (roadmap created, Phase 10 not started)
trigger_when: After v1.3 Links Page Upgrade ships (next milestone boundary — v1.4 candidate)
scope: Large
---

# SEED-001: Admin Presentations Page — AI-authored slide decks

## Why This Matters

Admin today has no structured way to deliver a narrative pitch (agency intro, service
overview, case studies) as a polished, sharable artifact. Estimates (v1.2) cover one
client scenario at a time. Links page (v1.3) is a launchpad, not a story. A presentations
surface closes that gap:

- Admin needs to present Skale Club / services / case studies without maintaining
  external PPT files that drift from the brand.
- The desired creation UX is **conversational with Claude** — admin describes what they
  want, AI drafts and edits slides, admin keeps iterating until the deck is ready.
  No visual drag-and-drop editor in the browser.
- Bilingual deliverable: same presentation must render in English **and** pt-BR
  depending on who's watching.
- Guarded creativity: AI must stick to brand guidelines (logo, colors, fonts, tone)
  while having freedom on content, sequence, and phrasing.

This is a differentiator — most agency CMSs don't ship a conversational deck builder.
Skale Club already has the pieces: fullscreen scroll-snap viewer (EstimateViewer),
chat infrastructure, multi-language (`useTranslation`), Supabase for storage.

## When to Surface

**Trigger:** After v1.3 Links Page Upgrade ships.

Present this seed during `/gsd:new-milestone` when the next milestone scope touches:

- Presentations / decks / slide authoring
- AI-assisted content authoring inside admin
- Bilingual content authoring
- Fullscreen shareable experiences (like `/e/:slug`)
- Brand guidelines enforcement in generated content

## Scope Estimate

**Large** — full milestone. Expect multiple phases:

1. Schema: `presentations` table (slides JSONB, language, version, guidelines snapshot), storage for assets
2. Guidelines / design-system JSON that Claude consumes as the system prompt (brand colors, fonts, tone, "always include", "never include")
3. Admin surface: list of presentations + chat-driven editor panel (similar shape to existing ChatSection + guardrails)
4. AI authoring pipeline: structured slide output (JSON), rendered by a slide component library (fullscreen scroll-snap or slide-by-slide)
5. Public viewer `/p/:slug` — isolated from Navbar/Footer like `/e/:slug`, language switcher in URL (`/p/:slug?lang=pt-BR|en`) or subpath
6. Editing loop: admin → AI → draft → admin adjusts → AI revises → commit

Open questions for the discuss-phase:
- Slide shape: fullscreen scroll-snap (like estimates) vs. discrete slide-by-slide with arrow nav vs. both modes?
- Storage of generated slides: JSONB structured blocks (title, body, image, bullets) vs. MDX strings?
- How is the guidelines doc authored — a single rich-text / markdown file the admin owns? Tenant-wide or per-presentation?
- Which Claude model (Opus for quality vs. Sonnet for cost) — probably Opus given it's a flagship authoring surface?
- How are brand assets (logo, background image) versioned with the deck so old presentations keep rendering correctly after brand refreshes?
- Does the AI also pick stock imagery or is every image supplied by admin?
- Preview language switching: live toggle in admin, or separate "generate pt-BR version" action?

## Breadcrumbs

Related code and decisions already in the codebase that inform this milestone:

- `client/src/pages/EstimateViewer.tsx` — fullscreen scroll-snap public viewer with IntersectionObserver nav dots and framer-motion section animations. Direct template for presentation rendering.
- `client/src/App.tsx` — `isEstimateRoute` guard that strips Navbar/Footer/ChatWidget for `/e/*`. Same pattern for `/p/*` presentations.
- `client/src/hooks/useTranslation.ts` + `client/src/lib/translations.ts` — existing i18n layer; presentations will add scoped translation keys OR store pt-BR/en content directly per slide in the DB row.
- `client/src/components/admin/ChatSection.tsx` — existing admin chat infrastructure; the conversational editor can borrow its shell (message list + input + streaming responses).
- `server/storage.ts` + `shared/schema/*` — drizzle + JSONB snapshot pattern from estimates (`[Phase 06 decision: JSONB snapshot, not FK]`) directly reusable for `presentations.slides`.
- `server/routes/integrations.ts` (GroqCard / AIAssistantCard etc.) — existing AI-provider plumbing; the authoring endpoint piggybacks on this plus Anthropic SDK.
- Key decisions worth re-reading before planning: raw-SQL tsx migrations (v1.2), UUID slugs for public viewers (v1.2), plain-text access code pattern (v1.2) — all reusable here.

## Notes

- Admin explicitly said "editing is NOT done in the browser visually, but by conversing
  with the AI." That constraint is load-bearing — the milestone should NOT invest in
  WYSIWYG tooling, drag-drop slide layout, etc. Budget goes into: structured AI output,
  guardrails, bilingual authoring, and the public viewer polish.
- Guidelines document is a first-class artifact — admin should author and version it.
  Consider a dedicated admin sub-section "Presentation Guidelines" that the AI reads as
  system prompt every time it authors.
- Consider a `presentation_views` table mirroring `estimate_views` so admin sees who
  watched what — reuses v1.2 analytics pattern.
- Consider asset-level reuse: if admin uploads logos / stock imagery to one deck, make
  them available to future decks (library).

## Candidate technologies

- **slides-grab** (supercent-io/skills-template — `presentation-builder` skill,
  https://skills.sh/supercent-io/skills-template/presentation-builder, source
  https://github.com/vkehfdl1/slides-grab): HTML-first slide creation with visual
  editor → validate → export to PPTX/PDF. Requires Node 18+ and Playwright. Core
  commands: `build-viewer`, `validate`, `convert`, `pdf`, `edit`, `list-templates`,
  `list-themes`. Appealing because:
  - Each slide is self-contained HTML/CSS — trivially editable by Claude via
    structured tool calls (no proprietary slide format to learn).
  - Built-in export pipeline covers the "I need a real PPTX to attach to an email"
    use case without us maintaining our own renderer.
  - Playwright renders decks deterministically → consistent preview + export.
  - Deck-per-directory structure (`decks/<deck-name>/slide-NN-*.html`) maps cleanly
    onto one-row-per-presentation + JSONB slide list (or one file per slide on disk
    with a manifest).
  - Risk to verify at discuss-phase: where do the HTML files live (filesystem vs.
    generated on demand from DB rows), how multi-tenant deployment on Vercel handles
    Playwright (serverless-unfriendly), and how our bilingual requirement maps onto
    its single-locale deck model.
- Alternative native path: render slides directly with our existing fullscreen
  scroll-snap EstimateViewer pattern, no slides-grab dependency — trade PPTX export
  for tighter integration with the app's look & feel. Decision to make at
  discuss-phase.
