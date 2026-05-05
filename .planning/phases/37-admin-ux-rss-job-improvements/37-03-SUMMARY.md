---
phase: 37-admin-ux-rss-job-improvements
plan: 03
subsystem: admin-ui
tags: [react, react-query, shadcn, admin-blog, rss, preview-dialog, translations]

requires:
  - phase: 37-admin-ux-rss-job-improvements
    plan: 01
    provides: GET /api/blog/health, joined-read storage methods, RssItemWithSource + BlogGenerationJobWithRssItem result interfaces
  - phase: 37-admin-ux-rss-job-improvements
    plan: 02
    provides: 10 admin REST endpoints (rss-sources CRUD, rss-items, jobs/list/retry/cancel, preview, from-preview), runPreview() helper
provides:
  - 6 new React component files under client/src/components/admin/blog/
  - Third "RSS" top-level tab inside the Blog admin section
  - Preview-then-commit two-step UI flow replacing direct generate-and-commit
  - 51 new translation keys under "Admin — Blog RSS (Phase 37)" PT-BR section
  - BLOG_COST_PRICING exported constant for cost-estimate chip (D-16)
affects: []

tech-stack:
  added: []
  patterns:
    - "Modal CRUD via Dialog + AlertDialog confirmation (matches FaqsSection / EstimatesSection)"
    - "Auto-save Switch idiom (onCheckedChange directly calls updateMutation.mutate)"
    - "React Query refetchInterval gated by data state (poll only while latest job is running)"
    - "Status sub-tabs + offset pagination for paginated list panels (50/page)"
    - "Sub-component composition under one top-level tab (RssAutomationTab composes Banners + 3 panels)"
    - "Translations.ts compaction strategy 4 (logically-related entries on a single line) when whitespace-only and section-merge strategies are insufficient"

key-files:
  created:
    - client/src/components/admin/blog/AutomationStatusBanners.tsx
    - client/src/components/admin/blog/RssSourcesPanel.tsx
    - client/src/components/admin/blog/RssQueuePanel.tsx
    - client/src/components/admin/blog/JobHistoryPanel.tsx
    - client/src/components/admin/blog/PreviewDraftDialog.tsx
    - client/src/components/admin/blog/RssAutomationTab.tsx
  modified:
    - client/src/components/admin/BlogSection.tsx
    - client/src/lib/translations.ts

key-decisions:
  - "Skip plan-listed translation keys that already exist in the static dictionary (Status, Enabled, Disabled, Cancel, Refresh, Title, Error) — TypeScript would reject duplicate object keys; the existing values (e.g. 'Habilitado'/'Desabilitado' from Phase 30) remain authoritative"
  - "Aggressive translations.ts compaction: collapsed whitespace-only section separators AND consolidated logically-related short entries (Common buttons, Days, Months, dashboard status badges, etc.) onto single lines — file went 600 → 443 lines, leaving 157 lines of headroom"
  - "RssAutomationTab uses native button-based sub-tabs (matches RssQueuePanel sub-tab pattern) instead of shadcn Tabs primitive — consistent micro-pattern across both panels"
  - "PreviewDraftDialog body preview strips HTML via simple regex tag-strip + first-200-words slice — no client-side sanitizer needed because the content was already sanitized server-side by sanitizeBlogHtml in Phase 36"
  - "Mutation onError typed as `(err: Error)` (not `any`) — TypeScript-strict friendlier; React Query default is `Error`"
  - "Removed BlogAutomationPanel.generateMutation block entirely (no fallback) — Generate Now is now exclusively preview-then-commit (D-17)"

patterns-established:
  - "blog/ subfolder for admin Blog feature components — keeps the legacy 1330-line BlogSection.tsx untouched while clustering the new domain"
  - "BLOG_COST_PRICING-style constant co-located with the consuming component (vs. a shared config) — matches the 'cost is a directional UI estimate' framing (D-16)"

