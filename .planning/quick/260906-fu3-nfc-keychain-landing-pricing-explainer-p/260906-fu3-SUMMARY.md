---
quick_id: 260906-fu3
type: execute
description: NFC keychain landing + pricing explainer pages (EN+PT)
status: complete
subsystem: landing-pages
tags: [landing, nfc-keychains, section-registry, seed-script, bilingual]
dependency_graph:
  requires:
    - client/src/components/pages/sectionRegistry.ts (only registration point)
    - client/src/components/ui/accordion.tsx (Radix accordion primitives)
    - scripts/seed-barbershop-landing.ts (structural template)
    - shared/schema/forms.ts (FormQuestion / FormConfig / phoneCountry type)
    - shared/schema/pages.ts (PageSection)
  provides:
    - section types pricingTable, faqAccordion, contentBlocks
    - processStepper optional `icons` enum-allowlist prop
    - scripts/seed-nfc-keychains-landing.ts (nfc-keychain-leads form + 4 pages rows)
    - scripts/seed-nfc-keychains-translations.ts (112 hand-written en->pt pairs)
  affects:
    - client/src/pages/DynamicLanding.tsx (resolves the three new types via the registry)
tech_stack:
  added: []
  patterns:
    - zod props schema with all-optional fields so safeParse({}) succeeds
    - English DEFAULTS as t() source language; pages.language drives PT
    - closed zod enum allowlist keyed to a lucide component map (no free-form icon strings)
    - idempotent SELECT-then-UPDATE-or-INSERT seed with a per-spec sections field
key_files:
  created:
    - client/src/components/pages/sections/PricingTableSection.tsx
    - client/src/components/pages/sections/FaqAccordionSection.tsx
    - client/src/components/pages/sections/ContentBlocksSection.tsx
    - scripts/seed-nfc-keychains-landing.ts
    - scripts/seed-nfc-keychains-translations.ts
  modified:
    - client/src/components/pages/sections/ProcessStepperSection.tsx
    - client/src/components/pages/sectionRegistry.ts
decisions:
  - "processStepper icons are a closed 16-name zod enum mapped to lucide components, not z.string() — seeded props cannot reference an icon absent from the bundle"
  - "PricingTableSection defaults typed as PriceLine[] (schema-inferred) instead of `as const` so the optional `note` slot exists on every union member"
  - "NFC_STEPPER_PROPS is a single shared const referenced by both LANDING_SECTIONS and PRICING_SECTIONS so the landing and explainer steppers never drift"
  - "The 'How long does it take?' FAQ deliberately states no number — window is confirmed in writing at order approval; editable later in the admin page editor"
metrics:
  tasks_completed: 3
  tasks_total: 3
  commits: 3
  completed: 2026-09-06
---

# Quick Task 260906-fu3: NFC Keychain Landing + Pricing Explainer (EN+PT) Summary

Three new registry section types (`pricingTable`, `faqAccordion`, `contentBlocks`), an
optional enum-allowlisted `icons` prop on `processStepper`, and an idempotent seed script
authoring the unscored `nfc-keychain-leads` form plus four bilingual `pages` rows — with
the production seed run held behind an explicit user-approval gate.

## Status

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | Three new section components + optional stepper icons + registry wiring | Complete | `2851f08` |
| 2 | Author `scripts/seed-nfc-keychains-landing.ts` (not run) | Complete | `029a783` |
| 3 | GATED — run the seed against the production Supabase DB | **PENDING — awaiting user approval** | — |

`npm run check` (tsc, strict) exits 0 after Task 1 and again after Task 2.

## Task 1 — Section components + registry

### New section types

| Type | File | Schema shape (all fields optional) |
|------|------|------------------------------------|
| `pricingTable` | `client/src/components/pages/sections/PricingTableSection.tsx` | `eyebrow, heading, subheading, lines[{label, price, note?, kind: one-time \| per-unit \| minimum}], footnote` |
| `faqAccordion` | `client/src/components/pages/sections/FaqAccordionSection.tsx` | `eyebrow, heading, subheading, items[{question, answer}]` |
| `contentBlocks` | `client/src/components/pages/sections/ContentBlocksSection.tsx` | `eyebrow, heading, subheading, blocks[{heading, paragraphs[], bullets?[]}]` |

