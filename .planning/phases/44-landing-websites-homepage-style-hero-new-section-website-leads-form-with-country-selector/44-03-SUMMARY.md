---
phase: 44-landing-websites-homepage-style-hero-new-section-website-leads-form-with-country-selector
plan: 03
subsystem: forms
tags: [forms, lead-capture, phone-input, country-selector]
requires:
  - shared/schema/forms.ts (FormQuestionType union)
  - client/src/components/ui/PhoneCountrySelect.tsx (reused as-is)
  - client/src/lib/phoneCountries.ts (reused as-is)
provides:
  - "FormQuestionType: 'phoneCountry' — a new question type for the forms system"
  - "LeadFormModal renderer branch + submission handling for type='phoneCountry'"
  - "Submission contract: payload.telefone = international phone, payload.customAnswers.countryCode = ISO alpha-2"
affects:
  - client/src/components/admin/leads/FormEditorContent.tsx (badge label map widened)
tech-stack:
  added: []
  patterns:
    - "Reuse existing PhoneCountrySelect + phoneCountries.ts helpers rather than duplicating the country list"
    - "Stash non-column metadata (countryCode) in form_leads.customAnswers JSONB to avoid schema migration"
key-files:
  created: []
  modified:
    - shared/schema/forms.ts
    - client/src/components/LeadFormModal.tsx
    - client/src/components/admin/leads/FormEditorContent.tsx
decisions:
  - "Used Option 1 from plan: extended getFieldError signature with a 4th optional `phoneCountrySelected` parameter, mirroring the existing `selectedCountry` arg pattern."
  - "Both phone helper sets coexist: local COUNTRIES + helpers for legacy 'tel' branch (unchanged), shared PHONE_COUNTRIES + helpers (aliased as formatPhoneForPhoneCountry / isValidPhoneForPhoneCountry) for new 'phoneCountry' branch."
  - "Submission: phoneCountry value is normalized to international format via getInternationalPhone() on auto-save AND on final submit; countryCode lands in customAnswers.countryCode."
metrics:
  duration: ~25min
  completed: 2026-05-17
---

# Phase 44 Plan 03: phoneCountry field type for forms — Summary

One-liner: Added a new `'phoneCountry'` form-question type that renders the shared `<PhoneCountrySelect>` (17 countries) alongside a phone input, validates per country, and submits the international phone string plus ISO country code without a schema migration.

## What Changed

### 1. `shared/schema/forms.ts` (line 189)
Extended `FormQuestionType`:
```ts
// Before
export type FormQuestionType = 'text' | 'email' | 'tel' | 'select';
// After
export type FormQuestionType = 'text' | 'email' | 'tel' | 'select' | 'phoneCountry';
```
No Zod schema change required — `insertFormSchema.config` is `z.custom<FormConfig>()`, so the runtime contract is unchanged and the TypeScript union is the only enforcement.

### 2. `client/src/components/admin/leads/FormEditorContent.tsx` (line 158)
Deviation (Rule 1 — type error): widening `FormQuestionType` broke a non-exhaustive `Record<string, string>` literal used to label question-type badges. Converted to an explicit `Record<FormQuestion['type'], string>` and added `phoneCountry: 'Phone + Country'`.

### 3. `client/src/components/LeadFormModal.tsx`

Imports added (right after existing `@shared` imports):
- `PhoneCountrySelect` from `@/components/ui/PhoneCountrySelect`
- `detectDefaultPhoneCountry`, `formatPhoneForCountry` (aliased as `formatPhoneForPhoneCountry`), `isValidPhoneForCountry` (aliased as `isValidPhoneForPhoneCountry`), `getInternationalPhone`, `PhoneCountry` type from `@/lib/phoneCountries`

The aliases prevent collisions with the existing local helpers (lines 89-121) that serve the legacy `tel` branch with the local `COUNTRIES` array.

State (line 275): added `const [phoneCountrySelected, setPhoneCountrySelected] = useState<PhoneCountry>(() => detectDefaultPhoneCountry());`

Validation (`getFieldError` lines ~161-220): added a 4th optional parameter `phoneCountrySelected?: PhoneCountry`, plus a `case "phoneCountry"` branch that calls `isValidPhoneForPhoneCountry`.

Call sites updated: `handleAnswerChange` (auto-save formatting), `handleNext`, `handleFinish`, `canProceed` — all now pass `phoneCountrySelected` as the 4th arg.

`handleAnswerChange` (line 572): added an `else if (question?.type === "phoneCountry")` formatting branch using `formatPhoneForPhoneCountry`. Auto-save's `valueToSave` ternary also now emits the international form for `phoneCountry`.

