---
phase: 43-landing-page-system-dynamic-landings-at-root-slugs
plan: 05
subsystem: landings
tags: [landings, sections, migration, redirects, seo]
requires:
  - sectionRegistry (43-03)
  - landing_pages table + public lookup (43-02)
  - Wouter catch-all /:slug (43-02)
provides:
  - whatsappGroup section type (registered in sectionRegistry)
  - Managed landing row at slug=grupo (id=a80b505a-36e8-487c-90b8-62f2927ec0ed)
  - 301 redirects from legacy /skale-hub/grupo and /skale-hub/group to /grupo
affects:
  - client/src/App.tsx (legacy hub routes now Redirect)
  - vercel.json (production 301s)
tech-stack:
  added: []
  patterns:
    - "Per-section Zod props schema with optional knobs + DEFAULTS object that preserves the legacy hardcoded look"
    - "Idempotent seed script via select-then-upsert on unique slug"
    - "Dual-layer redirect: vercel.json for prod + Wouter Redirect for local dev parity"
key-files:
  created:
    - client/src/components/landings/sections/WhatsAppGroupSection.tsx
    - scripts/seed-skale-hub-group-landing.ts
  modified:
    - client/src/components/landings/sectionRegistry.ts
    - client/src/App.tsx
    - vercel.json
decisions:
  - "Exposed ~20 prop knobs on whatsappGroup (badge, headline, bullets, form copy, toasts, endpoint, success state) per CONTEXT.md guidance to lean toward exposing knobs for future Skale Hub variants. All optional with defaults that match the current production page byte-for-byte."
  - "Kept SkaleHubGroup lazy import in App.tsx intentionally (warning, not error) — deletion is 43-06's job after a smoke test."
  - "Used wouter <Redirect> in App.tsx for legacy paths to mirror vercel.json's 301 in local dev. Functionally equivalent for SPA navigation."
metrics:
  duration_seconds: 333
  completed_at: "2026-05-18T03:20:51Z"
  tasks: 3
  files_created: 2
  files_modified: 3
---

# Phase 43 Plan 05: Migrate Skale Hub Group Landing Summary

Extracted `pages/SkaleHubGroup.tsx` into a registered `whatsappGroup` section, seeded a managed landing at `/grupo`, and 301-redirected the legacy `<hub>/grupo` and `<hub>/group` URLs — pure plumbing migration with byte-for-byte visual preservation.

## What was built

1. **WhatsAppGroupSection.tsx** — 270-line section component. All JSX, CSS classes, color tokens (`#0a0f0d`, `#25D366`, `#128C7E`, `#075E54`, `#34C75A`, `#111a14`, `#22c55e`), gradients (`bg-[radial-gradient(...)]`), animations (`animate-ping`, `animate-pulse`, `animate-spin`), data-testids (`input-skale-hub-group-phone`, `button-skale-hub-group-submit`), the inline WhatsAppIcon SVG, the `document.body.style.backgroundColor = "#0a0f0d"` body painter, UTM capture, phone validation, country selector, and the POST to `/api/forms/skale-hub-group/leads` are identical to the source. Every hardcoded string is now a prop with a default that reproduces the current page exactly. Knobs exposed (all optional): `badgeLabel`, `groupName`, `groupSubtitle`, `groupLabel`, `groupOfficialLabel`, `socialProofLabel`, `headline`, `headlineAccent`, `subheadline`, `bullets`, `formTitle`, `formSubtitle`, `formHelper`, `phoneCountryAriaLabel`, `submitLabel`, `privacyLabel`, `submitEndpoint`, `successTitle`, `successBody`, `toastSuccessTitle`, `toastSuccessBody`, `toastErrorTitle`, `phoneInvalidPrefix`.

2. **sectionRegistry.whatsappGroup** — registered alongside the existing 8 home-section adapters. DynamicLanding now resolves `{ type: "whatsappGroup", props: {} }` automatically.

3. **scripts/seed-skale-hub-group-landing.ts** — idempotent upsert script. Confirmed by running twice in a row: first call inserted, second call updated the same row.

4. **vercel.json redirects** — two new entries append the existing host-redirect block: `/skale-hub/grupo` → `/grupo` and `/skale-hub/group` → `/grupo`, both `permanent: true` (HTTP 301).

5. **App.tsx** — replaced the four `<Route ... component={SkaleHubGroup} />` lines with `<Route ...>{() => <Redirect to="/grupo" />}</Route>`. Added `Redirect` to the wouter import.

## Seeded landing row