All three mirror `ProcessStepperSection.tsx` conventions: file-header comment, exported
`<name>PropsSchema` + `<Name>Props`, English `DEFAULTS`, `props.x ?? DEFAULTS.x`, every
visible string through `t()`, `data-testid` on the `<section>` and each repeated item,
zinc palette + `#1C53A3` accent + `font-display` headings. Every schema field is
`.optional()` so `safeParse({})` succeeds (DynamicLanding renders nothing on a failed parse).

`PricingTableSection` DEFAULTS carry the confirmed pricing so a bare `props: {}` still
renders $10 / $200 / $50 correctly.

### `processStepper` icons allowlist — shipped as specified, nothing dropped

All 16 names exist in lucide-react 0.453.0 (`Code2` is exported as an alias of `CodeXml`,
which is why a naive `declare const Code2` grep misses it — it already compiled before
this change):

```
Search, Palette, Code2, Rocket,
MessageCircle, PenTool, Factory, Truck,
Nfc, Smartphone, QrCode, Star,
CreditCard, Package, Link2, Check
```

`processStepperPropsSchema.icons` is `z.array(z.enum(processStepperIconNames)).length(4).optional()`.
Resolution: `props.icons ? props.icons.map(n => ICON_MAP[n]) : ICONS` where `ICONS` is the
untouched `[Search, Palette, Code2, Rocket]`. No existing default, class, markup, or
`data-testid` changed — `/websites` and `/barbershops` (both `props: {}`) render as before.

### Registry

Three imports + three entries added to `sectionRegistry`. The stale comment claiming a
`shared/landingSectionRegistry` server-side counterpart was replaced with a note that this
registry is the only registration point and the server stores `props` unvalidated.

## Task 2 — Seed script (authored, NOT executed)

`scripts/seed-nfc-keychains-landing.ts` mirrors `seed-barbershop-landing.ts` section for
section (`dotenv/config`, relative `.js` specifiers, `// ── … ──` dividers, `upsertForm()`,
`upsertLanding(spec)`, `main()` + `main().catch()` with `pool.end()`). `LandingSpec` was
extended with a `sections: PageSection[]` field because two different section arrays are
seeded.

**Form `nfc-keychain-leads`** — `isActive: true`, `isDefault: false`, `maxScore: 0`,
thresholds all 0, `points: 0` on all 28 options (verified: 28 `points: 0` / 28 `{ value:`).
11 questions in order: `nome`, `telefone` (phoneCountry), `email`, `nomeEmpresa`,
`tipoNegocio`, `quantidadeEstimada` (anchored on the 20-piece minimum), `objetivoChaveiro`,
`jaTemLogo` (signals the $50 first-order art fee; fee not stated in labels),
`prazoDesejado` (urgency only, no SLA), `tipoVisita` (meeting format only, Xphere block
comment above it), `observacoes` (optional).

The ID-mapping comment block documents that `tipoNegocio` maps to the native
`form_leads.tipo_negocio` column (it is in `KNOWN_FIELD_IDS`, so `LeadFormModal` filters it
out of `customAnswers`), that `observacoes` falls through to `customAnswers` despite a
same-named native column, and that all remaining ids land in `customAnswers`.

**Pages (4 rows)**

| slug | name | language | alternateSlug | sections |
|------|------|----------|---------------|----------|
| `nfc-keychains` | NFC Keychains (EN) | en | `chaveiros-nfc` | LANDING_SECTIONS |
| `chaveiros-nfc` | NFC Keychains (PT) | pt | `nfc-keychains` | LANDING_SECTIONS |
| `nfc-pricing` | NFC Pricing (EN) | en | `precos-chaveiros` | PRICING_SECTIONS |
| `precos-chaveiros` | NFC Pricing (PT) | pt | `nfc-pricing` | PRICING_SECTIONS |

- `LANDING_SECTIONS`: heroWebsites (no pricing in hero), trustBadges `{}`, processStepper
  (custom 4 steps + `icons: ["MessageCircle", "PenTool", "Factory", "Truck"]`), reviews `{}`
  (real reviews only), leadFormCta (`formSlug: "nfc-keychain-leads"`).