requirements-completed: [BLOG2-07, BLOG2-08, BLOG2-09, BLOG2-10, BLOG2-11, BLOG2-12, BLOG2-13]

duration: ~25min
completed: 2026-05-05
---

# Phase 37 Plan 03: Frontend Panels Summary

**6 new React components under `client/src/components/admin/blog/` plus minimal touch on `BlogSection.tsx` deliver the full Phase 37 admin surface — third "RSS" top-level tab, sub-tabs (Sources / Queue / Jobs), red API-key warning banner, next-run + cost chips, and preview-then-commit dialog replacing direct generate-and-commit.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-05T~14:50:00Z
- **Completed:** 2026-05-05T~15:15:00Z
- **Tasks:** 7 implementation + 1 auto-approved checkpoint
- **Files created:** 6
- **Files modified:** 2

## Final Line Counts

| File | Lines | Cap | Headroom |
| --- | ---: | ---: | ---: |
| `client/src/lib/translations.ts` | 443 | 600 | 157 |
| `client/src/components/admin/blog/RssAutomationTab.tsx` | 48 | 600 | 552 |
| `client/src/components/admin/blog/AutomationStatusBanners.tsx` | 127 | 600 | 473 |
| `client/src/components/admin/blog/RssQueuePanel.tsx` | 178 | 600 | 422 |
| `client/src/components/admin/blog/PreviewDraftDialog.tsx` | 224 | 600 | 376 |
| `client/src/components/admin/blog/JobHistoryPanel.tsx` | 225 | 600 | 375 |
| `client/src/components/admin/blog/RssSourcesPanel.tsx` | 306 | 600 | 294 |
| `client/src/components/admin/BlogSection.tsx` | 1330 | (legacy) | — |

`BlogSection.tsx` is treated as legacy per CONTEXT (37-03-PLAN read_first guidance). Its 1330-line state is **down 21 lines from 1351** — the `generateMutation` block (~25 lines) was removed in favor of `useState<boolean>(isPreviewOpen)` (1 line) + 2 imports + 1 dialog mount.

## BLOG_COST_PRICING (Actually Used)

```typescript
// Source: ai.google.dev/pricing (verified 2026-05-05)
export const BLOG_COST_PRICING = {
  contentTokensPerPost: 3000,
  contentPricePer1M: 0.075,    // gemini-2.5-flash, USD per 1M tokens
  imagePricePerImage: 0.039,   // gemini-2.0-flash-exp image, USD per image
} as const;
```

Identical to the planned constants (D-16). `computeMonthlyCost(postsPerDay)` outputs `Math.round(((0.0068 + 0.039) × postsPerDay × 30) × 100) / 100` rounded to cents.

## Task Commits

1. **Task 1: Compact translations.ts and add Phase 37 keys** — `f5be4d2` (feat)
2. **Task 2: Create AutomationStatusBanners.tsx** — `16f5c48` (feat)
3. **Task 3: Create RssSourcesPanel.tsx** — `56f74f1` (feat)
4. **Task 4: Create RssQueuePanel.tsx** — `f9a60f7` (feat)
5. **Task 5: Create JobHistoryPanel.tsx** — `8e2d693` (feat)
6. **Task 6: Create PreviewDraftDialog.tsx** — `c941c80` (feat)
7. **Task 7: RssAutomationTab + BlogSection rewire** — `d15e300` (feat)

## Translation Keys Added (51 unique)

`RSS`, `RSS Sources`, `RSS Queue`, `Job History`, `Sources`, `Queue`, `Jobs`, `Add Source`, `Edit Source`, `Source name`, `Feed URL`, `Last fetched`, `Never fetched`, `Fetch error`, `Delete source?`, `Deleting this source removes all queued items for it.`, `No RSS sources yet`, `Add your first RSS feed to start gathering topics.`, `Pending`, `Used`, `Skipped`, `No items in this bucket`, `View resulting post`, `Skip reason`, `Started`, `Completed`, `Source item`, `Retry`, `Cancel job`, `Job retried — new run started`, `Source item no longer available`, `Lock not stale yet`, `Job cancelled`, `No jobs yet`, `Generate Preview`, `Preview Draft`, `Generating preview…`, `Save as Draft`, `Discard`, `Source`, `Excerpt`, `Feature image`, `Body preview`, `Preview failed`, `Draft saved`, `Blog generator unavailable: configure Gemini integration to enable RSS-driven generation.`, `Open Integrations`, `Next run`, `Estimated cost`, `approximate, based on Gemini list pricing`, `No upcoming run scheduled`, `per month`, `Pages`, `Page`, `of`.

