# Quick Task 260906-fu3: NFC keychain landing + pricing explainer pages (EN+PT) - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning

<domain>
## Task Boundary

Two bilingual page pairs for a new product line — custom 3D-printed NFC keychains — sold to
**Brazilian business owners living in the United States**.

1. **Landing pair** — the ad/traffic destination that captures leads.
2. **Explainer ("manual de instruções") pair** — a self-serve page answering price, process,
   timeline and objections. It is sent to the lead by a WhatsApp automation running on an
   external platform (not built here), which is why it must stand alone with no human present.

Plus the three new section renderers the explainer page needs, since no pricing / FAQ /
long-form content section exists in the registry today.

**Out of scope:** the Xphere booking integration, the WhatsApp automation itself, any DB
schema change, any new form question type.

</domain>

<decisions>
## Implementation Decisions

### Page structure & languages
- **EN + PT pair for BOTH pages** (4 `pages` rows total), mirroring the barbershop pattern.
- Landing: `nfc-keychains` (en) ⇄ `chaveiros-nfc` (pt)
- Explainer: `nfc-pricing` (en) ⇄ `precos-chaveiros` (pt)
- Reciprocal `alternateSlug` on each pair drives hreflang in `DynamicLanding.tsx`.
- **All copy authored in English.** English is the `t()` source language — PT copy in props
  would leak Portuguese onto the EN pages. `pages.language` drives the PT rendering.
- None of the four slugs collide with `RESERVED_SLUGS`; that file is not to be touched.

### Explainer page composition
User selected all four blocks:
- `pricingTable` — NEW section component
- `processStepper` — REUSE the existing component (no new component)
- `faqAccordion` — NEW section component
- `contentBlocks` — NEW section component

`ProcessStepperSection` gets an OPTIONAL `icons` prop so this product can show relevant icons
instead of the website-build defaults. Must remain non-breaking for `/websites` and
`/barbershops`, which both pass `props: {}`.

### Pricing (CONFIRMED by user — the only real numbers, invent nothing else)
- **$10 per piece**
- **Minimum order 20 pieces** ⇒ **$200 minimum order**
- **$50 one-time art/design fee**, charged on the **first order only**, waived from the
  second order onward
- **100% payment upfront**, before production starts

### Lead form
- New form, slug `nfc-keychain-leads`, `isActive: true`, `isDefault: false`.
- **Unscored**: `maxScore: 0`, all thresholds `0`, every option `points: 0` — same as
  `barbershop-leads`. All leads route as `novo`.
- `nome` / `telefone` / `email` map to native `form_leads` columns; every other question id
  falls through to `form_leads.customAnswers` (jsonb).
- `jaTemLogo` exists specifically to signal whether the $50 art fee will apply.
- `quantidadeEstimada` options are anchored on the 20-piece minimum.

### Claude's Discretion
- Exact question wording, option labels, and section copy (within the confirmed pricing facts).
- Visual detail of the three new components, constrained to match `ProcessStepperSection.tsx`
  conventions (zinc palette, `#1C53A3` accent, `data-testid`, `t()` on every visible string).
- Lucide icon choices for the new `icons` allowlist.

</decisions>

<specifics>
## Specific Ideas

- Product: custom 3D-printed NFC keychains. A phone tap opens a link — Google review page,
  Instagram, digital business card (vCard), menu, or website.
- `scripts/seed-barbershop-landing.ts` is the structural template: relative `.js` import
  specifiers (the `#shared/` alias is unavailable to standalone `tsx` scripts),
  `// ── Section ──` dividers, `upsertForm()` / `upsertLanding(spec)` SELECT-then-UPDATE-or-INSERT
  helpers, `main()` + `main().catch()` with `pool.end()`.
- `client/src/components/pages/sectionRegistry.ts` is the ONLY registry — the server does not
  validate section types, so registering there is sufficient.
- `tipoVisita` captures meeting FORMAT only. Leave the Xphere block comment, as the barbershop
  script does.

</specifics>

<canonical_refs>
## Canonical References

- `scripts/seed-barbershop-landing.ts` — seed script structure to mirror
- `client/src/components/pages/sections/ProcessStepperSection.tsx` — section component conventions
- `client/src/components/pages/sectionRegistry.ts` — registration point
- `client/src/pages/DynamicLanding.tsx` — render + hreflang behaviour
- `shared/schema/forms.ts` — `FormQuestion` / `FormConfig` types
- `shared/schema/pages.ts` — `PageSection` type
- `.planning/quick/260906-e15-*/260906-e15-SUMMARY.md` — the barbershop precedent

</canonical_refs>