- `PRICING_SECTIONS`: contentBlocks (3 blocks with bullets), pricingTable (exact 3 lines +
  100%-upfront footnote), processStepper (same shared props const), faqAccordion (8 items),
  leadFormCta ("I want to order").

### Copy-constraint verification (read-back, no DB access)

- Dollar figures present: `$10` x4, `$200` x3, `$50` x5 — nothing else.
- `grep -nE "[0-9]+ ?(day|days|week|weeks|business day)"` → no matches.
- No testimonials, discounts, volume tiers, "X businesses served" stats, or shipping costs.
- All copy authored in English.
- Every `type:` used in the sections arrays (`heroWebsites, trustBadges, processStepper,
  reviews, leadFormCta, contentBlocks, pricingTable, faqAccordion`) is a `sectionRegistry` key.

### Deliberate omission: no turnaround-time claim

The "How long does it take?" FAQ answer states no number. It says production starts once
payment clears and the artwork is approved, and that the exact production + delivery window
is confirmed in writing when the order is approved. There are zero placeholder tokens in
the seeded copy. If a published SLA is wanted later, it is a one-field edit on the
`faqAccordion` section in the admin page editor — no code change.

## Task 3 — PENDING (awaiting user approval)

**Seeded row ids: not seeded.** The production database is untouched. The script has never
been executed. The orchestrator must obtain an explicit affirmative from the user before
running:

```
npx tsx --env-file=.env scripts/seed-nfc-keychains-landing.ts
```

It will upsert `forms.nfc-keychain-leads` and the 4 `pages` rows (`nfc-keychains`,
`chaveiros-nfc`, `nfc-pricing`, `precos-chaveiros`) into the live Supabase DB. After the
run, spot-check those four slugs plus `/websites` and `/barbershops` (stepper regression).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing `PricingTableSection.tsx` failed `tsc`**
- **Found during:** Task 1 (file was left on disk by an interrupted earlier executor run)
- **Issue:** `DEFAULTS.lines` used `as const` with the first entry lacking `note`, so the
  inferred union had a member without that property and `line.note` raised TS2339 twice.
- **Fix:** Typed the defaults as `DEFAULT_LINES: PriceLine[]` (schema-inferred) and
  referenced that from `DEFAULTS`. No rendering or copy change.
- **Files modified:** `client/src/components/pages/sections/PricingTableSection.tsx`
- **Commit:** `2851f08`

No other deviations. `shared/reservedSlugs.ts`, `scripts/seed-websites-landing.ts`,
`scripts/seed-barbershop-landing.ts`, and all `shared/schema/*` files are untouched. No new
npm dependency, no migration, no new `FormQuestionType`.

## Known Stubs

None. `ContentBlocksSection` DEFAULTS include `bullets: []` on each default block purely to
keep the `as const` union type-compatible with `block.bullets`; the seeded pages supply real
bullets and the component hides the list when empty.

## Self-Check: PASSED

- FOUND: client/src/components/pages/sections/PricingTableSection.tsx
- FOUND: client/src/components/pages/sections/FaqAccordionSection.tsx
- FOUND: client/src/components/pages/sections/ContentBlocksSection.tsx
- FOUND: scripts/seed-nfc-keychains-landing.ts
- FOUND: commit 2851f08
- FOUND: commit 029a783

---

## Task 3 — Production seed (APPROVED and RUN)

The user explicitly approved the write. `npx tsx --env-file=.env scripts/seed-nfc-keychains-landing.ts`
was run twice against the production Supabase DB.

**Run 1 — inserted 5 rows:**

| Row | Slug | Id |
|-----|------|-----|
| forms | `nfc-keychain-leads` | `5` |
| pages | `nfc-keychains` (en) | `f3ea68dd-5bcc-452a-b6d2-694f9b5908e4` |
| pages | `chaveiros-nfc` (pt) | `a8ceed60-7128-41e1-a992-0171c39bbf6d` |
| pages | `nfc-pricing` (en) | `d5c03dc6-54b1-43db-a149-e3986bd5fd63` |
| pages | `precos-chaveiros` (pt) | `90ed32ce-7b14-4e12-9a8b-ba5364dedc11` |

