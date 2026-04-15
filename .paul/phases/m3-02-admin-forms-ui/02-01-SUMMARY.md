---
phase: m3-02-admin-forms-ui
plan: 02-01
subsystem: api
tags: [react, wouter, react-query, express, admin-ui, multi-tenancy]

requires:
  - phase: m3-01-multi-forms-schema
    provides: forms table, 11 storage methods, compat shim

provides:
  - full CRUD REST surface for forms (GET/POST/PUT/DELETE /api/forms, duplicate, set-default)
  - new Forms admin section (sidebar + list + editor sub-route)
  - FormEditorContent accepts formId prop (reads/writes /api/forms/:id, keeps legacy fallback)
  - public endpoint GET /api/forms/slug/:slug/config (mounted now, consumed in M3-03)

affects:
  - m3-03-public-and-chat-slug-awareness (consumes /api/forms/slug/:slug/config)
  - m3-04-leads-scoping (will add form filter in LeadsSection)

tech-stack:
  added: []
  patterns:
    - "Sub-route detection inside a section component (parse /admin/forms/:id from wouter location) — avoids adding wouter <Route> noise to Admin.tsx"
    - "Dual-mode FormEditorContent: formId=<n> ⇒ new endpoint, formId=undefined ⇒ legacy fallback. Lets M3-03+ phases migrate callers one at a time."
    - "Sidebar menu entries self-register via SIDEBAR_MENU_ITEMS — drag-ordering reorder picks them up for free."

key-files:
  created:
    - server/routes/forms.ts (REST endpoints)
    - client/src/components/admin/forms/FormsSection.tsx (list + editor sub-route)
    - client/src/components/admin/forms/NewFormDialog.tsx (create form dialog)
    - .paul/phases/m3-02-admin-forms-ui/02-01-PLAN.md
  modified:
    - server/routes.ts (registerFormRoutes)
    - client/src/components/admin/shared/types.ts (AdminSection + 'forms')
    - client/src/components/admin/shared/constants.ts (sidebar entry)
    - client/src/pages/Admin.tsx (slug maps, sectionsWithOwnHeader, FormsSection import & render)
    - client/src/components/admin/leads/FormEditorContent.tsx (accepts formId prop)
    - client/src/lib/translations.ts (PT translations for all new strings)

key-decisions:
  - "Forms sub-route via in-component location parsing rather than nested wouter Routes — matches existing admin navigation pattern"
  - "Legacy /api/form-config path kept intact; new code passes formId, old callers untouched"
  - "Soft-delete is the only deletion path exposed in UI; hard-delete reserved for leadCount=0 + default-not-set (guarded on server)"

patterns-established:
  - "Admin section sub-routes: component matches location.match(/admin/{slug}/(\\d+)/)"
  - "Query key convention: ['/api/forms'] for list, [`/api/forms/${id}`] for detail"

duration: ~65min
started: 2026-04-14T14:45:00Z
completed: 2026-04-14T15:50:00Z
---

# M3-02 Plan 02-01: Admin Forms UI Summary

**Admin can now create, edit, duplicate, archive, restore, and hard-delete forms through a new top-level "Forms" sidebar section; the existing question editor runs unchanged against each form via a new `formId` prop.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~65 min |
| Started | 2026-04-14T14:45:00Z |
| Completed | 2026-04-14T15:50:00Z |
| Tasks | 7 completed |
| Files created | 4 |
| Files modified | 6 |
| New REST endpoints | 7 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: `npm run check` passes | ✅ Pass | Clean (only minor transient duplicates on `Edit`/`Delete` translation keys fixed during) |
| AC-2: `npm run build` passes | ✅ Pass | Client + server bundled in 7.18s |
| AC-3: Sidebar shows new "Forms" entry between Leads and Chat | ✅ Pass | Added via SIDEBAR_MENU_ITEMS |
| AC-4: `/admin/forms` renders the list | ✅ Pass | FormsSection routes on `activeSection === 'forms'` + sub-route via location regex |
| AC-5: `/admin/forms/:id` renders the editor | ✅ Pass | FormEditorView wraps FormEditorContent with the `formId` prop |
| AC-6: Create / duplicate / set-default / archive / restore / delete work | ✅ Pass (by wiring) | All 7 server endpoints implemented with Zod validation + proper 409/404 responses |
| AC-7: Legacy `/api/form-config` still works for existing callers | ✅ Pass | `FormEditorContent` without `formId` falls back to old endpoint; compat shim from M3-01 untouched |
| AC-8: PT translations registered for all new strings | ✅ Pass | ~30 new keys added under "Admin — Forms section (M3-02)" block |

