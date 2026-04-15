---
phase: m3-05-cleanup
plan: 05-01
subsystem: api
tags: [react, express, zod, multi-tenancy, cleanup, tech-debt]

requires:
  - phase: m3-04-leads-scoping
    provides: admin Leads detail-sheet already form-aware (TODO comment marked /api/form-config for this plan)
  - phase: m3-03-public-and-chat-slug-awareness
    provides: /api/forms/slug/:slug/config + /api/forms/slug/:slug/leads/progress (the replacement endpoints)

provides:
  - client never calls /api/form-config or /api/form-leads/progress
  - GET /api/form-config, PUT /api/form-config, POST /api/form-leads/progress removed from server
  - shared/routes.ts formLeads.progress contract entry removed
  - LeadFormModal signature tightened (formSlug required)
  - FormEditorContent signature tightened (formId required)
  - "Edit Form" sheet in LeadsSection removed (Forms section owns editing)

affects:
  - m3-05-cleanup plan 05-02 (DB column drop) — now safe: zero runtime code writes to `company_settings.formConfig`

tech-stack:
  added: []
  patterns:
    - "Per-lead config resolution: `getConfigForLead(lead)` reads `formsById.get(lead.formId)?.config` with DEFAULT_FORM_CONFIG fallback — keeps admin UI functional even if a lead's form row is missing/archived without triggering a global fetch"
    - "Single-entry-point form editing: one route to edit a form (Forms section → FormEditorContent with formId), eliminating the Leads section's parallel 'Edit Form' sheet that shared the same component"

key-files:
  created:
    - .paul/phases/m3-05-cleanup/05-01-PLAN.md
    - .paul/phases/m3-05-cleanup/05-01-SUMMARY.md
  modified:
    - client/src/components/LeadFormModal.tsx (formSlug required; ternaries on configUrl/progressUrl removed)
    - client/src/pages/Home.tsx (formSlug="default")
    - client/src/pages/Portfolio.tsx (formSlug="default")
    - client/src/components/admin/LeadsSection.tsx (removed /api/form-config query + Edit Form sheet; added per-lead getConfigForLead + selectedLeadQuestions)
    - client/src/components/admin/leads/FormEditorContent.tsx (formId required; no more legacy fallback)
    - server/routes/company.ts (deleted 3 legacy handlers + pruned imports)
    - shared/routes.ts (removed formLeads.progress entry + formLeadProgressSchema import)
    - server/lib/lead-processing.ts (stale header comment refreshed)
    - server/routes/forms.ts (stale comment above slug-progress endpoint refreshed)

key-decisions:
  - "Remove 'Edit Form' button from Leads section rather than deep-link to Forms: Forms owns editing since M3-02; deep-link would just add a click; removal matches the plan's scope-limit ('pure removal')"
  - "Refresh two stale comments that referenced the now-deleted endpoint names: scope limit said 'left historical comments alone' but those comments would have misled future readers into thinking the endpoints still exist — 2-line edit, fits the spirit of cleanup"

patterns-established:
  - "When removing compat-shim endpoints, also purge their contract entries (shared/routes.ts), unused imports, and stale comments — the grep of the removed URL string should return zero hits in .ts/.tsx"
  - "For admin UI lists that were reading global config: migrate to per-row resolution via `formsById` (populated from /api/forms) + a local getter function; lets each row render against its own form's schema without an extra request"

duration: ~20min
started: 2026-04-15T16:30:00Z
completed: 2026-04-15T16:50:00Z
---

# M3-05 Plan 05-01: Legacy Endpoint Cleanup Summary

