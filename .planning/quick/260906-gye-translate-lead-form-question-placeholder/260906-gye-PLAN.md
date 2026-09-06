---
phase: quick/260906-gye-translate-lead-form-question-placeholder
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/components/LeadFormModal.tsx
autonomous: false
requirements: [QT-260906-gye-01]

must_haves:
  truths:
    - "On a page with pages.language = 'pt', the question input placeholder renders in Portuguese, matching the already-translated question title above it"
    - "On a page with pages.language = 'en', every placeholder renders exactly the same English source string as before the change"
    - "A question with no placeholder configured still renders an empty placeholder (no 'undefined', no crash)"
    - "Phone inputs still show their numeric sample/mask (e.g. '(11) 98765-4321', '(00) 00000-0000') untranslated"
  artifacts:
    - path: "client/src/components/LeadFormModal.tsx"
      provides: "Question + conditional-field placeholders routed through t()"
      contains: "t(currentQuestion.placeholder"
  key_links:
    - from: "client/src/components/LeadFormModal.tsx"
      to: "client/src/hooks/useTranslation.ts"
      via: "existing `const { t } = useTranslation()` already in scope at both render sites"
      pattern: "t\\((currentQuestion|field)\\.placeholder"
---

<objective>
Fix a mixed-language defect in the shared lead form: question TITLES are translated via `t()` but the input PLACEHOLDERS underneath are not. On `pages.language = 'pt'` pages this renders "Qual e o seu nome?" above an input reading "Your full name".

Purpose: user-visible copy consistency on every PT landing page form.
Output: 4 one-token edits in `client/src/components/LeadFormModal.tsx`, no behavior change on EN pages.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@client/src/components/LeadFormModal.tsx
@client/src/hooks/useTranslation.ts

<interfaces>
<!-- Extracted from the codebase. Use these directly, do NOT go exploring. -->

From client/src/hooks/useTranslation.ts (the `t` returned by `useTranslation()`):
```ts
const t: {
  (text: TranslationKey): string;   // overload 1: static literal keys
  (text: string): string;           // overload 2: dynamic DB content
};
```
Overload resolution note: `currentQuestion.placeholder || ""` and `field.placeholder || ""`
both have static type `string` (not a string literal), so overload 2 is selected and
TranslationKey enforcement does NOT apply. This compiles.

From shared/schema/forms.ts:
```ts
export interface FormQuestion {
  title: string;
  placeholder?: string;          // OPTIONAL -> the `|| ""` fallback is load-bearing
  // ...
}
export interface FormConditionalField {
  title: string;
  placeholder: string;           // typed required, but DB rows may omit it at runtime
  // ...
}
```

`t` is ALREADY destructured and in scope at both render sites:
- `LeadFormModal.tsx:509` — `const { t } = useTranslation();` (main modal component; covers lines 1096 and 1110)
- `LeadFormModal.tsx:455` — `const { t } = useTranslation();` (ConditionalFieldInput; covers lines 481 and 495)

No new imports, no new hook calls, no prop drilling required.
</interfaces>

<safety_analysis>
<!-- Pre-verified by the planner. The executor does NOT need to re-derive this. -->

1. EN pages are a no-op. `t()` internals: `if (!text) return text;` then, for `language === 'en'`,
   any string not found in the static PT dictionary and not in the runtime cache is returned
   UNCHANGED (`return text;`) while a background batch is scheduled. Rendering is synchronous
   and falls back to the English source.

2. The uncached path cannot produce an empty or crashed placeholder. `fetchTranslations()`
   wraps the whole POST in try/catch and returns `{}` on any failure; on success it only ever
   ADDS keys to the cache. Server side (`server/routes/translate.ts`), when no AI client is
   configured the route returns `{ translations: { [text]: text } }` — the original text.
   Worst case the placeholder equals its English source, which is today's behavior.

3. Exposure is not new. `t(currentQuestion.title)` at line 1074 already sends this exact
   question copy through the exact same path on the production homepage form. Placeholders
   inherit an already-shipped, already-proven risk profile; they add no new class of failure.

4. PT resolution is cache-first. `LanguageContext` pre-warms `translationCache` from
   `GET /api/translations/preload?lang=pt` on mount, so seeded placeholder pairs
   ("Your full name" -> "Seu nome completo", "Optional" -> "Opcional") resolve synchronously
   with no network round trip during render.

5. Language source of truth: `client/src/pages/DynamicLanding.tsx:34` calls
   `setLanguage(pageLanguage)` from the `pages.language` column. That is the switch under test.
