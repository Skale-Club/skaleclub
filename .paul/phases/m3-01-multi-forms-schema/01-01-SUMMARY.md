---
phase: m3-01-multi-forms-schema
plan: 01-01
subsystem: database
tags: [drizzle, postgres, supabase, migration, multi-tenancy, zod]

requires:
  - phase: milestone-2-design
    provides: AdminCard / SectionHeader primitives used later in M3-02 UI

provides:
  - forms table (multi-form data model)
  - form_id FK on form_leads
  - 11 storage methods for form CRUD
  - compat shim: legacy /api/form-config + chat tool sites route to default form

affects:
  - m3-02-admin-forms-ui (will expose CRUD via new admin section)
  - m3-03-public-and-chat-slug-awareness (will pick forms by slug instead of default)
  - m3-04-leads-scoping (will filter leads by formId)
  - m3-05-cleanup (will drop legacy formConfig column + compat endpoints)

tech-stack:
  added: []
  patterns:
    - "Dual migration format: Drizzle Kit (migrations/NNNN_*.sql) + Supabase CLI (supabase/migrations/YYYYMMDDHHMMSS_*.sql)"
    - "Idempotent migrations via IF NOT EXISTS + guarded INSERTs"
    - "Partial unique index for single-default invariant (WHERE is_default = TRUE)"
    - "Compat shim pattern: legacy endpoints resolve to default entity via ensureDefaultX()"

key-files:
  created:
    - shared/schema/forms.ts (forms table + Zod schemas + types)
    - migrations/0028_multi_forms.sql
    - supabase/migrations/20260414140000_multi_forms.sql
    - .paul/phases/m3-01-multi-forms-schema/01-01-PLAN.md
  modified:
    - server/storage.ts (11 new form methods + upsertFormLeadProgress accepts formId)
    - server/routes/company.ts (GET/PUT /api/form-config + POST /api/form-leads/progress route to default form)
    - server/routes.ts (4 chat tool sites route to default form)

key-decisions:
  - "Use session pooler (port 5432) for supabase db push, not transaction pooler (port 6543) — pgBouncer rejects prepared statements"
  - "form_id stays nullable for one release window; tightened to NOT NULL in M3-05 after all entry points set it explicitly"
  - "Migration is self-sufficient: seeds default form from company_settings.form_config; app ensureDefaultForm() handles the fresh-install edge case"

patterns-established:
  - "ensureDefaultX() storage method pattern for auto-provisioning singletons on first access"
  - "Mirror every DB migration to both migrations/ and supabase/migrations/"

duration: ~90min
started: 2026-04-14T13:00:00Z
completed: 2026-04-14T14:30:00Z
---

# M3-01 Plan 01-01: Multi-Forms Schema + Compat Shim Summary

**Forms table + form_id FK shipped to production Supabase; all legacy endpoints and chat tool calls now route through the default form via compat shim, with zero visible UX change.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~90 min |
| Started | 2026-04-14T13:00:00Z |
| Completed | 2026-04-14T14:30:00Z |
| Tasks | 8 completed |
| Files modified | 5 |
| Files created | 4 |
| Migrations applied | 1 (remote Supabase) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: `npm run check` passes | ✅ Pass | Clean TypeScript compile, no errors |
| AC-2: `npm run build` passes | ✅ Pass | Client + server bundled successfully |
| AC-3: `forms` table exists with 1 row (slug="default", is_default=true) | ✅ Pass | Verified via pg query on remote: 13 questions seeded from legacy `company_settings.form_config` |
| AC-4: All existing `form_leads` have `form_id = defaultForm.id` | ✅ Pass | 14 leads, all with `form_id=1`, 0 orphans |
| AC-5: Admin form editor saves without error (writes to default form) | ✅ Pass (by wiring) | `PUT /api/form-config` now calls `storage.updateForm(defaultForm.id, ...)` |
| AC-6: Public form submission creates lead with `form_id = defaultForm.id` | ✅ Pass (by wiring) | `POST /api/form-leads/progress` passes `formId: defaultForm.id` to upsert |
| AC-7: Chat qualification flow still works | ✅ Pass (by wiring) | 4 tool sites (`get_form_config`, `save_lead_answer`, `get_lead_state`, GHL sync) all use `ensureDefaultForm()` |

## Accomplishments