**All runtime references to `/api/form-config` and `/api/form-leads/progress` removed from client and server; legacy Express routes deleted; `company_settings.formConfig` column is now unreferenced by code paths — ready for 05-02 to drop the column.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~20 min |
| Started | 2026-04-15T16:30:00Z |
| Completed | 2026-04-15T16:50:00Z |
| Tasks | 3 completed (all DONE, all qualify PASS first attempt) |
| Files modified | 9 (7 planned + 2 stale-comment refreshes) |
| Files created | 2 (PLAN + SUMMARY) |
| Endpoints deleted | 3 (`GET`/`PUT /api/form-config`, `POST /api/form-leads/progress`) |
| New REST endpoints | 0 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Legacy endpoints removed from server | ✅ Pass | `GET/PUT /api/form-config` and `POST /api/form-leads/progress` deleted from `server/routes/company.ts`; grep confirms zero code references in `*.ts/*.tsx` |
| AC-2: Public marketing pages submit via slug endpoint | ✅ Pass (by wiring) | Home.tsx and Portfolio.tsx pass `formSlug="default"`; LeadFormModal's ternary removed — only slug-scoped URLs are ever constructed |
| AC-3: Admin Leads detail sheet uses scoped form config | ✅ Pass (by wiring) | New `getConfigForLead(lead)` + `selectedLeadQuestions` memo + per-lead `questionLabel`; `/api/form-config` query deleted; `DEFAULT_FORM_CONFIG` remains as safety fallback if a lead's form row is archived/missing |
| AC-4: FormEditorContent is form-scoped only | ✅ Pass | `formId: number` now required in `FormEditorContentProps`; only call site (`FormsSection.tsx:392`) already passes it; "Edit Form" sheet in LeadsSection removed |
| AC-5: `npm run check` + `npm run build` pass | ✅ Pass | Both clean. Build output 14.79s. Zero TypeScript errors. |

## Accomplishments

