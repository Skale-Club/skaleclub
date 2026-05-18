# Phase 44: Landing /websites — homepage-style hero, new section, website-leads form with country selector

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Mode:** Direct context — user specified scope explicitly, autonomous workflow

<domain>
## Phase Boundary

Build the first net-new managed landing on top of the Phase 43 system,
served at `skale.club/websites`. Visual style mirrors the Home page
(full marketing page with hero → trust → services → reviews → CTA),
NOT the minimal SkaleHubGroup style. Target audience: businesses
looking to commission a website. Three net-new pieces to ship alongside
the landing seed:

  1. **New hero variant** (`heroWebsites`) — custom copy and visual for
     the website-build service. Different from the Home hero.
  2. **At least one net-new section type** that doesn't exist on the
     Home today (planner picks the best fit: process stepper, pricing
     packages, or portfolio grid).
  3. **New form** (`website-leads`) with a working country selector,
     phone number formatted per country, project-specific questions.

In scope:
- `client/src/components/landings/HeroWebsites.tsx` — the new hero.
- Net-new section component(s) under `client/src/components/landings/`.
- Both registered in the Phase 43 section registry.
- Form record `website-leads` seeded into the `forms` table with
  appropriate questions (project type, country, contact info, budget,
  deadline).
- Country selector field on the form: reuses
  `client/src/components/ui/PhoneCountrySelect.tsx` and
  `client/src/lib/phoneCountries.ts` already in the codebase. NO new
  country list — the existing ~250-country list with flags is the
  source of truth.
- One-shot seeding script `scripts/seed-websites-landing.ts` that
  creates the `website-leads` form and the `landing_pages` row for
  `/websites` (idempotent via slug check).
- E2E: visit `/websites` → see landing → submit form → row created in
  `form_leads` + GHL contact-create fires.

Out of scope:
- Multiple website-related landings (only `/websites` ships in this
  phase).
- Pricing implementation (just a marketing pricing table, not a
  payment integration).
- Multi-language for the landing itself (pt-BR copy ships first; en
  can be added by editing the landing's section props via admin).
- Visual editor for the landing — JSON editor (from Phase 43) is the
  authoring UX.

</domain>

<decisions>
## Implementation Decisions

### Visual style
- Mirror the Home page tone: brand blue (#1C53A3) + yellow CTA
  (#FFFF01), Outfit headings, Inter body, pill-shaped CTA buttons
  (`rounded-full`).
- Hero variant `heroWebsites`: large heading, supporting subheadline,
  yellow CTA button, decorative background image or gradient. Should
  feel cohesive with the Home hero without being a copy.
- The net-new section ships as a `processStepper` by default (steps for
  "how we build a website": Discovery → Design → Build → Launch). The
  planner is free to swap to `pricingPackages` or `portfolioGrid` if
  better-justified.

### Form schema
- `forms` table already supports N forms (Multi-Forms v1.1). No schema
  change needed.
- Form questions for `website-leads` (authored in pt-BR — matches the
  project's primary market):
  1. Name (text, required)
  2. Country (country selector, required, default detected from
     browser locale)
  3. WhatsApp/Phone (phone field paired with the country selector for
     formatting; reuses the SkaleHubGroup pattern)
  4. Email (email, required)
  5. Business / project name (text, optional)
  6. Project type (radio: landing page / institutional site / e-commerce
     / web app / other)
  7. Budget range (radio: <$1k / $1k-$3k / $3k-$10k / >$10k / open)
  8. Deadline (radio: ASAP / 1-3 months / 3-6 months / no rush)
  9. Anything else we should know? (textarea, optional)

### Country selector reuse
- The Phase 44 form must integrate `<PhoneCountrySelect>` as a custom
  form field type. The existing form-rendering code in
  `client/src/pages/PublicForm.tsx` may need a new field type
  `'country'` (or a coupled `'phoneWithCountry'`) registered in the
  form-question type union. If the form system already supports it,
  reuse; if not, add it as a small extension.
- Submission persists ISO 3166-1 alpha-2 code (`BR`, `US`) plus the
  full international phone string, matching the SkaleHubGroup payload
  shape so the existing GHL integration keeps working.

### GHL integration
- Reuse the existing form-lead → GHL contact-create pipeline. New form
  `website-leads` should appear as opportunities tagged with the form
  slug so the team can filter website leads in the GHL pipeline.

### English code, pt-BR copy
- All UI strings authored by Claude in English (button labels, error
  messages, helper text).
- Form question copy and landing section copy authored in pt-BR
  matching the existing Home page tone.

### Claude's Discretion
- Exact hero headline, subheadline, and supporting copy for the
  landing (planner generates draft, ships in admin so user can edit
  without code).
- Background image choice for the hero (use a placeholder image URL or
  a solid gradient if no production asset is ready).
- Final pick of the net-new section type (process / pricing / portfolio).
- Whether to add a small testimonial section, FAQ accordion, or other
  homepage primitives to the landing composition.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 43 ships the section registry — Phase 44 registers
  `heroWebsites` and the net-new section there.
- `<PhoneCountrySelect>` and `phoneCountries.ts` (already in codebase,
  used by SkaleHubGroup) — direct reuse for the country selector.
- `LeadFormModal` + `PublicForm.tsx` — existing form rendering. Phase
  44 either reuses as-is OR adds a `country` field type if not yet
  supported.
- Form system supports per-form question lists (Multi-Forms v1.1).

### Established Patterns
- One-shot seeding scripts under `scripts/` for content-side migrations
  (`scripts/seed-faqs.ts`, `scripts/create-negative-words-presentation.ts`).
  Use the same pattern for `seed-websites-landing.ts`.
- Tailwind classes for the visual style — Brand Guidelines in CLAUDE.md
  specify the palette and CTA shape.
- React Query for form fetching and submission.

### Integration Points
- `App.tsx` — already gains the `/:slug` catch-all in Phase 43; Phase
  44 doesn't touch routing.
- `Admin.tsx` — no change. Landing is managed via the Landings admin
  section that Phase 43 builds.
- `server/routes/forms.ts` — handles form submissions for any form
  slug; should accept `website-leads` automatically.
- `server/integrations/ghl.ts` — GHL contact-create fires for any new
  form lead.

</code_context>

<specifics>
## Specific Ideas

- The hero CTA scrolls smoothly to the `leadFormCta` section (smooth
  scroll already a pattern in the Home page).
- Country selector default: detect from `navigator.language` (e.g.,
  `pt-BR` → Brazil). The `detectDefaultPhoneCountry()` helper already
  does this.
- For the form: phone field validates per country (US format is
  +1 (XXX) XXX-XXXX, Brazil is +55 (XX) XXXXX-XXXX) via the existing
  helpers.
- The seeded landing should be `is_active=true` so it's live as soon
  as deploy lands.

</specifics>

<deferred>
## Deferred Ideas

- A second website-related landing (e.g., `/landing-pages` for the
  landing-page service specifically vs `/websites` as the umbrella).
- A/B test of two hero variants.
- Translation of the landing into English (the section JSONB approach
  allows this later by editing copy via admin).
- Adding the new section types to the Home page itself (the Home is
  managed via `company_settings.homepage_content`, a separate
  system — out of scope here).

</deferred>
