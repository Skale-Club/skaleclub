---
phase: m3-04-leads-scoping
plan: 04-01
subsystem: api
tags: [react, react-query, express, drizzle, zod, multi-tenancy, admin-ui]

requires:
  - phase: m3-03-public-and-chat-slug-awareness
    provides: /api/forms admin endpoint + form_id on form_leads (from M3-01) + dual-endpoint submission

provides:
  - GET /api/form-leads?formId=N (admin filter)
  - Form selector dropdown on admin Leads section
  - Form selector on admin Dashboard (scopes all lead-derived metrics)
  - Per-row form badge + detail-sheet form badge (single-form suppression)

affects:
  - m3-05-cleanup (remaining legacy-endpoint cleanup is now safe — admin UI no longer relies on aggregate-only reads)

tech-stack:
  added: []
  patterns:
    - "Single-form suppression via `hasMultipleForms = activeForms.length > 1`: dropdowns and badges hide themselves when only the default form exists, preserving zero visual regression for single-form operators"
    - "Query-param filters composed inside useQuery queryFn with state-object queryKey so React Query refetches when any filter changes; formId slots into the same shape as existing status/classification filters"
    - "z.coerce.number() on query-string Zod input — lets callers pass `?formId=1` as string, decodes to number server-side"

key-files:
  created:
    - .paul/phases/m3-04-leads-scoping/04-01-PLAN.md
    - .paul/phases/m3-04-leads-scoping/04-01-SUMMARY.md
  modified:
    - shared/routes.ts (formLeads.list Zod input gains formId)
    - server/storage.ts (IStorage.listFormLeads + DatabaseStorage impl accept formId)
    - server/routes/company.ts (GET /api/form-leads filters type assertion)
    - client/src/components/admin/LeadsSection.tsx (form dropdown + row badge + detail badge + scoped queryKey/params + Form type import)
    - client/src/components/admin/DashboardSection.tsx (form selector + scoped leads query + Select/Form imports)
    - client/src/lib/translations.ts (PT keys: 'Form', 'Form:')

key-decisions:
  - "Single-form suppression is the right default: operators with only 'default' form see zero new UI, preserving AC-4's no-regression promise"
  - "Filter by form id (not slug): admin UI already has Form[] with ids from /api/forms; slugs would require redundant lookup and aren't needed until public surfaces (M3-05+)"
  - "Leave /api/form-config fetch in LeadsSection untouched: the detail-sheet question labels still read from default-form config; rewiring to per-form config is M3-05's responsibility (TODO comment added)"

patterns-established:
  - "hasMultipleForms gate: any form-scoped admin UI element (dropdown, badge, sentence) should be wrapped in this check to avoid polluting single-form workspaces"
  - "Reuse /api/forms on any admin surface that needs a list of forms — a single query feeds both selector and badge-name resolution via useMemo Map<id, Form>"

duration: ~35min
started: 2026-04-15T14:30:00Z
completed: 2026-04-15T15:05:00Z
---

# M3-04 Plan 04-01: Leads Section Scoping + Dashboard Segmentation Summary

**Admin Leads and Dashboard can now be scoped to a single form via a dropdown; lead rows/detail show a form badge; single-form workspaces see zero visual change.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~35 min |
| Started | 2026-04-15T14:30:00Z |
| Completed | 2026-04-15T15:05:00Z |
| Tasks | 3 completed |
| Files modified | 6 |
| Files created | 2 (PLAN + SUMMARY) |
| New REST endpoints | 0 (existing GET /api/form-leads gained a filter) |
| New DB columns | 0 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Backend filters leads by formId | ✅ Pass (by wiring) | `formId` added to Zod input, storage filter, and type assertion. Composes with existing filters via AND. |
| AC-2: Leads UI scopes list and badges rows | ✅ Pass (by wiring) | New `<Select>` (conditional on `hasMultipleForms`); filter state drives queryKey + URL param; row shows outline badge with form name; detail sheet shows "Form: {name}" badge |
| AC-3: Dashboard metrics scope by form | ✅ Pass (by wiring) | `selectedFormId` state drives single leads useQuery; all downstream `dashboardData` derivations (totals, funnel, qualification, completion, recentLeads) already feed off `leadsList`, so scoping is one-point |
| AC-4: Zero regression for single-form operators | ✅ Pass (by wiring) | `hasMultipleForms` guard hides selector in both sections and row/detail badges; single-form workspace renders identically to pre-M3-04 |
| AC-5: `npm run check` + `npm run build` pass | ✅ Pass | Both clean. One intermediate `npm run check` failure (duplicate translation key) caught by qualify and fixed within task 2 |

## Accomplishments

- Completed the last user-visible slice of Milestone 3 before cleanup: admin can now operate on two independent form funnels without cross-contamination
- Zero-regression delivery: `hasMultipleForms` gate means existing single-form installations see no new UI at all — selectors hidden, badges suppressed
- Reused server infrastructure: `countLeadsForForm` / `form_id` column / `/api/forms` endpoint were all laid down in M3-01/M3-02, so this plan is almost entirely thin UI wiring + one 3-line backend filter
- Self-corrected during qualify: the duplicate `'All forms'` translation key (already registered in M3-02) was caught by `npm run check` and resolved in the same task without user intervention

