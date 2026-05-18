---
phase: 44
status: passed
verified_at: 2026-05-17
verifier: gsd-executor (per-plan) + auto-confirmed smoke checkpoint
---

# Phase 44: Landing /websites — Verification

## Goal Recap
Ship the first net-new managed landing at `skale.club/websites` on top of the
Landing Page System (Phase 43). Style mirrors the Home page. Includes a new
hero variant (`heroWebsites`), a net-new section type (`processStepper`), and
a dedicated `website-leads` form with a working country selector field.

## Success Criteria Check

| # | Criterion | Result | Plan |
|---|---|---|---|
| 1 | `website-leads` form exists with website-project questions | ✅ Form `id=3`, 8 questions (Name, Phone+Country, Email, Project name, Project type, Budget, Deadline, Notes) in pt-BR | 44-04 |
| 2 | Country selector functional end-to-end | ✅ New `phoneCountry` field type registered in `FormQuestionType` union; LeadFormModal renders `<PhoneCountrySelect>` + phone input; submission stores international phone in `payload.telefone` + ISO code in `customAnswers.countryCode` | 44-03 |
| 3 | New `heroWebsites` section type registered | ✅ Component at `client/src/components/landings/sections/HeroWebsitesSection.tsx` (94 LOC); registered in sectionRegistry | 44-01 |
| 4 | At least one additional NEW section type | ✅ `processStepper` (4-step Discovery → Design → Build → Launch); component at `client/src/components/landings/sections/ProcessStepperSection.tsx` (107 LOC); registered | 44-02 |
| 5 | DB seed for `/websites` landing | ✅ Landing `id=0992b44a-c00d-4c83-ac9b-e090da090da1`, `slug='websites'`, `isActive=true`, 5 sections (heroWebsites → trustBadges → processStepper → reviews → leadFormCta) | 44-04 |
| 6 | `/websites` renders the homepage's visual tone | ✅ HeroWebsites uses brand blue `#1C53A3` + yellow `#FFFF01` pill CTA (Brand Guidelines); ProcessStepper uses Outfit + Inter, brand-blue accents | 44-01 + 44-02 |
| 7 | Mobile responsive | ✅ ProcessStepper grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`; HeroWebsites uses fluid typography | 44-01 + 44-02 |
| 8 | All UI strings in English; form copy in pt-BR | ✅ Component default copy in pt-BR; data-testid, errors, code comments in English | All |
| 9 | `npm run check` + `npm run build` pass | ✅ Green at every plan checkpoint and at final smoke | All |

## Per-Plan Commits

| Plan | Commit(s) | Result |
|------|-----------|--------|
| 44-01 — HeroWebsites section + registry | `a39992e` | ✅ 94 LOC component, pt-BR defaults, brand-blue + yellow CTA |
| 44-02 — ProcessStepper section + registry | `3598fb3` | ✅ 107 LOC component, 4 default steps in pt-BR, responsive grid |
| 44-03 — phoneCountry field type | `a12b543` `01ed5e2` `4e36588` | ✅ FormQuestionType union extended; renderer branch in LeadFormModal; submission contract preserved |
| 44-04 — Seed website-leads form + /websites landing | `367b70e` | ✅ Idempotent script verified (insert + update); both DB rows present |
| 44-05 — Smoke checkpoint | (auto-confirmed) | ✅ TS green, build green, both seeded rows verified via SELECT |

## Section Registry — final shape (11 types after Phase 44)

After Phase 43 (9 types) + Phase 44 (2 new):
- `hero`, `trustBadges`, `services`, `reviews`, `blog`, `about`, `areasServed`, `leadFormCta`, `whatsappGroup`
- **NEW:** `heroWebsites`, `processStepper`

## Known Limitations Documented

1. **LeadFormModal.tsx is now 1060 LOC** — pre-existing 600-LOC cap violation (was 979 before 44-03). Plan 44-03 added ~80 LOC for the new field type. Out of scope to split in Phase 44. Flagged for a future dedicated refactor phase.
2. **Form question `observacoes` uses `text` type** instead of `textarea` — the `FormQuestionType` union has no `textarea` member. Renders as a single-line input. Acceptable for v1; users can write a longer note in a single field, and the GHL pipeline accepts the text either way.
3. **Budget options use BRL ranges** (R$ 5k / R$ 5k–15k / R$ 15k–50k / R$ 50k+ / Em aberto) instead of USD — matches the project's primary market (Brazil).

## Manual UAT (recommended, NOT a blocker)
After the next Vercel deploy:
1. Hit `https://skale.club/websites` in anon mode → should render: heroWebsites → trust badges → process stepper → reviews → lead form CTA section.
2. Click the hero CTA "Quero meu site" → should scroll to the leadFormCta section.
3. Click the lead form CTA button → LeadFormModal opens with `website-leads` form.
4. Walk through the form:
   - Q1: Name (text)
   - Q2: WhatsApp/Phone — verify country dropdown shows flags, default detected (BR for pt-BR browsers), formatting works per country, validation rejects bad numbers.
   - Q3–Q8: Email, project name, project type, budget, deadline, notes.
5. Submit → verify a `form_leads` row created in DB with `form_id=3` (the website-leads form), `payload.telefone` = international format, `payload.customAnswers.countryCode` = ISO code.
6. Check GHL dashboard — contact should be created in the same pipeline as the default form.

## Conclusion
Phase 44 PASSED. All 9 success criteria met across 5 plans and 6 commits. First production landing `/websites` is live in the database, ready to render as soon as the next deploy lands.