</safety_analysis>
</context>

<scope_decisions>
Four edit sites, two explicit non-goals. The executor MUST NOT touch anything outside the four.

IN SCOPE (4 sites):
- L1096 `placeholder={currentQuestion.placeholder || ""}` — main text/email input. The reported bug.
- L1110 `placeholder={currentQuestion.placeholder || ""}` — main textarea. The reported bug.
- L481  `placeholder={field.placeholder}` — ConditionalFieldInput textarea.
- L495  `placeholder={field.placeholder}` — ConditionalFieldInput text/email/tel input.

Ruling on L481/L495 (the task brief left this open, defaulting to out-of-scope): they are
IN SCOPE. Rationale — this is the same user-visible surface, not a legacy path. It is the
conditional follow-up field that renders inline under a question, and its sibling label on
line 466 is ALREADY `{t(field.title)}`. Leaving those two placeholders unwrapped reproduces
the identical translated-title-over-English-placeholder defect this task exists to eliminate.
Fixing them is two more tokens in the same file with the same risk profile; deferring would
guarantee a follow-up bug report.

OUT OF SCOPE — do not modify (these are data, not copy):
- L1242 `placeholder={selectedCountry.placeholder}` — sample phone number from the
  `COUNTRY_CONFIG` table (e.g. "(11) 98765-4321"). Translating a phone number is nonsense
  and would fire junk at the translate API.
- L1287 `placeholder={phoneCountrySelected.format.replace(/#/g, "0")}` — a numeric input mask.
- `aria-label={currentQuestion.title}` on lines ~1103/1116 — pre-existing untranslated a11y
  label. Real, but a separate concern; do not expand this change.
</scope_decisions>

<tasks>

<task type="auto">
  <name>Task 1: Route the four question placeholders through t()</name>
  <files>client/src/components/LeadFormModal.tsx</files>
  <action>
Make exactly four single-line edits. Line numbers are from the current file; match on the
surrounding code shown, not on the line number alone.

1) Main text/email input (~line 1096, inside the `currentQuestion.type === "text" || "email"` block,
   directly above `className={clsx("w-full rounded-xl border bg-white px-4 py-3 text-lg ...`):
   FROM: `placeholder={currentQuestion.placeholder || ""}`
   TO:   `placeholder={t(currentQuestion.placeholder || "")}`

2) Main textarea (~line 1110, inside the `currentQuestion.type === "textarea"` block,
   directly above `className={clsx("min-h-36 w-full rounded-xl ...`):
   FROM: `placeholder={currentQuestion.placeholder || ""}`
   TO:   `placeholder={t(currentQuestion.placeholder || "")}`

3) ConditionalFieldInput textarea (~line 481, above `className={clsx("min-h-28 w-full rounded-lg ...`):
   FROM: `placeholder={field.placeholder}`
   TO:   `placeholder={t(field.placeholder || "")}`

4) ConditionalFieldInput input (~line 495, above `className={clsx("w-full rounded-lg border px-4 py-2 ...`):
   FROM: `placeholder={field.placeholder}`
   TO:   `placeholder={t(field.placeholder || "")}`

Call-shape rules (do not deviate):
- Keep `|| ""` INSIDE the `t()` call, never outside. `t(x) || ""` would defeat the point and
  change nothing; `t(x || "")` preserves the never-pass-undefined contract because `t()`
  short-circuits on falsy input (`if (!text) return text;`) and returns "".
- Use `|| ""` (not `?? ""`), matching the two existing sites and the rest of this file.
- Add `|| ""` on sites 3 and 4 even though `FormConditionalField.placeholder` is typed as a
  required `string` — DB-sourced rows can omit it at runtime. TypeScript accepts the guard.
- Do NOT add imports. Do NOT add a `useTranslation()` call. `t` is already destructured at
  line 509 (covers sites 1-2) and line 455 (covers sites 3-4).
- Do NOT reformat, reorder attributes, or touch any other line.

Expected diff: 1 file, 4 insertions(+), 4 deletions(-). Nothing else.
  </action>
  <verify>
    <automated>npm run check</automated>
    <automated>git diff --stat client/src/components/LeadFormModal.tsx   # expect: 1 file changed, 4 insertions(+), 4 deletions(-)</automated>
    <automated>grep -c 't(currentQuestion.placeholder || "")' client/src/components/LeadFormModal.tsx   # expect 2</automated>
    <automated>grep -c 't(field.placeholder || "")' client/src/components/LeadFormModal.tsx   # expect 2</automated>
    <automated>grep -n 'placeholder={selectedCountry.placeholder}' client/src/components/LeadFormModal.tsx   # expect 1 hit, UNCHANGED</automated>
    <automated>grep -n 'placeholder={phoneCountrySelected.format' client/src/components/LeadFormModal.tsx   # expect 1 hit, UNCHANGED</automated>
  </verify>
  <done>
