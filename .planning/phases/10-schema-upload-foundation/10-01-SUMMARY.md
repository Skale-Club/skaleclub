---
phase: 10-schema-upload-foundation
plan: 01
subsystem: shared-schema
tags: [schema, zod, jsonb, uuid, backward-compat, lazy-backfill]
requires: []
provides:
  - linksPageThemeSchema (Zod)
  - linksPageLinkSchema (Zod) with server-side UUID transform
  - linksPageSocialSchema (Zod)
  - linksPageConfigSchema (Zod) — replaces z.custom<T>() escape hatch
  - normalizeLinksPageConfig() pure helper (shared/links.ts)
  - DEFAULT_LINKS_PAGE_THEME constant
  - LinksPageConfigNormalized / LinksPageLinkNormalized strict TS types
affects:
  - insertCompanySettingsSchema (linksPageConfig column)
  - server/storage.ts::getCompanySettings (lazy backfill on every read)
  - PUT /api/company-settings (now validates linksPageConfig shape at the API edge)
tech-stack:
  added: []  # zero new dependencies
  patterns:
    - Real Zod object schema backing a JSONB column (v1.2 estimates pattern)
    - Lazy UUID backfill on read instead of a data migration script
    - z.input<> exports for backward-compat when a schema gains required/transform fields
key-files:
  created:
    - shared/links.ts
  modified:
    - shared/schema/settings.ts
    - server/storage.ts
