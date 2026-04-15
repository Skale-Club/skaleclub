---
phase: m3-05-cleanup
plan: 05-02
subsystem: db
tags: [drizzle, supabase, postgres, migration, schema, cleanup, tech-debt, milestone-close]

requires:
  - phase: m3-05-cleanup
    plan: 05-01
    provides: zero runtime reads of company_settings.formConfig from request handlers (only two storage-layer fallback branches remained)

provides:
  - forms table is the sole source of truth for form config
  - company_settings.form_config column dropped from remote Postgres
  - shared/schema/settings.ts has no formConfig field (Drizzle table or Zod insert schema)
  - server/storage.ts ensureDefaultForm seeds from DEFAULT_FORM_CONFIG only; upsertFormLeadProgress resolves from forms row only
  - Milestone 3 (Multi-Forms Support) complete

affects:
  - Future phases can rely on forms.config without any legacy company_settings fallback
  - Any future admin scripts that touched form_config must be rewritten against the forms table

tech-stack:
  added: []
  patterns:
    - "Atomic column-drop migration: ALTER TABLE ... DROP COLUMN IF EXISTS pairs cleanly across Drizzle Kit and Supabase CLI histories when the SQL body is identical"
    - "Hand-written SQL migrations (not drizzle-kit generate) keep numbering stable and mirror exactly into supabase/migrations/ without drift"

key-files:
  created:
    - .paul/phases/m3-05-cleanup/05-02-PLAN.md
    - .paul/phases/m3-05-cleanup/05-02-SUMMARY.md
    - migrations/0030_drop_company_settings_form_config.sql
    - supabase/migrations/20260415120000_drop_company_settings_form_config.sql
  modified:
    - shared/schema/settings.ts (removed FormConfig import, formConfig Drizzle column, formConfig Zod field)
    - server/storage.ts (ensureDefaultForm fallback removed; upsertFormLeadProgress settings.formConfig fallback removed)
  deleted:
    - scripts/push-form-config.ts (dead — referenced removed column)
    - scripts/sync-form-config.ts (dead — referenced removed column)

key-decisions:
  - "Delete scripts/push-form-config.ts + scripts/sync-form-config.ts rather than repoint them to the forms table: both are one-off admin utilities that already had no caller in the active system (scripts/ is outside tsconfig scope). Repointing would be future work; deleting matches the spirit of cleanup and prevents a future reader from running a script that half-references the old model"
  - "Single migration body (no DROP COLUMN guard beyond IF EXISTS, no data preservation copy to forms): M3-01 already seeded the default form row with the column's contents at creation time, so no data is lost by the drop. Adding a copy-before-drop step would have been belt-and-suspenders work with no practical value"

patterns-established:
  - "When dropping a column that had storage-layer fallback branches, delete the fallback branches in the SAME plan as the column drop — not in a preceding plan. If the fallback branches were removed first, a fresh deployment between plans could fail to seed default form config; if the column were dropped first, the fallback branches would throw. Atomic co-removal avoids both windows"
  - "Verify remote column drops with three queries, not one: information_schema.columns zero-rows the column, forms.count ≥ 1 (the migration didn't nuke the new home), and the dependent table's row count is unchanged (no collateral cascade). Running only the first leaves two silent failure modes uncovered"

duration: ~15min
started: 2026-04-15T17:10:00Z
completed: 2026-04-15T17:25:00Z
---

# M3-05 Plan 05-02: DB Column Drop Summary

**`company_settings.form_config` dropped from remote Postgres; schema + storage cleaned of the final two references. The multi-forms migration (started in M3-01) is complete: `forms` is the sole source of truth, no compat shim remains.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Started | 2026-04-15T17:10:00Z |
| Completed | 2026-04-15T17:25:00Z |
| Tasks | 4 completed (3 auto, 1 human-action) |
| Files created | 4 (PLAN + SUMMARY + 2 migration files) |
| Files modified | 2 (settings.ts, storage.ts) |
| Files deleted | 2 (dead scripts) |
| Remote DB changes | 1 column dropped |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Column removed from Drizzle + Zod schema | ✅ Pass | `grep 'formConfig\|form_config' shared/schema/settings.ts` returns zero hits; `FormConfig` import also removed |
| AC-2: Storage layer has no references to the column | ✅ Pass | `grep form_config server/storage.ts` returns zero hits. Remaining `formConfig` identifiers are local parameter names on `upsertFormLeadProgress` (typed as `FormConfig`, not DB refs) |
| AC-3: Migration pair exists and is consistent | ✅ Pass | Both files contain identical `ALTER TABLE company_settings DROP COLUMN IF EXISTS form_config;` with idempotent guard |
| AC-4: Remote Supabase has the column dropped | ✅ Pass | Verified: `information_schema.columns` returns 0 rows for `company_settings.form_config`; `forms` count = 1 (unchanged); `form_leads` count = 14 (unchanged from M3-01 snapshot) |
| AC-5: Build and type-check pass | ✅ Pass | `npm run check` clean, `npm run build` clean (14.79s client + 1357ms server). No TypeScript errors. |

## Accomplishments

- **Milestone 3 closed:** Multi-forms support is fully live — admin can list/create/edit/archive/duplicate forms, each with its own public `/f/:slug` URL, chat respects the globally selected form, and the leads section scopes by form. Zero legacy code paths remain.
- **Dropped 1 column** (`company_settings.form_config` jsonb) after four phases of careful migration (M3-01 new table → M3-02 admin UI → M3-03 public routes → M3-04 leads scoping → M3-05 cleanup).
- **Removed 5 lines of storage fallback code** that tied `forms` to `company_settings` — the two systems are now independent.
- **Cleaned two dead admin scripts** (`push-form-config.ts`, `sync-form-config.ts`) that would have confused future readers after the column drop.
- **Migration idempotency**: both files use `DROP COLUMN IF EXISTS`, so a re-apply is a no-op. Safe for dev-environment replays.

