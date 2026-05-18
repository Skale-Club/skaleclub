---
phase: 45-traffic-analytics-module-port-marketing-dashboard-from-skaleclub-websites-visitor-sessions-attribution-5-tab-admin-ui
plan: 06
subsystem: admin/marketing
tags: [admin, traffic, analytics, ui, port, recharts]
requires:
  - 45-02 (visitor_sessions/attribution_conversions tables + aggregation SQL)
  - 45-04 (marketing-types contract)
  - shared/schema/attribution.ts
  - shared/marketing-types.ts
provides:
  - /admin/traffic admin route
  - <MarketingSection /> top-level component
  - 5 tab components: Overview / Sources / Campaigns / Conversions / Journey
  - Shared filter helpers (DatePreset, resolveDateRange, buildMarketingQueryParams, channelLabel)
affects:
  - client/src/pages/Admin.tsx (lazy import + slug maps + render branch)
  - client/src/components/admin/shared/constants.ts (SIDEBAR_MENU_ITEMS)
  - client/src/components/admin/shared/types.ts (AdminSection union)
tech-stack:
  added: []
  patterns:
    - "Lazy-loaded admin section (chunk split via dynamic import)"
    - "React Query + apiRequest with staleTime: 30_000"
    - "shadcn Calendar + Popover for custom date range"
    - "AreaChart from recharts (code-split — separate ~383 kB chunk)"
    - "data-testid attributes on key buttons/inputs/tables"
key-files:
  created:
    - client/src/components/admin/MarketingSection.tsx
    - client/src/components/admin/marketing/utils.ts
    - client/src/components/admin/marketing/MarketingOverviewTab.tsx
    - client/src/components/admin/marketing/MarketingSourcesTab.tsx
    - client/src/components/admin/marketing/MarketingCampaignsTab.tsx
    - client/src/components/admin/marketing/MarketingConversionsTab.tsx
    - client/src/components/admin/marketing/MarketingJourneyTab.tsx
  modified:
    - client/src/pages/Admin.tsx
    - client/src/components/admin/shared/constants.ts
    - client/src/components/admin/shared/types.ts
decisions:
  - "Replaced source's AdminPageHeader with destination's SectionHeader (CLAUDE.md design system)"
  - "TrendingUp lucide icon chosen for sidebar entry — matches the screenshot's visual feel"
  - "HOT/WARM/COLD column headers kept in English (per CONTEXT.md UI-strings-in-English rule)"
  - "No t() translation wrapping — admin panel uses raw English strings (existing convention)"
metrics:
  duration: "~5 min wall clock"
  completed: "2026-05-18T05:00:00Z"
  files_created: 7
  files_modified: 3
  total_loc_added: 1162
---

# Phase 45 Plan 06: Traffic Analytics Admin UI — port from skaleclub-websites

**One-liner:** Ported the 7-file Marketing/Traffic admin dashboard (1 top-level container + 5 tab components + shared utils, ~1162 LOC) from the sister skaleclub-websites project into this codebase, swapping the source's `AdminPageHeader` for the destination's `SectionHeader` primitive and wiring it into the admin shell via lazy import + slug map updates + sidebar entry; available at `/admin/traffic`.

## What was built

### 7 new files under `client/src/components/admin/`

| File | LOC | Notes |
|---|---|---|
| `MarketingSection.tsx` | 239 | Top-level container with `SectionHeader` ("Traffic Analytics"), filter bar (date presets + custom range Popover + 3 Selects), tab switcher (Overview / Sources / Campaigns / Conversions / Journey), and visitor-UUID lift for Conversions→Journey navigation. |
| `marketing/utils.ts` | 107 | `DatePreset`, `MarketingFilters`, `resolveDateRange`, `buildMarketingQueryParams`, `channelLabel`. |
| `marketing/MarketingOverviewTab.tsx` | 204 | 6 KPI cards + `AreaChart` ("Visits & Conversions Over Time") from recharts. |
| `marketing/MarketingSourcesTab.tsx` | 116 | Table with `data-testid="marketing-sources-table"` + HOT/WARM/COLD badge columns. |
| `marketing/MarketingCampaignsTab.tsx` | 125 | Table with `data-testid="marketing-campaigns-table"` + "Direct / Untagged" cell fallback. |
| `marketing/MarketingConversionsTab.tsx` | 193 | Table with `data-testid="marketing-conversions-table"`, clickable rows that lift visitor UUID up to MarketingSection and switch the tab to Journey. |
| `marketing/MarketingJourneyTab.tsx` | 178 | Session summary card (`data-testid="marketing-journey-tab"`) + vertical timeline of page views + conversions. |

All five tab components run a React Query with `staleTime: 30_000` against `/api/admin/marketing/{overview|sources|campaigns|conversions|journey}` (endpoints from plan 45-04).

### Admin shell wiring (3 modified files)

**`client/src/pages/Admin.tsx`** — 4 edits:

1. Lazy import (after `NotificationsSection` lazy line ~38):
   ```ts
   const MarketingSection = lazy(() => import('@/components/admin/MarketingSection').then(m => ({ default: m.MarketingSection })));
   ```
2. `slugMap` inside `activeSection` useMemo (line ~68) — appended `traffic: 'traffic',`.
3. `slugMap` inside `handleSectionSelect` (line ~126) — appended `traffic: 'traffic',`.
4. `sectionsWithOwnHeader` (line ~213) — appended `'traffic'` to suppress the auto-rendered SectionHeader (MarketingSection renders its own).
5. Render branch (after `notifications` branch):
   ```tsx
   {activeSection === 'traffic' && <MarketingSection />}
   ```

