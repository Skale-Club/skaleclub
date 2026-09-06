---
phase: quick/260906-gye-translate-lead-form-question-placeholder
plan: 01
subsystem: ui
tags: [i18n, translation, react, lead-form, placeholders]

# Dependency graph
requires:
  - phase: 30-translation-system-overhaul
    provides: "useTranslation() hook, t() overloads, translationCache preload via LanguageContext"
provides:
  - "Question input placeholders in LeadFormModal routed through t()"
  - "Conditional follow-up field placeholders routed through t() with || \"\" runtime guard"
affects: [lead-form, landing-pages, translations, i18n]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "t(value || \"\") — falsy guard INSIDE the t() call, never t(x) || \"\""

key-files:
  created: []
  modified:
    - client/src/components/LeadFormModal.tsx

key-decisions:
  - "ConditionalFieldInput placeholders (L481/L495) ruled IN SCOPE — same user-visible surface, sibling label already uses t(field.title)"
  - "Phone sample placeholder (L1242) and format mask (L1287) deliberately left untranslated — they are data (numbers), not copy"
  - "Guard placed inside t() as t(x || \"\") not outside as t(x) || \"\" — t() short-circuits on falsy input and returns it unchanged, preserving the never-pass-undefined contract"
  - "|| \"\" added on the two conditional-field sites even though FormConditionalField.placeholder is typed required — DB-sourced rows can omit it at runtime"

patterns-established:
  - "Placeholder copy follows the same t() path as its sibling label/title — a translated title must never sit above an untranslated placeholder"

requirements-completed: [QT-260906-gye-01]

# Metrics
duration: 2min
completed: 2026-09-06
---

# Quick Task 260906-gye: Translate Lead Form Question Placeholders Summary

**Four placeholder attributes in the shared lead form now render through the same `t()` translation function their sibling titles already used, closing a mixed-language defect where PT pages showed "Qual e o seu nome?" above an input reading "Your full name".**

## Performance

- **Duration:** ~2 min (Task 1 only; Task 2 checkpoint pending)
- **Tasks:** 1 of 2 complete (Task 2 is a blocking human-verify gate)
- **Files modified:** 1
- **Diff size:** 4 insertions(+), 4 deletions(-)

## Accomplishments

### Task 1: Route the four question placeholders through t() — COMPLETE

Commit: `5dc68c4`

All four in-scope sites edited in `client/src/components/LeadFormModal.tsx`:

| Line | Context | From | To |
|------|---------|------|-----|
| 481 | `ConditionalFieldInput` textarea | `placeholder={field.placeholder}` | `placeholder={t(field.placeholder \|\| "")}` |
| 495 | `ConditionalFieldInput` text/email/tel input | `placeholder={field.placeholder}` | `placeholder={t(field.placeholder \|\| "")}` |
| 1096 | Main text/email input | `placeholder={currentQuestion.placeholder \|\| ""}` | `placeholder={t(currentQuestion.placeholder \|\| "")}` |
| 1110 | Main textarea | `placeholder={currentQuestion.placeholder \|\| ""}` | `placeholder={t(currentQuestion.placeholder \|\| "")}` |

No new imports, no new `useTranslation()` calls — `t` was already destructured at line 455 (covers 481/495) and line 509 (covers 1096/1110). No formatting churn, no attribute reordering.

**Verification results (all passed):**

- `npm run check` — clean, zero output, no new TS errors. The `TranslationKey` overload does not fire because `x || ""` has static type `string`, not a string literal, so overload 2 is selected.
- `git diff --stat` — `1 file changed, 4 insertions(+), 4 deletions(-)` exactly as the plan predicted.
- `grep -c 't(currentQuestion.placeholder || "")'` — 2 (expected 2).
- `grep -c 't(field.placeholder || "")'` — 2 (expected 2).
- Out-of-scope phone sites confirmed byte-identical to HEAD: `git diff HEAD` produces no `+`/`-` line touching `selectedCountry.placeholder` (L1242) or `phoneCountrySelected.format` (L1287).

### Task 2: Browser verification on PT and EN pages — PENDING

**Status: awaiting orchestrator browser verification.** This is a `checkpoint:human-verify` blocking gate. Per the execution constraints, the executor does not attempt browser verification; the orchestrator drives it against the working-tree changes in this worktree.

Verification scope carried forward from the plan:

- **A. PT pages** (`/chaveiros-nfc`, `/barbershops-br`) — placeholders must render Portuguese matching the question title above them; conditional follow-up field (blue inset box) placeholder likewise; nothing blank, nothing reading "undefined".
- **B. EN pages** (`/nfc-keychains`, `/barbershops`) — placeholders must read the exact English source text as before, verified across a hard reload (Ctrl+Shift+R). The second pass is the real regression check: on EN pages `t()` schedules a background batch for strings missing from the static dictionary, so a bad cached result only surfaces on a later load. Any subtly reworded English placeholder means a bad row in `translations` with `source_language='pt', target_language='en'` that must be deleted.
- **C. Non-goals** — phone input on a PT page must still show a numeric sample (`(11) 98765-4321`) or mask (`(00) 00000-0000`), not translated prose.
- **D. Console** — no new errors. A `POST /api/translate` request is expected and harmless.

Note: AGENTS.md confirms this repo has no automated test runner, so `npm run check` is the only automated gate available; browser verification is the real proof.

## Deviations from Plan

None — Task 1 executed exactly as written. All four edit sites matched the plan's line numbers and surrounding code verbatim.

## Plan Context Discrepancy (informational, non-blocking)

The task brief's surrounding context referenced `scripts/seed-barbershop-translations.ts` and `scripts/seed-nfc-keychains-translations.ts`. **Neither file exists on this branch** (verified). They were not needed for Task 1, which touches only `LeadFormModal.tsx`.

This has a bearing on Task 2, part A: PT placeholder resolution depends on the `translations` table containing rows for the placeholder source strings ("Your full name" -> "Seu nome completo", "Optional" -> "Opcional", etc.). If those pairs were never seeded, `t()` will fall back to the live `POST /api/translate` path rather than resolving synchronously from the `LanguageContext` preload cache. Practical consequence during verification: a PT placeholder may briefly render English on first paint and settle to Portuguese after the batch returns, or stay English if no AI client is configured server-side (`server/routes/translate.ts` echoes the source text back in that case). That is a data/seeding gap, not a defect in this code change — the wiring in `LeadFormModal.tsx` is correct either way. Worth noting because it matches the known project pattern that a PT page row alone is not sufficient; the translations table needs a matching seed.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced. The `|| ""` fallbacks are intentional runtime guards documented in the plan, not stubs — they preserve the pre-existing empty-placeholder behavior for questions with no configured placeholder.

## Self-Check: PASSED

- `client/src/components/LeadFormModal.tsx` — FOUND (modified, contains `t(currentQuestion.placeholder` as required by the plan's `artifacts.contains` assertion)
- Commit `5dc68c4` — FOUND in `git log`
- Key link verified: `LeadFormModal.tsx` -> `client/src/hooks/useTranslation.ts` via existing in-scope `const { t } = useTranslation()`; pattern `t\((currentQuestion|field)\.placeholder` matches 4 sites