## Files Created / Modified

| File | Change | Purpose |
|------|--------|---------|
| `shared/routes.ts` | Modified | `api.formLeads.list.input` Zod object gains `formId: z.coerce.number().int().positive().optional()` |
| `server/storage.ts` | Modified | `IStorage.listFormLeads` + `DatabaseStorage.listFormLeads` accept optional `formId`; pushes `eq(formLeads.formId, …)` into conditions when set |
| `server/routes/company.ts` | Modified | Local `filters` type assertion in the `GET /api/form-leads` handler gains `formId?: number` (route body itself is unchanged — Zod output now carries the field through) |
| `client/src/components/admin/LeadsSection.tsx` | Modified | `Form` type import; `filters.formId` state; `/api/forms` useQuery; `activeForms` + `formsById` + `hasMultipleForms` derivations; conditional form `<Select>`; form id included in leads queryKey + URL params; outline badge next to classification in each row; "Form: {name}" badge in detail sheet (both suppressed single-form); TODO comment on legacy `/api/form-config` fetch pointing to M3-05 |
| `client/src/components/admin/DashboardSection.tsx` | Modified | `useState` + `Form` + `Select*` imports; `selectedFormId` state; `/api/forms` useQuery + `activeForms` + `hasMultipleForms`; existing leads useQuery's queryKey/queryFn scoped by selectedFormId; conditional `<Select>` rendered above top-card grid |
| `client/src/lib/translations.ts` | Modified | Added PT keys `'Form' → 'Formulário'` and `'Form:' → 'Formulário:'` under new "M3-04" comment block |
| `.paul/phases/m3-04-leads-scoping/04-01-PLAN.md` | Created | PAUL plan doc |
| `.paul/phases/m3-04-leads-scoping/04-01-SUMMARY.md` | Created | This file |
| `.paul/STATE.md` | Modified | Milestone progress tracking |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Suppress selector + badges when `activeForms.length ≤ 1` | AC-4 demands zero visual regression for single-form operators; without this gate, the dropdown would show "All forms / Default" — visual noise with no function | Establishes reusable `hasMultipleForms` pattern for any future form-scoped admin UI |
| Keep `/api/form-config` fetch in LeadsSection unchanged for now | Detail-sheet question labels still read default-form config; rewiring per-form is M3-05 work (part of legacy-endpoint removal) and would expand this plan's scope | Small TODO comment added; no behavior change; M3-05 already planned to handle it |
| Filter on `formId` (numeric) not `formSlug` | Admin UI already has `Form[]` with ids from `/api/forms`; no extra lookup needed; slug filter would be redundant plumbing | Keeps backend Zod input flat; public surfaces (which prefer slug) are separate and out of scope |
| Badge variant `outline` for both row and detail-sheet form markers | Matches existing secondary-meta pattern (GHL sync badge uses colored border; status uses solid; form name is meta info, not status) | Visual hierarchy preserved; no competition with classification badge |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Minor — translation key collision caught by qualify |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** Plan executed essentially as written. One self-corrected qualify error.

### Auto-fixed Issues

**1. Translation key `'All forms'` already registered (TypeScript error)**
- **Found during:** Task 2 qualify (`npm run check`)
- **Issue:** Plan proposed adding `'All forms' → 'Todos os formulários'` PT key under an "M3-04" block; M3-02 had already added the same key (line 124 of translations.ts, used by the FormsSection "All forms" filter). Also `'Form: {name}'` was added speculatively but the code just renders the form name directly.
- **Fix:** Removed duplicate `'All forms'` key and trimmed `'Form: {name}'` to just `'Form:'` (the detail-sheet badge reads `Form: {formsById.get(...)?.name}` — the name is passed through literally, only the "Form:" prefix needs translation).
- **Files:** `client/src/lib/translations.ts`
- **Verification:** Re-ran `npm run check` → clean on second attempt

### Deferred Items

None — plan executed cleanly.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Translation key collision (see Auto-fixed #1) | Resolved in same qualify loop |

## Next Phase Readiness

**Ready:**
- M3-05 (Cleanup) can now safely remove `/api/form-config` + `POST /api/form-leads/progress` + the legacy single-form `company_settings.formConfig` column — no admin UI reads them except the one TODO-marked spot in LeadsSection (detail-sheet question labels), which M3-05 is already scoped to rewire to per-form config
- `hasMultipleForms` gate pattern is established for any future per-form admin UI (e.g. per-form analytics drilldown)
- `countLeadsForForm` storage method is still unused by admin UI — a future enhancement could display per-form lead counts inside the form selector dropdown, but that is not scoped to M3

**Concerns:**
- `LeadsSection.tsx` grew to ~570 lines (was 533); still under the 600-line `.tsx` ceiling from M2 decisions, but worth keeping an eye on when M3-05 rewires the detail-sheet question labels
- The Dashboard form selector lives above the top-card grid. If future work adds other top-level filters (date range, rep, etc.), we'll want a dedicated filter bar

**Blockers:**
- None. Ready for `/paul:plan` on M3-05 (legacy cleanup).

---
*Phase: m3-04-leads-scoping, Plan: 04-01*
*Completed: 2026-04-15*