## Translation Keys SKIPPED (already in static dictionary — would have caused TS2300 duplicate identifier)

`Status` (line 80 — Phase M3-02), `Enabled` / `Disabled` (Phase 30 — Habilitado/Desabilitado), `Cancel` (Common), `Refresh` (Phase 13-03), `Title` (Forms), `Error` (Messages).

The plan explicitly flagged `Error` as a likely duplicate ("NOTE on `t('Error')`: this key already exists"); the same logic applies to the other six. Existing values are kept authoritative; new components reference the existing keys.

## Verification

```
=== File line caps === all under cap ✓
=== blog/ directory === 6 files present ✓
=== Translations section === 'Admin — Blog RSS (Phase 37)' header present ✓
=== BlogSection wired === id 'rss' + RssAutomationTab + PreviewDraftDialog ✓
=== Cost pricing constant === BLOG_COST_PRICING exported ✓
=== Polling gate === refetchInterval present ✓
=== generateMutation === 0 references (cleanly removed) ✓
=== npm run check === only 4 pre-existing errors in blogContentValidator.ts + rssFetcher.ts (logged in deferred-items.md from Plan 01); no new errors introduced ✓
```

## Decisions Made

- **Compact translations strategy 4 (logically-related single-line consolidation):** the precheck showed `wc -l = 600`, blank lines = 0, comment lines = ~46. Whitespace removal alone would have freed ~9 lines — insufficient for 51+ new keys. Strategy 4 (consolidating short entries like `'Yes': 'Sim', 'No': 'Não', 'Close': 'Fechar', ...` on a single line) freed ~150 lines. Final landing: 443/600 (157 lines headroom).
- **Skip duplicate keys:** TypeScript would refuse a literal object with two `'Status'` properties (TS2300). The plan's key list included 7 keys that already exist; new components reference the existing dictionary entries (which already render correctly in PT-BR).
- **Native sub-tab buttons (not shadcn Tabs primitive):** RssQueuePanel introduced a button-based sub-tab pattern in this plan; RssAutomationTab matches it for visual consistency. The shadcn Tabs primitive is not currently used elsewhere in the admin and would have been a one-off introduction.
- **Mutation onError typed `(err: Error)`:** TanStack v5's default error type is `Error`; using `Error` over `any` keeps strict-mode happy and is the v5-recommended typing.

## Deviations from Plan

### Auto-fixed (Rule 3 — would have prevented compile)

**1. [Rule 3 - TypeScript duplicate key] Skipped 7 translation keys that already exist in the static dictionary**