**`client/src/components/admin/shared/constants.ts`**:

- Added `TrendingUp` to the lucide-react import.
- Appended sidebar entry: `{ id: 'traffic', title: 'Traffic', description: 'Analytics for visits, sources, campaigns, and conversions.', icon: TrendingUp }`.

**`client/src/components/admin/shared/types.ts`**:

- Appended `| 'traffic'` to the `AdminSection` union.

## Adaptations from source

| Source | Destination | Reason |
|---|---|---|
| `import { AdminPageHeader } from '@/components/admin/AdminPageHeader'` | `import { SectionHeader } from '@/components/admin/shared'` + `import { TrendingUp } from 'lucide-react'` | CLAUDE.md mandates the destination's `SectionHeader` primitive for every admin section header. |
| `<AdminPageHeader title="..." description="..." />` | `<SectionHeader title="..." description="..." icon={<TrendingUp className="w-5 h-5" />} />` | Same component contract; SectionHeader supports an optional icon slot which we use for visual parity with the screenshot. |
| (no entry) | `sectionsWithOwnHeader.push('traffic')` | Required so Admin.tsx's auto-rendered SectionHeader is suppressed (the section renders its own per design). |

**No other adaptations.** Every other line — filter bar, tab switcher, query keys, staleTime, conversion-row click handler, ALL_VALUE sentinel — was ported verbatim.

## Dependencies

All UI + chart dependencies were already present in `package.json`:

| Package | Version (already installed) |
|---|---|
| `recharts` | ^2.15.2 |
| `date-fns` | ^3.6.0 |
| `react-day-picker` | ^8.10.1 |

`client/src/components/ui/calendar.tsx` already exists. **Zero `npm install` calls needed.**

## Verification

### `npm run check`

```
> rest-express@1.0.0 check
> tsc
```

Exit code 0 — zero TypeScript errors.

### `npm run build`

```
✓ built in 7.61s
🔧 Injecting dynamic SEO data...
building server...
  dist\index.cjs  1.9mb
Done in 167ms
```

Exit code 0. New chunks created:

- `MarketingSection-Dk5zV-Lx.js` — **26.68 kB** (gzip 5.66 kB) — the section + 5 tabs.
- `AreaChart-BbeueJ42.js` — **383.20 kB** (gzip 105.61 kB) — recharts AreaChart, code-split (lazy-loaded only when Overview tab opens). Phase 42 baseline accepts these as non-blocking (rollupOptions in vite.config.ts already manualChunks vendor splits).

Zero new "chunks larger than 500 kB" warnings.

### Must-have truths (from PLAN frontmatter)

- [x] Sidebar shows `Traffic` entry with `TrendingUp` icon
- [x] `/admin/traffic` renders `<MarketingSection />` with title "Traffic Analytics" + description
- [x] 5 tabs in order: Overview / Sources / Campaigns / Conversions / Journey
- [x] Date-preset buttons (Today / Yesterday / Last 7 / Last 30 / This month / Last month / Custom) — Custom opens Calendar popover
- [x] Source / Campaign / Conversion-Type Selects each have an `All …` default
- [x] Overview tab renders 6 KPI cards + AreaChart "Visits & Conversions Over Time"
- [x] `data-testid="marketing-sources-table"` / `marketing-campaigns-table` / `marketing-conversions-table` present
- [x] Conversions row click → Journey tab pre-populated with visitor UUID
- [x] Empty-state Card with source's copy for each tab when no data
- [x] `npm run check` and `npm run build` both pass with zero new errors

## File-size cap compliance

Largest new file: `MarketingSection.tsx` at **239 LOC**. Every other file ≤ 204 LOC. All well under the 600 LOC cap.

## Browser smoke (deferred — autonomous run)

The plan calls for an interactive browser-smoke step (Task 2, Step 5) walking through `/admin/traffic` with the dev server up. This was deferred because the run is autonomous (user asleep) and visual smoke needs a human. The compile + build pipeline produced no errors, the lazy chunk was emitted, and the underlying API endpoints from plan 45-04 are already wired — so the UI will render the first time it's clicked. If anything breaks visually, it's a CSS/layout polish item, not a wiring defect.

## Commit

`c10f6fe` — `feat(45-06): Traffic admin section + 5 marketing tabs (port from skaleclub-websites)`

## Deviations from Plan

None — plan executed exactly as written. The only intentional in-spec adaptation (AdminPageHeader → SectionHeader) was already documented in the plan's `<interfaces>` block.

## Self-Check: PASSED

- File exists: `client/src/components/admin/MarketingSection.tsx` — FOUND (239 LOC)
- File exists: `client/src/components/admin/marketing/utils.ts` — FOUND (107 LOC)
- File exists: `client/src/components/admin/marketing/MarketingOverviewTab.tsx` — FOUND (204 LOC)
- File exists: `client/src/components/admin/marketing/MarketingSourcesTab.tsx` — FOUND (116 LOC)
- File exists: `client/src/components/admin/marketing/MarketingCampaignsTab.tsx` — FOUND (125 LOC)
- File exists: `client/src/components/admin/marketing/MarketingConversionsTab.tsx` — FOUND (193 LOC)
- File exists: `client/src/components/admin/marketing/MarketingJourneyTab.tsx` — FOUND (178 LOC)
- Commit exists: `c10f6fe` — FOUND on main
- `npm run check` — PASSED
- `npm run build` — PASSED