- Closed the M3 compat-shim chapter: the multi-forms migration is now the sole code path — no more "if formSlug, else legacy" branches anywhere in the request flow
- Removed three Express handlers totaling ~130 lines of now-dead normalization + compat-shim logic (`GET /api/form-config`'s 110-line question-merge block was the biggest single removal)
- Tightened two TypeScript signatures (`LeadFormModal.formSlug`, `FormEditorContent.formId`) from optional to required — the compiler now enforces what runtime already assumed
- Eliminated a redundant entry point: "Edit Form" button in Leads section removed (Forms section is the sole editor since M3-02), reducing UX surface area and the parallel-code risk

## Files Created / Modified

| File | Change | Purpose |
|------|--------|---------|
| `client/src/components/LeadFormModal.tsx` | Modified | `formSlug: string` (required); configUrl/progressUrl always slug-scoped; 6-line JSDoc comment removed |
| `client/src/pages/Home.tsx` | Modified | `<LeadFormModal ... formSlug="default" />` |
| `client/src/pages/Portfolio.tsx` | Modified | `<LeadFormModal ... formSlug="default" />` |
| `client/src/components/admin/LeadsSection.tsx` | Modified | Deleted `/api/form-config` useQuery; deleted global `questionsForDisplay`/`totalQuestions`; added `getConfigForLead`, `getQuestionsForLead`, `selectedLeadQuestions`; per-lead `questionLabel`; removed "Edit Form" Sheet block, `isFormEditorOpen` state, `Pencil`/Sheet\*/FormEditorContent imports |
| `client/src/components/admin/leads/FormEditorContent.tsx` | Modified | `formId: number` required; single `/api/forms/${formId}` endpoint on GET and PUT; JSDoc trimmed |
| `server/routes/company.ts` | Modified | Deleted 3 handlers + "Form Config" section comment; pruned 6 unused imports (`formLeadProgressSchema`, `FormConfig`, `DEFAULT_FORM_CONFIG`, `calculateMaxScore`, `getSortedQuestions`, `runLeadPostProcessing`) |
| `shared/routes.ts` | Modified | Removed `formLeads.progress` contract entry; removed `formLeadProgressSchema` from schema.js import |
| `server/lib/lead-processing.ts` | Modified | Refreshed stale header comment mentioning the removed endpoint |
| `server/routes/forms.ts` | Modified | Refreshed stale "Mirrors `POST /api/form-leads/progress`" comment above slug-progress endpoint |
| `.paul/phases/m3-05-cleanup/05-01-PLAN.md` | Created | PAUL plan doc |
| `.paul/phases/m3-05-cleanup/05-01-SUMMARY.md` | Created | This file |
| `.paul/STATE.md` | Modified | Milestone + loop progress tracking |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Remove "Edit Form" button from Leads section entirely (not deep-link to Forms) | Forms section has owned form editing since M3-02; deep-link adds a click without value; plan's scope-limit explicitly said "pure removal, no UX additions" | Single editing entry point; LeadsSection trims 15 lines + 5 unused imports |
| Refresh two stale comments that named the deleted endpoints | Plan originally said "leave historical comments alone," but those two comments were narrative headers that would mislead future readers — a 2-line touch-up costs nothing and prevents wrong-premise fixes later | Minor scope addition; documented in Deviations below |
| Keep `DEFAULT_FORM_CONFIG` fallback inside `getConfigForLead` | Even after column drop in 05-02, a lead could reference an archived or future-deleted form row. DEFAULT_FORM_CONFIG lets the detail sheet render question labels instead of crashing. | Resilience for pathological admin cases; zero cost |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 1 | Minor — 2-line comment refresh in 2 files |
| Deferred | 0 | — |

**Total impact:** Plan executed essentially as written. The one addition is cleanup of stale comments that pointed at now-deleted endpoints — within the spirit of the plan (legacy-reference purge) but outside its explicit file list.

### Scope Additions

**1. Stale comment refreshes in `server/lib/lead-processing.ts` and `server/routes/forms.ts`**
- **Found during:** Task 2 grep verification (`grep '/api/form-config\|/api/form-leads/progress'`)
- **Context:** Plan's scope-limits explicitly said the historical comment at `lead-processing.ts:3` "can stay — it's documentation." But the comment described the old two-endpoint reality ("Both `POST /api/form-leads/progress` ... and `POST /api/forms/:slug/leads/progress` ..."); with the legacy gone, the comment would claim an endpoint that doesn't exist. Same issue at `forms.ts:210` ("Mirrors `POST /api/form-leads/progress`").
- **Fix:** Rewrote both comments to reflect the current single-endpoint reality (slug-scoped endpoint is the sole public entry point).
- **Files:** `server/lib/lead-processing.ts`, `server/routes/forms.ts`
- **Verification:** Re-grep returned zero hits in `*.ts/*.tsx`; `npm run check` + `npm run build` re-run clean.

### Deferred Items

None — plan executed cleanly.

## Issues Encountered

None. All three tasks passed qualify on first attempt. No TypeScript errors on either `npm run check` run.

## Next Phase Readiness

**Ready:**
- 05-02 (DB column drop) can proceed unconditionally: `grep 'formConfig' server/storage.ts` still shows the two fallback branches (`ensureDefaultForm` seed at line 900-902, `upsertFormLeadProgress` fallback at line 1051) — both read `company_settings.formConfig` and must be removed together with the migration that drops the column. 05-02's scope is tight: one migration pair + two fallback-branch deletes.
- `hasMultipleForms` pattern + per-lead config resolution pattern both established for any future per-form admin UI work (analytics, exports, etc.)
- No TypeScript type reexports or dead shared-schema entries left behind

**Concerns:**
- `server/storage.ts` still has two branches that read `company_settings.formConfig`. If anything boots the app between this plan and 05-02 and the `forms` table gets wiped, `ensureDefaultForm` will still seed from the legacy column. Low risk (forms table has one durable row on remote Supabase), but 05-02 should not be indefinitely delayed.
- Comment in `.paul/STATE.md` M3-01 Progress section still reads "Compat shim: `/api/form-config` (GET/PUT), `/api/form-leads/progress`, and all 4 chat tool sites ... route to default form" — historically accurate for M3-01, so I left it, but a future reader might confuse it with current state. STATE.md evolution would naturally overwrite it during next milestone.

**Blockers:**
- None. Ready for `/paul:plan` on 05-02 (DB column drop + migration pair + remote Supabase apply).

---
*Phase: m3-05-cleanup, Plan: 05-01*
*Completed: 2026-04-15*