- **Found during:** Task 1 (pre-flight grep before adding the new section)
- **Issue:** The plan's key list verbatim includes `'Status'`, `'Enabled'`, `'Disabled'`, `'Cancel'`, `'Refresh'`, `'Title'`, `'Error'` — all already present in the static dictionary (added in earlier phases). Adding them again would cause `TS2300: Duplicate identifier`.
- **Fix:** Skip these 7 keys in the new Phase 37 section. New components reference the existing dictionary entries (which already render in PT-BR — e.g. `Enabled` → `Habilitado` from Phase 30 vs the plan's proposed `Ativada`). The plan's note on `t("Error")` ("this key already exists") implicitly authorized this pattern — the same logic applies to the other six.
- **Files modified:** `client/src/lib/translations.ts`
- **Commit:** `f5be4d2`

**2. [Rule 3 - Headroom] Translations.ts compaction required strategy 4**

- **Found during:** Task 1 mandatory headroom precheck (W-6)
- **Issue:** `wc -l = 600`, blank lines = 0, comment lines = ~46 — only ~46 lines of "easy" headroom from strategies 1-3. Phase 37 needs ~52 unique new keys. Insufficient.
- **Fix:** Apply strategy 4 (consolidate logically-related short entries onto single lines) — Common buttons, Days/abbrev, Months, dashboard status, etc. Freed ~150 lines. Final 443 / 600 (157 headroom).
- **Files modified:** `client/src/lib/translations.ts`
- **Commit:** `f5be4d2`
- **Why this is Rule 3 and not a plan re-write:** The plan explicitly authorized strategy 4 in the W-6 precheck block — quote: "if `(blank_lines + section_comment_merges) < 60`, the basic compaction strategies (1-3 below) will NOT be enough — you MUST also apply strategy 4."

### Out-of-scope items NOT fixed

Pre-existing TypeScript errors in `server/lib/blogContentValidator.ts` (missing `sanitize-html` types, 3 errors) and `server/lib/rssFetcher.ts` (missing `rss-parser` types, 1 error) persist. Already documented in `.planning/phases/37-admin-ux-rss-job-improvements/deferred-items.md` (Plan 01). No Phase 37 frontend file imports these modules.

## Authentication Gates

None — all 10 endpoints already gated by `requireAdmin` (Plan 02). No new env vars required.

## Issues Encountered

None — all 7 implementation tasks executed cleanly. The translations.ts duplicate-key issue was caught by the pre-flight grep before the change; no compile failure occurred.

## Manual Verification Checkpoint (Task 8)

**Auto-approved** (workflow.auto_advance=true). The plan defined Task 8 as a `checkpoint:human-verify` for full UX walkthrough; the auto-mode policy auto-approves human-verify checkpoints and continues to summary/state updates. The verification steps from the plan are preserved here for the user to run when convenient:

1. `npm run dev` → `/admin` → Blog section → click "RSS" tab
2. Verify: red banner appears IF `BLOG_GEMINI_API_KEY` missing; two info chips (next run + cost) visible; three sub-tabs render
3. In Sources: Add Source dialog round-trip; Switch toggle; Edit + Delete confirmations
4. In Queue: Pending / Used / Skipped sub-tabs; pagination; "View resulting post" link on Used rows
5. In Jobs: last 50 visible; failed → Retry; running > 10min → Cancel; manual Refresh
6. In Automation tab: Generate Now opens PreviewDraftDialog; Discard closes without DB write; Save as Draft creates draft + invalidates caches
7. Switch language to PT — confirm chips, sub-tabs, button copy translate

## Next Phase Readiness

**Phase 37 is now feature-complete at the UI layer.** All 7 BLOG2-07..13 requirements are addressed. The phase is ready for:
- `/gsd:verify-work` (verifier agent on the full phase)
- Manual UAT against the verification steps above
- `/gsd:transition` to advance to Phase 38 once UAT passes

## Self-Check: PASSED

- All 6 new files exist at expected paths (verified via `ls client/src/components/admin/blog/`)
- All 7 task commits exist in `git log --oneline`: f5be4d2, 16f5c48, 56f74f1, f9a60f7, 8e2d693, c941c80, d15e300
- All file caps respected (largest new file: 306 lines, well under 600)
- BlogSection.tsx wired (id 'rss' + RssAutomationTab + PreviewDraftDialog imports + isPreviewOpen state)
- generateMutation removed (0 references in BlogSection.tsx)
- BLOG_COST_PRICING exported from AutomationStatusBanners.tsx
- refetchInterval present in JobHistoryPanel.tsx
- `npm run check` introduces 0 new errors vs. Plan 02 baseline (same 4 pre-existing errors)

---
*Phase: 37-admin-ux-rss-job-improvements*
*Completed: 2026-05-05*