`npm run check` exits clean (same as before the change — no new TS errors, and no
TranslationKey overload error on any of the four sites). The diff is exactly 4 changed lines
in 1 file. Both phone placeholder sites are byte-identical to HEAD.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Browser verification on PT and EN pages</name>
  <files>none (verification only, no files modified)</files>
  <action>STOP. This is a blocking human-verification gate. Do not edit any files and do not proceed to commit. Present the verification steps below to the user and wait for their reply.</action>
  <what-built>
Four placeholders in `client/src/components/LeadFormModal.tsx` now render through the same
`t()` translation function the rest of the form copy already uses: the main question text
input, the main question textarea, and the two conditional follow-up field inputs. Phone
number samples and format masks were deliberately left untranslated.

Note on testing: AGENTS.md confirms this repo has no automated test runner, so `npm run check`
(run in Task 1) is the only automated gate. Browser verification below is the real proof.
  </what-built>
  <how-to-verify>
Start the dev server (`.claude/launch.json` defines `skaleclub-dev` on port 5000; `npm run dev`
otherwise — note AGENTS.md documents port 1000, so trust whichever port the server actually prints).

A. PT pages — the fix (this is the bug being closed):
   1. Open `/chaveiros-nfc` and `/barbershops-br`.
   2. Open the lead form and step to a question with a text or textarea input.
   3. CONFIRM: the placeholder inside the input is Portuguese, matching the language of the
      question title above it. Expect e.g. "Seu nome completo", "Opcional",
      "voce@suaempresa.com" instead of "Your full name", "Optional", "you@yourbusiness.com".
   4. Answer a question that reveals a conditional follow-up field (the blue inset box).
      CONFIRM: that field's placeholder is Portuguese too.
   5. CONFIRM: no placeholder is blank, and none reads "undefined".

B. EN pages — the no-op guarantee (this is the regression risk):
   1. Open `/nfc-keychains` and `/barbershops`.
   2. Step through the same inputs and CONFIRM the placeholders read exactly the English
      source text they read before the change — same wording, same punctuation, same casing.
   3. Hard-reload (Ctrl+Shift+R) and re-check. This second pass matters: on EN pages `t()`
      schedules a background PT->EN batch for strings missing from the static dictionary,
      and a cached result would only surface on a later load. If any English placeholder
      comes back subtly reworded, STOP and report it — the offending row lives in the
      `translations` table with source_language='pt', target_language='en' and must be deleted.

C. Non-goals still intact:
   1. Reach a phone question on a PT page. CONFIRM the phone input still shows a numeric
      sample like "(11) 98765-4321" or a mask like "(00) 00000-0000" — NOT translated prose.

D. Console:
   1. CONFIRM no new errors. A `POST /api/translate` request is expected and fine; it must
      not break rendering even if it returns nothing usable.
  </how-to-verify>
  <resume-signal>Type "approved", or paste the page + placeholder text that looks wrong.</resume-signal>
  <verify>
    <automated>MISSING - human-only visual gate; no test runner exists in this repo (AGENTS.md). Automated coverage is npm run check in Task 1.</automated>
  </verify>
  <done>User replies "approved" after confirming PT placeholders render in Portuguese, EN placeholders are unchanged across a hard reload, and phone sample/mask placeholders are untranslated.</done>
</task>

</tasks>

<verification>
- `npm run check` clean.
- Diff limited to `client/src/components/LeadFormModal.tsx`, exactly 4 lines.
- PT landing pages: question placeholder language matches question title language.
- EN landing pages: placeholders byte-identical to pre-change, verified across a hard reload.
- Phone sample/mask placeholders unchanged.
</verification>

<success_criteria>
- All 4 in-scope sites call `t(... || "")`; both out-of-scope phone sites untouched.
- No new imports, no new `useTranslation()` calls, no formatting churn.
- PT pages render Portuguese placeholders; EN pages render unchanged English placeholders.
- Questions with no configured placeholder render an empty placeholder, not "undefined".
</success_criteria>

<output>
After completion, create `.planning/quick/260906-gye-translate-lead-form-question-placeholder/260906-gye-SUMMARY.md`
</output>