- Landed a production-grade multi-tenancy foundation (forms table + FK) without downtime and without touching the frontend
- Preserved 14 existing leads by backfilling them to the seeded default form
- Established a reusable compat-shim pattern (`ensureDefaultForm()`) that makes the follow-on phases incremental and reversible
- Dual migration format (Drizzle Kit + Supabase CLI) discovered a real gotcha: pgBouncer transaction pooler (port 6543) rejects `supabase db push`'s prepared statements — documented with fix in STATE.md

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `shared/schema/forms.ts` | Modified | Added `forms` table (slug, name, is_default, is_active, config) + `formId` FK on `form_leads` + Zod schemas `insertFormSchema`/`updateFormSchema` + types `Form`/`InsertForm`/`InsertFormInput`/`UpdateFormInput` |
| `migrations/0028_multi_forms.sql` | Created | Drizzle Kit migration: create table, seed default, backfill form_id |
| `supabase/migrations/20260414140000_multi_forms.sql` | Created | Mirrored Supabase CLI migration |
| `server/storage.ts` | Modified | 11 new form storage methods + `upsertFormLeadProgress` accepts `metadata.formId` and falls back to default |
| `server/routes/company.ts` | Modified | `GET/PUT /api/form-config` and `POST /api/form-leads/progress` now route through default form via `ensureDefaultForm()` |
| `server/routes.ts` | Modified | 4 chat tool sites (`get_form_config`, `save_lead_answer`, `get_lead_state`, complete-lead GHL sync) + `getOrCreateLeadForConversation` all resolve to default form |
| `.paul/phases/m3-01-multi-forms-schema/01-01-PLAN.md` | Created | PAUL plan doc |
| `.paul/STATE.md` | Modified | Milestone 3 tracking, decisions locked, loop position |
| `.planning/phases/05-multi-forms/PLAN.md` | Created (earlier) | Full 5-phase plan for the whole milestone |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Session pooler (port 5432) for migrations, not transaction pooler (6543) | `supabase db push` uses prepared statements; pgBouncer in transaction mode rejects them with SQLSTATE 42P05 | Documented in STATE.md; applies to every future migration |
| `form_id` nullable for now, NOT NULL in M3-05 | Keeps migration non-blocking even on edge-case installs where `company_settings.form_config` was never populated; `ensureDefaultForm()` handles the gap | Safe rollout; tighter constraint comes after M3-02 wires up all entry points |
| Writes to legacy `company_settings.form_config` removed entirely in compat shim | Keeping both in sync would be error-prone; `ensureDefaultForm()` reads from `company_settings` as a *seed* source only | 4 chat call sites had to migrate off `settings.formConfig` in the same commit (otherwise they'd go stale after first PUT) |
| `softDeleteForm` throws if target is default | Prevents orphaning the fallback; admins must set a new default before archiving the old one | UX: M3-02 "Archive" action only enabled when `is_default=false` |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Minor — chat sites needed migrating off legacy settings reference |
| Scope additions | 1 | Small — added `setDefaultForm` and `countLeadsForForm` (11 methods vs 9 planned) |
| Deferred | 0 | — |

### Auto-fixed Issues

**1. Chat tool sites were still reading from `settings.formConfig`**
- **Found during:** Compat shim wiring (task 7)
- **Issue:** `PUT /api/form-config` now writes only to the default form, so the 4 chat tool sites (`get_form_config`, `save_lead_answer`, `get_lead_state`, complete-lead GHL sync) would read stale data from `company_settings.form_config` after the first admin save
- **Fix:** Migrated all 4 sites to use `await storage.ensureDefaultForm()` and read `defaultForm.config`
- **Files:** `server/routes.ts` (~4 edits)
- **Verification:** `grep 'settings?\.formConfig' server/` returns only the reference *inside* `ensureDefaultForm` itself (intentional — seed fallback)
- **Commit:** will be part of plan commit

### Scope Additions

**1. `setDefaultForm` and `countLeadsForForm` added**
- Planned: 9 storage methods. Delivered: 11.
- Added `setDefaultForm(id)` — needed for M3-02 "Set as default" action (transactional swap).
- Added `countLeadsForForm(formId)` — needed for M3-02 Forms list to show lead counts, and for hard-delete gate in M3-05.
- Both are pre-wiring for Phase 2 with zero current caller but cheap to add now.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `supabase db push` failed with `prepared statement "lrupsc_1_0" already exists (SQLSTATE 42P05)` on port 6543 (transaction pooler) | Swapped to port 5432 (session pooler) on the same host; migration applied cleanly. Documented in STATE.md Decisions Log |
| `ls` of `.paul/paul.json` and `.paul/SPECIAL-FLOWS.md` during unify — neither exists | Pre-v1.1 PAUL project; skipped both steps per workflow spec |

## Next Phase Readiness

**Ready:**
- Forms CRUD storage methods ready for M3-02 admin endpoints (`GET/POST/PUT/DELETE /api/forms`, `POST /api/forms/:id/duplicate`)
- `setDefaultForm` and `countLeadsForForm` pre-wired for M3-02 UI needs
- `FormEditorContent` component already standalone — M3-02 just needs to pass `formId` as a prop and change the save endpoint from `/api/form-config` to `/api/forms/:id`

**Concerns:**
- `form_id` remains nullable until M3-05; any new code path that creates a form lead MUST pass a `formId` or rely on `ensureDefaultForm()` fallback. Watch for any new entry points added in M3-02/03 that skip this.
- Legacy `company_settings.form_config` column still exists. Reading it is currently guarded inside `ensureDefaultForm()` only — do NOT reintroduce other reads.

**Blockers:**
- None. Ready for `/paul:plan` on M3-02.

---
*Phase: m3-01-multi-forms-schema, Plan: 01-01*
*Completed: 2026-04-14*