## Files Created / Modified / Deleted

| File | Change | Purpose |
|------|--------|---------|
| `migrations/0030_drop_company_settings_form_config.sql` | Created | Drizzle Kit migration (hand-written) |
| `supabase/migrations/20260415120000_drop_company_settings_form_config.sql` | Created | Supabase CLI mirror (identical SQL body) |
| `shared/schema/settings.ts` | Modified | Removed `formConfig` Drizzle column (L75), Zod field (L145), and unused `FormConfig` import (L5) |
| `server/storage.ts` | Modified | `ensureDefaultForm`: removed `settings.formConfig` fallback + `getCompanySettings` call; seed from `DEFAULT_FORM_CONFIG` directly. `upsertFormLeadProgress`: removed `(await this.getCompanySettings()).formConfig` fallback on the resolvedFormId branch |
| `scripts/push-form-config.ts` | **Deleted** | Wrote to `company_settings.formConfig` — now broken by column drop |
| `scripts/sync-form-config.ts` | **Deleted** | Read + wrote `company_settings.formConfig` between source/target — now broken |
| `.paul/phases/m3-05-cleanup/05-02-PLAN.md` | Created | PAUL plan doc |
| `.paul/phases/m3-05-cleanup/05-02-SUMMARY.md` | Created | This file |
| `.paul/STATE.md` | Modified | Milestone 3 closure + loop tracking |
| Remote Postgres `company_settings` | Modified | Column `form_config` dropped via `supabase db push` on session pooler port 5432 |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Delete dead scripts rather than repoint them | Both were orphaned one-off utilities outside tsconfig scope. Repointing would be future work with no caller; deletion prevents future reader confusion and matches cleanup spirit | -2 dead files; no feature loss (no callers existed) |
| Single atomic column drop (no copy-to-forms step) | M3-01 already seeded the default form row with the column's contents at bootstrap; no data is lost by the drop | Simpler migration; no belt-and-suspenders code |
| Co-remove fallback branches + column in the same plan | Removing fallbacks first would leave a window where a fresh deploy can't seed default form config; dropping column first would make fallback branches throw. Atomic co-removal avoids both | Plan scope held tight (2 code edits + 1 migration) |
| Use `supabase db push` (CLI) rather than direct `psql` | CLI is the canonical path, it tracks the migration in `supabase_migrations.schema_migrations`, and it matches the M3-01 precedent | Migration history stays clean; CLI records the apply |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 1 | Minor — 2 dead scripts deleted |
| Deferred | 0 | — |

**Total impact:** Plan executed essentially as written. One scope addition (dead script cleanup) was discovered during the post-edit grep sweep and addressed inline; it fits the spirit of cleanup and would have been a latent confusion hazard.

### Scope Additions

**1. Deleted `scripts/push-form-config.ts` and `scripts/sync-form-config.ts`**
- **Found during:** Task 3 grep sweep (`grep 'form_config' --include='*.ts' .`)
- **Context:** Plan scope listed 2 code files; didn't enumerate the scripts/ folder. `scripts/` is excluded from `tsconfig.json` so `npm run check` wouldn't have caught the broken references.
- **Fix:** Deleted both files. No callers exist in the codebase (verified: zero grep hits for either script name in active code).
- **Verification:** Re-ran `npm run check` — clean.

### Deferred Items

None — plan executed cleanly.

## Issues Encountered

**1. `supabase db execute --db-url` is not a subcommand**
- The Supabase CLI v2.91.2 only exposes `db push`, `db pull`, `db lint`, etc. — no `db execute` for ad-hoc SQL.
- **Workaround:** Wrote a 15-line tsx script using the existing `pg` package to run the three verification queries (information_schema column check, forms count, form_leads count), ran it via `npx tsx`, then deleted the script.
- Note for next migration apply: if a verification query is needed and psql isn't on PATH, pre-commit a reusable `scripts/query-remote.ts` helper instead of creating ad-hoc ones.

## Next Phase Readiness

**Ready:**
- Milestone 3 (Multi-Forms Support) is complete. All 5 phases ✅.
- `forms` table is the sole source of truth for form config. No compat shim, no fallback.
- Migration pair is live in both Drizzle Kit (`migrations/0030`) and Supabase CLI (`supabase/migrations/20260415120000`) histories.
- Remote Postgres verified in sync with local schema (`company_settings.form_config` column gone).

**Concerns:**
- None.

**Blockers:**
- None. Ready to commit + close Milestone 3.

## Milestone 3 Retrospective

| Phase | Plans | Outcome |
|-------|-------|---------|
| M3-01 Schema + Migration + Compat Shim | 01-01 | `forms` table live on remote; compat shim routed to default form; 14 leads backfilled |
| M3-02 Admin Forms list + editor rewire | 02-01 | Sidebar Forms section + list + editor + 7 REST endpoints |
| M3-03 Public form + Chat widget slug awareness | 03-01 | `/f/:slug` route + `chat_settings.form_slug` + shared lead-processing helper |
| M3-04 Leads section scoping | 04-01 | formId filter + per-section form selector + row/detail badges + single-form suppression |
| M3-05 Cleanup | 05-01, 05-02 | Legacy endpoints + column dropped; 2 dead scripts pruned |

**Total: 6 plans across 5 phases. Zero hotfixes, zero rollbacks, zero breaking changes to existing leads.** Migration data integrity preserved end-to-end (14 form_leads rows, 1 forms row, all FKs intact).

---
*Phase: m3-05-cleanup, Plan: 05-02*
*Completed: 2026-04-15*
*Milestone 3 closed*