Render branch (lines ~901-940): inserted right after the `tel` block (line ~899) and before the `select` block. Renders `<PhoneCountrySelect>` + phone `<input>` side-by-side inside a shared rounded-xl border that highlights on focus or error.

Submission (`persistProgress`, lines ~493-503): after the existing `if (effectiveAnswers.telefone) { ... }` block, scans `config.questions` for any `phoneCountry`-typed question; if its value is non-empty, overrides `payload.telefone` with the international string and stashes the ISO alpha-2 code in `payload.customAnswers.countryCode`. Also added `phoneCountrySelected` (and `progressUrl`, pre-existing missing dep) to the `useCallback` dep array.

## JSON Shape of `form_leads` Row on Submission

When the website-leads form (44-04) submits a `phoneCountry`-typed question with id `telefone` and user picks Brazil + types `11999998888`:

```jsonc
{
  "id": 123,
  "session_id": "...",
  "form_id": 2,
  "nome": "Jane Doe",
  "email": "jane@example.com",
  "telefone": "+5511999998888",        // <-- getInternationalPhone() output
  "custom_answers": {
    "countryCode": "BR",                // <-- ISO 3166-1 alpha-2
    "projectType": "...",               // (other custom answers from form 44-04)
    "budget": "...",
    "deadline": "..."
  },
  // ...rest of the form_leads columns
}
```

The GHL contact-create pipeline keeps reading `telefone` exactly as before — no integration code needs to change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type error] `FormEditorContent.tsx` badge map was not exhaustive**
- **Found during:** Task 1 verification (`npm run check`)
- **Issue:** Widening `FormQuestionType` broke an implicit `Record<string, string>` literal used at line 159 that only covered `text | email | tel | select`. `tsc` flagged "Property 'phoneCountry' does not exist on type ...".
- **Fix:** Converted the inline literal to an explicit `Record<FormQuestion['type'], string>` so future type widening is enforced, and added `phoneCountry: 'Phone + Country'` label.
- **Files modified:** `client/src/components/admin/leads/FormEditorContent.tsx`
- **Commit:** a12b543

**2. [Rule 2 - Missing dep] `persistProgress` useCallback was missing `progressUrl`**
- **Found during:** Task 2 cleanup
- **Issue:** `persistProgress` references `progressUrl` (a derived value of `formSlug`) but didn't list it as a dependency. Pre-existing issue, became visible when I added `phoneCountrySelected` to the dep array.
- **Fix:** Added both `phoneCountrySelected` (required by the new submission branch) and `progressUrl` (pre-existing miss) to the dep array.
- **Files modified:** `client/src/components/LeadFormModal.tsx`
- **Commit:** 01ed5e2

No architectural changes needed. No auth gates.

## File-Size Note (flagged, not fixed)

`LeadFormModal.tsx` is now **1060 LOC**, up from 979. CLAUDE.md mandates ≤600 LOC per file. This is a pre-existing violation; the plan explicitly says to NOT split it as part of Phase 44. Flagged for a future dedicated refactor phase.

## Verification

- `npm run check`: PASSED (zero errors)
- `FormQuestionType` includes `'phoneCountry'`: confirmed (`shared/schema/forms.ts:189`)
- LeadFormModal has render branch for `currentQuestion.type === "phoneCountry"`: confirmed (`LeadFormModal.tsx:901-940`)
- Submission populates `payload.telefone` (international) AND `payload.customAnswers.countryCode` (ISO alpha-2): confirmed (`LeadFormModal.tsx:493-503`)
- `PhoneCountrySelect.tsx` and `phoneCountries.ts` unchanged: confirmed (no edits, no commits touching them)
- Existing `tel` branch behavior unchanged: confirmed (local `COUNTRIES`, local `formatPhoneForCountry`, `getFullPhoneNumber`, `isValidPhoneForCountry` all still used by the `tel` branch; no edits to that block)
- 44-04 can now author a form question `{ id: "telefone", type: "phoneCountry", ... }` and the modal will Just Work.

## Commits

- `a12b543` feat(44-03): add 'phoneCountry' to FormQuestionType union
- `01ed5e2` feat(44-03): phoneCountry field type for forms

## Self-Check: PASSED
- `shared/schema/forms.ts` exists and contains `phoneCountry` in the union
- `client/src/components/LeadFormModal.tsx` exists and contains the renderer + submission branch
- `client/src/components/admin/leads/FormEditorContent.tsx` exists and contains the new badge label
- Both commits a12b543 and 01ed5e2 are in `git log`