**Run 2 — idempotency proof:** identical ids, every line reported "Updated existing". No duplicate rows.

## Task 4 (added during verification) — pt-BR translations seed

Browser verification exposed a gap the plan had not anticipated: with the page rows seeded,
`/chaveiros-nfc` and `/precos-chaveiros` rendered the **English source copy**. `t()` consults
the `translations` table first and only then calls `POST /api/translate`; that endpoint answers
200 but returns nothing usable, so an uncached string falls through to its English source.
The barbershop pair had already hit this, which is what `scripts/seed-barbershop-translations.ts`
(commit `dceb450`, another session) exists to solve.

`scripts/seed-nfc-keychains-translations.ts` (commit `98f4bf4`) applies the same remedy to this
product: **112 hand-written en→pt pairs** covering every question title, option label, the shared
`processStepper` copy, the landing hero/CTA, and the explainer's `contentBlocks` / `pricingTable`
/ `faqAccordion` / CTA strings.

- Run 1: 35 inserted, 77 updated (the 77 were rows the AI translator had already created during
  verification browsing, now overwritten with the hand-written copy).
- Run 2: 0 inserted, 112 updated — idempotent.
- Excluded deliberately: the `nfc-keychain-leads` form slug (a lookup key, not display text) and
  the string `One-time`, which production already caches as `Única` and is shared with other pages.
- PT prices restated as `US$ 10` / `US$ 200` / `US$ 50`. Still no turnaround claim in either language.

## Browser verification (dev server, port 5000)

| Check | Result |
|-------|--------|
| `/nfc-pricing` renders | 4 new sections present, `contentBlocks` + `pricingTable` + `processStepper` + `faqAccordion` |
| Unknown/invalid section warnings | 0 on all four pages |
| Console errors | none |
| Price rows | `$10` per unit · `$200` minimum (`20 pieces × $10`) · `$50` one-time, first order only |
| FAQ items | 8 rendered; "How long does it take?" carries no number |
| `/nfc-keychains` hero | "One tap. Your customers land exactly where you want them." |
| NFC stepper icons | `message-circle`, `pen-tool`, `factory`, `truck` |
| hreflang | reciprocal `en` / `pt-BR` / `x-default` on both pairs |
| `/precos-chaveiros` after translations seed | fully Portuguese — headings, price labels, all 8 FAQ questions |
| `/chaveiros-nfc` after translations seed | fully Portuguese — hero, steps, CTA "Quero meus chaveiros" |
| Lead form opens on the PT landing | yes — "VAMOS COMEÇAR! / Qual é o seu nome?" |
| **Regression** `/websites` stepper | `search`, `palette`, `code-xml`, `rocket` — Discovery/Design/Build/Launch, unchanged |
| **Regression** `/barbershops` stepper | `search`, `palette`, `code-xml`, `rocket` — unchanged |
| `npm run check` | exit 0, before and after every commit |

## Known defect found during verification (NOT introduced here, NOT fixed)

`client/src/components/LeadFormModal.tsx:1096` and `:1110` render
`placeholder={currentQuestion.placeholder || ""}` — the placeholder is **not** wrapped in `t()`,
so form input placeholders always render in the source language. On `/chaveiros-nfc` the question
title shows "Qual é o seu nome?" above an input still reading "Your full name".

This is a pre-existing, site-wide bug: it affects `/barbershops-br` and every other PT form
identically, and it is why the placeholder pairs seeded by both translation scripts can never be
used. It was left untouched deliberately — `LeadFormModal.tsx` is a ~1300-line shared component
behind every form on the site, so wrapping placeholders in `t()` changes behavior on production
pages well outside this task's scope. Flagged for the user to decide.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `2851f08` | pricingTable, faqAccordion, contentBlocks sections + optional stepper icons |
| 2 | `029a783` | NFC keychain landing + pricing explainer seed script |
| 3 | — | DB writes only, no repo diff |
| 4 | `98f4bf4` | hand-written pt-BR translations for the NFC keychain pages |