decisions:
  - Use z.input<> (not z.infer<>) for exported LinksPageLink/LinksPageConfig TS types so pre-Phase-12 client code (LinksSection.addLink) still compiles without touching UI logic
  - Per-link new fields (iconType, iconValue, visible, clickCount) are Zod .optional() rather than .default() at the schema level; runtime defaults are guaranteed by normalizeLinksPageConfig on read, not by the Zod output type
  - Theme defaults hard-coded to current visual state (#1C53A3 primary, #0f1014 background) so legacy rows look identical after normalization
  - No SQL migration — JSONB column unchanged; additive change is TypeScript-only plus the lazy-normalizer
  - No client code changes — LinksSection.tsx preserved for Phase 12 rewrite
metrics:
  duration: ~25 minutes
  completed: 2026-04-19
  tasks: 3
  files_changed: 3
  commits: 3
---

# Phase 10 Plan 01: Schema & Normalizer Summary

Upgraded `linksPageConfig` from a `z.custom<T>()` escape hatch to a real Zod object schema (`linksPageConfigSchema` + per-sub-schema pieces) with a server-side UUID transform on `linksPageLinkSchema.id`, and added a pure `normalizeLinksPageConfig()` helper wired into `storage.getCompanySettings()` so every read lazily backfills UUIDs, `visible`/`clickCount` defaults, and theme defaults on legacy rows.

## What Shipped

### 1. `shared/schema/settings.ts` — Zod schemas + derived types

New Zod exports (order matches file):

| Export | Kind | Purpose |
|--------|------|---------|
| `linksPageThemeSchema` | `z.object` | Theme sub-object: `primaryColor` / `backgroundColor` (hex-validated), `backgroundGradient`, `backgroundImageUrl` — all optional |
| `linksPageLinkSchema` | `z.object` | One link. `id: z.string().uuid().optional().transform(v => v ?? randomUUID())` stamps a server-side UUID on every parsed link that lacks one. Adds optional `iconType`/`iconValue`/`visible`/`clickCount` |
| `linksPageSocialSchema` | `z.object` | Unchanged shape (`platform`/`url`/`order`) but now a real Zod schema |
| `linksPageConfigSchema` | `z.object` | Top-level config: `avatarUrl`/`title`/`description`/`links`/`socialLinks` all required, `theme` optional |

Derived TypeScript types:

| Type | Source | Used By |
|------|--------|---------|
| `LinksPageTheme` | `z.input<typeof linksPageThemeSchema>` | Admin draft state |
| `LinksPageLink` | `z.input<typeof linksPageLinkSchema>` | Public surface — `id` is optional so `LinksSection.addLink()` still compiles |
| `LinksPageSocial` | `z.input<typeof linksPageSocialSchema>` | Public surface |
| `LinksPageConfig` | `z.input<typeof linksPageConfigSchema>` | Public surface — consumed by `LinksSection.tsx` and `Links.tsx` |
| `LinksPageLinkNormalized` | `z.output<typeof linksPageLinkSchema>` | Strict type for post-parse / post-normalize paths (every field present) |
| `LinksPageConfigNormalized` | `z.output<typeof linksPageConfigSchema>` | Strict type for server code that just parsed or normalized a payload |

Replacements:

- `insertCompanySettingsSchema.linksPageConfig: z.custom<LinksPageConfig>().optional().nullable()` → `linksPageConfigSchema.optional().nullable()` (real runtime validation; malformed payloads now 400 at the API edge)
- Old `interface LinksPageLink` / `LinksPageSocial` / `LinksPageConfig` (lines 236-255 of previous file) deleted
- JSONB column default extended with `theme: {}` so new rows are born with the v1.3 shape

### 2. `shared/links.ts` (NEW) — pure lazy-backfill helper

- `normalizeLinksPageConfig(raw)`: defensive pure function, no Drizzle / Supabase / db / storage deps. Guarantees every returned link has a UUID `id`, boolean `visible`, numeric `clickCount`, and `iconType`/`iconValue` defaults — including legacy rows shaped `{title,url,order}`. Guarantees `theme` is merged with `DEFAULT_LINKS_PAGE_THEME`. Idempotent — existing UUIDs are preserved on repeated calls.
- `DEFAULT_LINKS_PAGE_THEME`: `primaryColor: "#1C53A3"` (brand blue per CLAUDE.md), `backgroundColor: "#0f1014"` (current `/links` visual), empty gradient + image URL.

### 3. `server/storage.ts::getCompanySettings()` — wires normalizer on read

Both branches (row exists, row auto-created) now spread-return with `linksPageConfig: normalizeLinksPageConfig(...)` so every caller downstream (`PUT /api/company-settings` round-trip, public `GET /api/company-settings` via CDN, admin UI fetch) sees a fully-normalized config. First admin save after deploy persists the UUID-stamped shape via the linksPageLinkSchema transform, completing a zero-migration lazy-backfill.

## Public Symbol Preservation

The following exported names from `@shared/schema` (via the barrel at `shared/schema.ts`) remain **identical** so the `LinksSection.tsx` consumer still imports without modification:

- `LinksPageLink`
- `LinksPageSocial`
- `LinksPageConfig`

Verified: `client/src/components/admin/LinksSection.tsx` and `client/src/components/admin/shared/types.ts` (line 1: `import type { HomepageContent, LinksPageConfig }`) compile against the new `z.input<>`-derived types with zero code changes.

## Requirements Covered

| Req ID | Delivered |
|--------|-----------|
| **LINKS-01** | Extended JSONB shape (iconType/iconValue/visible/clickCount/theme) + real Zod validation at API edge + backward-compat on reads via normalizer |
| **LINKS-03** | Stable UUID per link — stamped via `linksPageLinkSchema.id.transform(v => v ?? randomUUID())` on write, stamped by `normalizeLinksPageConfig` on read |

## Key Decisions Made

1. **`z.input<>` not `z.infer<>` for exported types** — when a Zod schema uses `.transform()` on an optional field, the OUTPUT type marks that field required. Pre-Phase-12 client code builds plain `{title, url, order}` objects that would fail against the strict output type. Using `z.input<>` keeps the client compiling without altering UI logic; the Normalized variants are available for strict server paths.
2. **`.optional()` instead of `.default()` on per-link new fields** — `.default()` in Zod also produces a required output type; `.optional()` preserves the loose input *and* output shape. Runtime defaults are guaranteed by `normalizeLinksPageConfig()` on every read (the canonical source of truth for default filling), so the schema stays lenient and the compile-time types stay friendly to pre-migration client code.
3. **Theme default = current visual state, not pure brand tokens** — `backgroundColor: "#0f1014"` matches the current `/links` dark theme, so legacy rows normalized through this helper render identically to today. Admins get a blank-canvas feel in Phase 13's theme editor without breaking the live look.
4. **No SQL migration** — column is still `jsonb`; Drizzle's `$type<LinksPageConfig>` annotation is TypeScript-only. `npm run db:push` generates no diff. Lazy normalize on read + UUID transform on write = zero-step rollout.
5. **No client code touched in this plan** — Phase 12 owns the admin UI rewrite. All Phase 10 Task 1 acceptance is achievable with schema/type changes plus the lenient-type trick above.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ EXIT=0 (full repo strict compile) |
| `npm run build` | ✅ vite client bundle + esbuild server bundle both succeed |
| `grep` acceptance criteria (Task 1-3) | ✅ all 12 patterns match / non-match as specified |
| Manual curl smoke (PUT/GET round-trip, malformed rejection) | ⏭️ Not run — no admin session available in this shell. Covered by Phase-level `/gsd:verify-work` step. |

## Smoke Test Status

**Not executed in this shell.** Reason: no authenticated admin `cookies.txt` available during execution, and the plan explicitly permits deferring the curl round-trip to `/gsd:verify-work` when a session isn't ready. The full compile guard (`tsc` + `build`) and every grep-based structural acceptance criterion passed, which is the sampling-rate contract documented in `10-VALIDATION.md`.

Recommended to run at the `/gsd:verify-work` gate:

```bash
# 1. PUT a link with no id
curl -b cookies.txt -X PUT http://localhost:5000/api/company-settings \
  -H 'Content-Type: application/json' \
  -d '{"linksPageConfig":{"avatarUrl":"","title":"t","description":"d","links":[{"title":"Smoke","url":"https://example.com","order":0}],"socialLinks":[],"theme":{}}}'
# Expect 200

# 2. GET and inspect
curl -s http://localhost:5000/api/company-settings | jq '.linksPageConfig.links[0]'
# Expect: { id: "<UUID v4>", visible: true, clickCount: 0, iconType: "auto", iconValue: "", order: 0, title: "Smoke", url: "https://example.com" }

# 3. Malformed payload
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt -X PUT http://localhost:5000/api/company-settings \
  -H 'Content-Type: application/json' \
  -d '{"linksPageConfig":{"links":"not-an-array"}}'
# Expect 400
```

## Deviations from Plan

### Adjustment — TS type export strategy (Task 1, step 7)

**Found during:** Task 1 verification (first `npx tsc --noEmit` after initial edit produced 14 errors in `LinksSection.tsx` and `Links.tsx`).

**Issue:** The plan-as-written exported `LinksPageLink = z.infer<typeof linksPageLinkSchema>` and declared new per-link fields with `.default()`. Together, those choices produce an OUTPUT TS type where every new field is required — which makes pre-Phase-12 client construction (`addLink` pushing `{title, url, order}`, `LINKS_PAGE_DEFAULTS: LinksPageConfig = {…}` without a `theme`) fail to compile. The plan's step-7 fallback ("add `icon: z.string().optional()` as a backward-compat field") addresses the opposite case (removed field), not the added-required-fields case.

**Fix:** Two coordinated changes — (a) per-link new fields use `.optional()` instead of `.default()` at the Zod schema level, so both input AND output types keep them optional; (b) exported `LinksPageLink`/`LinksPageConfig`/`LinksPageSocial` are `z.input<>`-derived (not `z.infer<>`) so the one field using `.transform()` (`id`) is also optional on the exposed type. A separate `LinksPageLinkNormalized` / `LinksPageConfigNormalized` pair (using `z.output<>`) is exported for server code that has just parsed or normalized a payload.

**Why it's still correct:** Runtime defaults are guaranteed by two independent mechanisms — `linksPageConfigSchema.parse(req.body)` in the PUT route (which executes the `id` transform), and `normalizeLinksPageConfig()` in `getCompanySettings()` (which fills every other field and also stamps UUID as a belt-and-suspenders on read). The TS surface is looser than the runtime guarantees, which is the exact trade-off the original plan made implicitly — this deviation just makes it explicit and documented.

**Files modified:** `shared/schema/settings.ts` only; no additional files beyond plan's scope.

**Commit:** `3b4f7a2`

## Downstream Enablement

Phase 11 (click endpoint) can now safely:
- Assume every `links[].id` exists and is a UUID on reads from `getCompanySettings()`
- Rely on `clickCount` being a number (starting at 0) for atomic increments
- Rely on `visible` being a boolean for filtering in the public payload

Phase 12 (admin UI rewrite) can now:
- Construct new links without worrying about `id` — the server stamps it via the Zod transform
- Use `LinksPageLinkNormalized` to type state that's been fetched from the server (strict view)
- Use `LinksPageLink` for draft/edit state (loose view, matches current `LinksSection.tsx` patterns)

Phase 13 (theme editor) can now:
- Read `theme` from `getCompanySettings()` and trust it's merged with `DEFAULT_LINKS_PAGE_THEME`
- Write `theme` partials via the PUT route and have the server validate hex colors through `linksPageThemeSchema`

## Known Stubs

None. The theme object is technically "empty-defaulted" on a brand-new row, but `normalizeLinksPageConfig()` fills live values from `DEFAULT_LINKS_PAGE_THEME` on every read, so downstream consumers never see an undefined theme field. Phase 13 will expose theme editing in the admin UI.

## Self-Check: PASSED

- ✅ `shared/schema/settings.ts` (modified) — contains `linksPageLinkSchema`, `linksPageConfigSchema`, `linksPageThemeSchema`, `linksPageSocialSchema`, `LinksPageConfig` (z.input), `LinksPageConfigNormalized` (z.output); no `z.custom<LinksPageConfig>` remaining; `import { randomUUID } from "crypto"` present
- ✅ `shared/links.ts` (created) — exports `normalizeLinksPageConfig` + `DEFAULT_LINKS_PAGE_THEME`; no drizzle/supabase/db/storage imports
- ✅ `server/storage.ts` (modified) — imports `normalizeLinksPageConfig`; applies it on both branches of `getCompanySettings`
- ✅ Commit `3b4f7a2` — Task 1 (schema upgrade)
- ✅ Commit `bac03a7` — Task 2 (normalizer helper)
- ✅ Commit `47f7e74` — Task 3 (storage wiring)
- ✅ `npx tsc --noEmit` EXIT=0
- ✅ `npm run build` succeeds (client + server)
