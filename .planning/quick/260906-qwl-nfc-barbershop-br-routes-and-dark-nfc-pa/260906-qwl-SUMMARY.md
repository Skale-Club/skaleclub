---
phase: quick-260906-qwl
plan: 01
subsystem: managed-landings
tags: [routing, i18n, hreflang, theming, seed]
requires:
  - client/src/App.tsx route table
  - client/src/pages/DynamicLanding.tsx page fetch + hreflang
  - client/src/components/pages/sections/* section schemas
provides:
  - /:slug/br route resolving the <slug>-br DB row
  - /br as the canonical PT form in hreflang output
  - opt-in `theme` prop on five managed landing sections
  - NFC seed script renaming the PT rows to nfc-keychains-br / nfc-pricing-br
affects:
  - /nfc-keychains, /nfc-pricing and their PT pairs (after Task 4 reseed)
  - /websites, /barbershops — new /br URLs only, rendering unchanged
tech-stack:
  added: []
  patterns:
    - "sibling LIGHT/DARK class maps with identical keys, selected by an explicit prop"
    - "never a `dark:` Tailwind variant: ThemeContext forces `dark` site-wide"
key-files:
  created:
    - client/src/components/pages/sections/sectionTheme.ts
  modified:
    - client/src/App.tsx
    - client/src/pages/DynamicLanding.tsx
    - client/src/components/pages/sections/ProcessStepperSection.tsx
    - client/src/components/pages/sections/PricingTableSection.tsx
    - client/src/components/pages/sections/FaqAccordionSection.tsx
    - client/src/components/pages/sections/ContentBlocksSection.tsx
    - client/src/components/pages/sections/LeadFormCtaAdapter.tsx
    - client/src/components/pages/sections/TrustBadgesAdapter.tsx
    - scripts/seed-nfc-keychains-landing.ts
decisions:
  - "The slash lives only in the client route; the DB keeps single-segment `<slug>-br` slugs."
  - "hreflang is built from data.slug / data.alternateSlug, never the request URL, so both URL forms emit the same /br canonical."
  - "Dark is an explicit prop, never a `dark:` variant, because ThemeContext forces `dark` on the whole public site."
  - "#5173D6 is a fill only (4.3:1 on dark, below AA); text-blue-300 is the dark text accent."
  - "ReviewsAdapter and everything under components/home/ untouched — TrustBadges and ReviewsSection are already dark."
metrics:
  tasks-completed: 3
  tasks-total: 4
  completed: 2026-09-06
---

# Quick 260906-qwl: /br routes + dark NFC pages Summary

`/<slug>/br` now resolves the `<slug>-br` row for every managed bilingual pair and is the
canonical hreflang form, and five landing sections gained an opt-in `theme` prop so the NFC
pages can go dark without touching `/websites`, `/barbershops` or the homepage.

**Status: Tasks 1-3 complete and committed. Task 4 is PENDING — awaiting user approval.
Nothing has been written to the database.**

## Commits

| Task | Commit    | What                                                                 |
| ---- | --------- | -------------------------------------------------------------------- |
| 1    | `c262c04` | `/:slug/br` route + `/br`-canonical hreflang                          |
| 2    | `a985cef` | opt-in `theme` prop on five section components + `sectionTheme.ts`    |
| 3    | `9293ec7` | NFC seed: slug rename, `theme: "dark"` props, orphan cleanup          |

Branch: `dev` (the working tree was checked out on `main` at start; `dev` and `main` were at
the same commit `00f5001`, so switching was a no-op fast-forward and destroyed nothing).

## Task 1 — `/:slug/br` route and `/br` canonical hreflang

- `client/src/App.tsx`: new `DynamicPageBr` lazy wrapper passing `brVariant`, and
  `<Route path="/:slug/br" component={DynamicPageBr} />` registered directly above the
  `/:slug` catch-all (wouter matches top-down).
- `client/src/pages/DynamicLanding.tsx`: `DynamicPage({ brVariant = false })` resolves
  `/x/br` to the `x-br` slug before the query key is built, so the API is still called with a
  single-segment value. The `!routeSlug.endsWith("-br")` guard makes `/x-br/br` resolve `x-br`
  rather than 404 on `x-br-br`.
- New module-level `landingPath()` emits `/x/br` for any `-br` slug; both `selfHref` and
  `altHref` go through it. `selfTag`, `altTag` and `xDefaultHref` logic is untouched. No
  canonical `<link>` was added (`use-seo.ts` owns the single global canonical).

### Two-segment SPA fallback — confirmed at runtime, no config change needed

The plan's `<verified_findings>` held. Verified against the running dev server:

| Path                | Status | Content-Type                |
| ------------------- | ------ | --------------------------- |
| `/websites/br`      | 200    | `text/html; charset=utf-8`  |
| `/barbershops/br`   | 200    | `text/html; charset=utf-8`  |
| `/nfc-keychains/br` | 200    | `text/html; charset=utf-8`  |
| `/nfc-pricing/br`   | 200    | `text/html; charset=utf-8`  |
| `/websites-br`      | 200    | `text/html; charset=utf-8`  |
| `/barbershops-br`   | 200    | `text/html; charset=utf-8`  |

`GET /api/pages/slug/barbershops-br` returned 200 JSON (`"name":"Barbershops (PT)"`), not 404;
`websites-br`, `nfc-keychains` and `nfc-pricing` also returned 200. No change was made to
`server/static.ts`, `server/vite.ts`, `vercel.json`, `shared/schema/pages.ts`,
`shared/reservedSlugs.ts` or `server/routes/pages.ts`.

**Environment note (deviation, Rule 3):** the plan's verify block says port 5000, but
`npm run dev` reads `PORT` from `.env` and serves on **port 1000**. All curls above were run
against `http://localhost:1000`. No code was changed for this; it is a docs/expectation
mismatch only.

Browser-level hreflang inspection (DevTools `link[data-page-i18n]`) is deferred to the Task 4
QA pass, since it needs a rendered page. The emitted values are deterministic from
`landingPath()`: `/barbershops-br` and `/barbershops/br` both produce
`pt-BR -> /barbershops/br`, `en -> /barbershops`, `x-default -> /barbershops`.

## Task 2 — opt-in `theme` prop on five section components

New `client/src/components/pages/sections/sectionTheme.ts` exports
`sectionThemeSchema = z.enum(["light", "dark"]).optional()` as the single source of truth.
Each component declares sibling `LIGHT` / `DARK` maps with identical keys and picks with
`const c = props.theme === "dark" ? DARK : LIGHT;`. **Every `LIGHT` value is the pre-task
className verbatim**, so `theme` undefined is a no-op. Layout classes (`py-20 sm:py-24`,
`container-custom`, `max-w-3xl`, grid/flex, spacing) stayed inline and unchanged.

### Dark palette actually shipped

| Token                     | Light (unchanged)                      | Dark                                     |
| ------------------------- | -------------------------------------- | ---------------------------------------- |
| section bg (`bg-zinc-50`) | `bg-zinc-50`                           | `bg-[#0f1014]`                           |
| section bg (`bg-white`)   | `bg-white`                             | `bg-[#111111]`                           |
| card                      | `border-zinc-200 bg-white shadow-sm`   | `border-white/10 bg-white/5 shadow-none` |
| divider                   | `divide-zinc-200`                      | `divide-white/10`                        |
| headings / price / label  | `text-zinc-900`                        | `text-white`                             |
| bullet text               | `text-zinc-700`                        | `text-zinc-200`                          |
| body / footnote           | `text-zinc-600`                        | `text-zinc-300`                          |
| note                      | `text-zinc-500`                        | `text-zinc-400`                          |
| eyebrow / Check icon      | `text-[#1C53A3]`                       | `text-blue-300`                          |
| kind chip                 | `bg-[#1C53A3]/10 text-[#1C53A3]`       | `bg-[#5173D6]/20 text-blue-300`          |
| stepper connector         | `bg-zinc-300`                          | `bg-white/15`                            |
| stepper step-number ring  | `border-zinc-50`                       | `border-[#0f1014]`                       |
| stepper icon circle       | `bg-[#1C53A3] … shadow-[#1C53A3]/20`   | `bg-[#1C53A3] … shadow-[#5173D6]/30`     |
| FAQ item border           | `border-zinc-200`                      | `border-white/10`                        |
| leadFormCta section       | `bg-zinc-950`                          | `bg-[#0f1014]`                           |
| trustBadges wrapper       | `py-6`                                 | `bg-[#0f1014] py-6 sm:py-8`              |

`#5173D6` is used only as a fill behind white text/icons — never as a text color (4.3:1 on
dark, below AA). `text-blue-300` (`#93c5fd`, ~9.6:1) is the dark text accent, matching the
existing usage in `components/home/TrustBadges.tsx`.

`LeadFormCtaAdapter` changes only its section background between branches (it was already
dark); heading, subheading and button classes are identical in both. `ReviewsAdapter` was left
completely untouched per the plan.

### Regression guards verified

- `git diff --stat client/src/components/home/` -> **empty**
- `grep -rn "dark:" client/src/components/pages/sections/` -> one hit, inside the warning
  comment in `sectionTheme.ts`; **zero Tailwind `dark:` variants**
- `data-testid` counts identical before and after (2/2/2/2/0/0 across the six files);
  `data-landing-lead-cta` still 1 in `LeadFormCtaAdapter`
- Live `GET /api/pages/slug/websites` shows `processStepper {}` and `trustBadges {}` — no
  `theme` key, so those pages take the `LIGHT` branch

## Task 3 — NFC seed script (code only, no DB write)

- Slugs renamed: `chaveiros-nfc` -> `nfc-keychains-br`, `precos-chaveiros` -> `nfc-pricing-br`,
  with reciprocal `alternateSlug` updated on both EN specs. Slugs stay single-segment.
- Header comment block updated to list the new slugs and note the public PT URLs are
  `/nfc-keychains/br` and `/nfc-pricing/br`. The pricing-facts block was left alone.
- `theme: "dark"` added to `trustBadges`, `processStepper`, `leadFormCta` in
  `LANDING_SECTIONS`, and to `contentBlocks`, `pricingTable`, `processStepper`,
  `faqAccordion`, `leadFormCta` in `PRICING_SECTIONS`. `heroWebsites` and `reviews` untouched.
- `NFC_STEPPER_PROPS` is **spread** at each use site (`{ ...NFC_STEPPER_PROPS, theme: "dark" }`),
  never mutated.
- `deleteRenamedLegacyPages()` deletes exactly `["chaveiros-nfc", "precos-chaveiros"]` via
  `eq(pages.slug, slug)`, called from `main()` **after** all four upserts. Idempotent.
- Verified: `grep "chaveiros-nfc\|precos-chaveiros"` matches only `RENAMED_LEGACY_SLUGS` and
  its comment (lines 495-499); exactly one `.delete(` in the file; `git diff --stat scripts/`
  touches only this file; the diff removes no `$10` / `$200` / `$50` line and changes no copy
  string. `scripts/seed-nfc-keychains-translations.ts`, `seed-barbershop-landing.ts` and
  `seed-websites-landing.ts` were not modified.

**The script was NOT executed. No `tsx scripts/seed-*` command was run.** Live DB state
confirms this: `/api/pages/slug/nfc-keychains-br` -> 404, `/api/pages/slug/nfc-pricing-br` ->
404, `/api/pages/slug/chaveiros-nfc` -> 200.

## Task 4 — PENDING, awaiting user approval

Blocking human-approval gate. Not started. The reseed
(`npx tsx --env-file=.env scripts/seed-nfc-keychains-landing.ts`) will INSERT
`nfc-keychains-br` and `nfc-pricing-br`, rewrite the sections of all four NFC rows, and DELETE
`chaveiros-nfc` and `precos-chaveiros`. The row ids of the newly inserted PT pages, and the
full browser regression pass on `/websites`, `/barbershops` and `/`, are recorded only after
that approval.

## Deviations from Plan

**1. [Rule 3 - Blocking] Dev server port is 1000, not 5000**
- **Found during:** Task 1 verification
- **Issue:** `.claude/launch.json` and the plan's verify block both say port 5000, but
  `npm run dev` reads `PORT` from `.env` and logs `serving on port 1000`, so every curl
  against 5000 returned connection failure.
- **Fix:** ran the verification curls against `http://localhost:1000`. No file changed.
- **Files modified:** none

**2. [Housekeeping] Working tree was on `main`, not `dev`**
- **Found during:** pre-flight
- **Issue:** the assignment says work on `dev`; the tree was checked out on `main`.
- **Fix:** `git checkout dev`. Both refs were at `00f5001` with a clean tree (only the
  untracked planning folder), so nothing was stashed, reverted or lost.
- **Files modified:** none

## Known Stubs

None.

## Verification

- `npm run check` after Task 1, Task 2, Task 3 and once more at the end: **exit 0, zero errors**
- `git diff --stat client/src/components/home/`: **empty**
- No npm dependency added
- No DB write of any kind

## Self-Check: PASSED

All created/modified files exist on disk; all three commits (`c262c04`, `a985cef`, `9293ec7`)
resolve in `git log`.

---

## Task 4 — Production seed (APPROVED and RUN, 2026-09-07)

User approved the DB write. `npx tsx --env-file=.env scripts/seed-nfc-keychains-landing.ts`
was run twice.

**Run 1:**

| Action | Slug | Id |
|--------|------|-----|
| Updated | `nfc-keychains` (en) | `f3ea68dd-5bcc-452a-b6d2-694f9b5908e4` |
| Inserted | `nfc-keychains-br` (pt) | `fd40a1a5-a047-4ed2-8fc0-7d3ec7644f89` |
| Updated | `nfc-pricing` (en) | `d5c03dc6-54b1-43db-a149-e3986bd5fd63` |
| Inserted | `nfc-pricing-br` (pt) | `221fedf8-41b6-478d-aa80-d960a703f016` |
| Deleted | `chaveiros-nfc` (orphan) | `a8ceed60-7128-41e1-a992-0171c39bbf6d` |
| Deleted | `precos-chaveiros` (orphan) | `90ed32ce-7b14-4e12-9a8b-ba5364dedc11` |

**Run 2 (idempotency):** all four rows "Updated existing" with identical ids; both cleanup
lines reported "nothing to delete". The cleanup is safe to re-run.

Form `nfc-keychain-leads` (id=5) untouched apart from an in-place update.

## Browser verification (dev server — NOTE: port 1000, not the 5000 in .claude/launch.json)

| Check | Result |
|-------|--------|
| `/barbershops/br` (new route, no DB change) | Portuguese page renders, not the SPA 404 |
| `/barbershops-br` (legacy URL) | Still renders; hreflang points canonical at `/barbershops/br` |
| `/barbershops` (EN) | Unchanged — light stepper `rgb(250,250,250)`, icons search/palette/code-xml/rocket |
| `/websites` (EN) | Unchanged — same light stepper and original icons |
| `/nfc-pricing/br` | Dark (`#111111` blocks/FAQ, `rgb(15,16,20)` pricing/stepper), Portuguese |
| `/nfc-pricing` (EN) | Dark, fully English, zero Portuguese lines detected |
| Prices | `$10` / `$200` (`20 pieces × $10`) / `$50` one-time — unchanged |
| hreflang on `/nfc-pricing/br` | `pt-BR -> /nfc-pricing/br`, `en -> /nfc-pricing`, `x-default -> /nfc-pricing` |
| `npm run check` | exit 0 |

The `/br` route is what gives barbershops and websites their new URLs — neither needed a
database change, and neither seed script was modified.

## Stale config found (not fixed — out of scope)

`.claude/launch.json` declares port 5000, but `npm run dev` reads `PORT` from `.env` and
actually serves on **port 1000**. Worth correcting in a separate pass.