| Field      | Value                                          |
| ---------- | ---------------------------------------------- |
| id         | `a80b505a-36e8-487c-90b8-62f2927ec0ed`         |
| slug       | `grupo`                                        |
| name       | `Skale Hub WhatsApp Group`                     |
| sections   | `[{ "type": "whatsappGroup", "props": {} }]`   |
| isActive   | `true`                                         |
| createdAt  | `2026-05-18T03:17:58.674Z`                     |
| updatedAt  | `2026-05-18T03:18:10.459Z`                     |

Verified directly against Supabase via a one-off Drizzle SELECT.

## Visual preservation audit

Side-by-side mental diff between `pages/SkaleHubGroup.tsx` and `WhatsAppGroupSection.tsx`:

- Outer `<div class="flex-1 bg-[#0a0f0d] text-white">` — identical
- Top gradient blob `<div class="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(...)]" />` — identical
- Hero `<section>` grid `lg:grid-cols-[1fr_437px]`, `pt-[calc(5rem+36px)]` — identical
- Badge, Skale Hub icon block, live indicator (`animate-ping` red dot), the 4 member avatars (M/A/P/R with the four green hex codes), the social-proof line — identical
- `<h1>` with `text-[clamp(2.5rem,5vw,3.5rem)]` and the `text-[#25D366]` accent span — identical
- Bullets list with `CheckCircle2` icons — identical
- Right card: header (`bg-[#25D366] px-7 py-5`), pulsing `Radio` icon, success state with the rounded green icon, form with phone input + country select, submit button styling and disabled state, privacy footnote — all identical
- The only differences are: (a) text content now flows through resolved variables instead of literal strings, (b) the toast titles/descriptions flow through props (defaults identical), (c) the POST endpoint is `props.submitEndpoint ?? "/api/forms/skale-hub-group/leads"` instead of a literal.

No CSS class, color, animation, layout token, or data-testid changed.

## Redirect behavior

| URL                              | Behavior                                                                 |
| -------------------------------- | ------------------------------------------------------------------------ |
| `/grupo`                         | Renders `DynamicLanding` → `WhatsAppGroupSection` (managed landing)      |
| `/skale-hub/grupo` (prod)        | HTTP 301 → `/grupo` (via `vercel.json` redirects)                        |
| `/skale-hub/group` (prod)        | HTTP 301 → `/grupo` (via `vercel.json` redirects)                        |
| `/skale-hub/grupo` (local dev)   | Wouter `<Redirect to="/grupo" />` swaps history & re-mounts              |
| `/skale-hub/group` (local dev)   | Wouter `<Redirect to="/grupo" />` swaps history & re-mounts              |

Both legacy paths are also resolved for the `legacyPaths.hub` variant when the admin has customized `pageSlugs.hub`.

## Verification

| Check                                                          | Result   |
| -------------------------------------------------------------- | -------- |
| `npm run check`                                                | PASS     |
| `npm run build`                                                | PASS     |
| `vercel.json` is valid JSON                                    | PASS     |
| Seed inserts on first run                                      | PASS     |
| Seed updates on second run (idempotent, same row id)           | PASS     |
| Landing row visible in DB with one whatsappGroup section       | PASS     |
| `pages/SkaleHubGroup.tsx` still exists (deletion in 43-06)     | PASS     |

## Deviations from Plan

None. The plan was executed exactly as written. The only minor latitude was on the props shape — the plan suggested ~14 knobs as a guide; the implementation exposes ~23 covering every user-visible string and the toast copy as well. This matches the CONTEXT.md guidance to "lean toward exposing knobs for future Skale Hub variants" and stays well inside the 300-LOC budget (final size: 274 lines).

## Commits

| Task | Hash      | Message                                                                          |
| ---- | --------- | -------------------------------------------------------------------------------- |
| 1    | `e72e329` | feat(43-05): extract WhatsAppGroupSection + register whatsappGroup               |
| 2    | `0924ff5` | feat(43-05): idempotent seed for Skale Hub group landing at /grupo               |
| 3    | `6eecf0f` | feat(43-05): 301 redirect legacy /skale-hub/grupo and /skale-hub/group to /grupo |

## Self-Check: PASSED

- client/src/components/landings/sections/WhatsAppGroupSection.tsx — FOUND
- scripts/seed-skale-hub-group-landing.ts — FOUND
- client/src/components/landings/sectionRegistry.ts — FOUND (whatsappGroup entry present)
- client/src/App.tsx — FOUND (Redirect import + 4 redirect routes present)
- vercel.json — FOUND (two new redirect entries present, valid JSON)
- Commits e72e329, 0924ff5, 6eecf0f — FOUND in git log
- landing_pages row id=a80b505a-36e8-487c-90b8-62f2927ec0ed — FOUND in DB