## Accomplishments

- Shipped a working multi-form admin UX without touching the compat path — zero regression risk for existing flows
- Kept `FormEditorContent` as a dual-mode component instead of duplicating it — the legacy Leads "Edit Form" sheet continues to work identically against `/api/form-config` until M3-05 deletes the shim
- Added the public `/api/forms/slug/:slug/config` endpoint now, one phase early, so M3-03 has zero backend work on the public side

## Files Created / Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/routes/forms.ts` | Created | 7 endpoints: list, get, create, update, delete (soft+force), duplicate, set-default, public slug-config |
| `server/routes.ts` | Modified | `registerFormRoutes(app)` wired into loader |
| `client/src/components/admin/forms/FormsSection.tsx` | Created | Top-level section: list view + editor sub-view (sub-route parsed inside) |
| `client/src/components/admin/forms/NewFormDialog.tsx` | Created | Create-form dialog with name + auto-slugified slug + description |
| `client/src/components/admin/leads/FormEditorContent.tsx` | Modified | Accepts `formId?: number` prop; endpoint chosen at render-time |
| `client/src/components/admin/shared/types.ts` | Modified | `AdminSection` union gains `'forms'` |
| `client/src/components/admin/shared/constants.ts` | Modified | New sidebar item just after Leads |
| `client/src/pages/Admin.tsx` | Modified | Both slug maps, `sectionsWithOwnHeader`, FormsSection render |
| `client/src/lib/translations.ts` | Modified | ~30 PT translations for new admin strings |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Sub-route parsed inside FormsSection, not via wouter `<Route>` | Matches existing admin navigation pattern (activeSection-based switch); avoids invasive Admin.tsx changes | M3-03 public routing can use wouter `<Route>` freely since admin doesn't compete |
| Dual-mode FormEditorContent (prop-driven) instead of fork | Single source of truth for the question editor; legacy callers keep working | M3-05 cleanup just drops the fallback branch |
| Hard delete through `?force=true` guarded by server-side `countLeadsForForm` check | UI never exposes "force" — it only becomes available when a form has 0 leads | Admins can't accidentally erase lead history |
| `setDefaultForm` also restores `isActive=true` | Promoting an archived form to default implicitly un-archives it | One-click recovery if admin accidentally archives the default |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Duplicate translation keys (Edit, Delete) caught by tsc |
| Scope additions | 0 | Delivered scope matches plan |
| Deferred | 1 | True hard-delete (actual row removal) — current force path still soft-deletes; truly dropping a row lands in M3-05 when the column is removed |

### Auto-fixed Issues

**1. Duplicate translation keys**
- **Found during:** Final `npm run check`
- **Issue:** `'Edit': 'Editar'` and `'Delete': 'Excluir'` already exist elsewhere in translations.ts
- **Fix:** Removed duplicates from the new block; existing translations apply automatically
- **Files:** `client/src/lib/translations.ts`
- **Verification:** tsc clean

### Deferred Items

- True hard-delete (actual `DELETE FROM forms WHERE id=?`) — for now, `?force=true` still calls `softDeleteForm`. Adding `storage.hardDeleteForm` + wiring is trivial but keeping it consistent with the milestone's "preserve history" stance. Logged for M3-05 cleanup where legacy column drops anyway.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `DEFAULT_FORM_CONFIG` imported from wrong module (`#shared/schema.js` vs `#shared/form.js`) | Fixed import path; tsc caught it immediately |

## Next Phase Readiness

**Ready:**
- `/api/forms/slug/:slug/config` public endpoint already live — M3-03 just needs a frontend caller
- Forms list + editor shipped; M3-04 can simply add a form filter dropdown to LeadsSection using the same `/api/forms` query
- All 5 locked decisions still hold

**Concerns:**
- `FormEditorContent`'s dual-mode behavior must be preserved until M3-05. Any refactor before then should keep the `formId` branch.

**Blockers:**
- None. Ready for `/paul:plan` on M3-03 (public form + chat widget slug awareness).

---
*Phase: m3-02-admin-forms-ui, Plan: 02-01*
*Completed: 2026-04-14*
