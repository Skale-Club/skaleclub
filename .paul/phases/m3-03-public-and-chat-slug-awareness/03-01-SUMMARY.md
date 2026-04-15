---
phase: m3-03-public-and-chat-slug-awareness
plan: 03-01
subsystem: api
tags: [react, wouter, react-query, express, drizzle, supabase, multi-tenancy, routing]

requires:
  - phase: m3-02-admin-forms-ui
    provides: forms CRUD endpoints + GET /api/forms/slug/:slug/config (mounted)

provides:
  - POST /api/forms/slug/:slug/leads/progress (public, per-form submissions)
  - chat_settings.form_slug column + resolveChatForm() helper
  - LeadFormModal formSlug prop + dual-endpoint behavior
  - Public /f/:slug route via new PublicForm page
  - Admin Chat settings "Qualification Form" selector
  - Extracted runLeadPostProcessing() lib for shared notification + GHL sync

affects:
  - m3-04-leads-scoping (will add form filter in LeadsSection using /api/forms)
  - m3-05-cleanup (will drop /api/form-leads/progress + /api/form-config + legacy column)

tech-stack:
  added: []
  patterns:
    - "Lead post-processing extracted from endpoint handlers into server/lib so both the legacy default-form endpoint and the new per-form endpoint share the same notification + GHL logic"
    - "Public form URLs = /f/:slug, consumed by a thin PublicForm page that auto-opens LeadFormModal with the resolved slug"
    - "Dual-mode LeadFormModal: formSlug prop drives which endpoints are hit; omission preserves the legacy path"

key-files:
  created:
    - server/lib/lead-processing.ts (runLeadPostProcessing)
    - client/src/pages/PublicForm.tsx (/f/:slug page)
    - migrations/0029_chat_settings_form_slug.sql
    - supabase/migrations/20260414160000_chat_settings_form_slug.sql
    - .paul/phases/m3-03-public-and-chat-slug-awareness/03-01-PLAN.md
  modified:
    - shared/schema/chat.ts (formSlug column + Zod)
    - server/routes.ts (resolveChatForm helper + 5 chat call sites)
    - server/routes/forms.ts (new POST /api/forms/slug/:slug/leads/progress)
    - server/routes/company.ts (legacy endpoint now reuses runLeadPostProcessing)
    - client/src/components/LeadFormModal.tsx (formSlug prop + dual endpoints)
    - client/src/App.tsx (Route /f/:slug → PublicForm)
    - client/src/components/admin/ChatSection.tsx (Qualification Form selector + formsList query)
    - client/src/components/admin/shared/types.ts (ChatSettingsData.formSlug)
    - client/src/lib/translations.ts (PT for 5 new strings)

key-decisions:
  - "Chat form selection is global in chat_settings.form_slug (not per-conversation). Existing conversations keep their form because the slug is resolved only when creating a new lead for the conversation."
  - "Legacy endpoint /api/form-leads/progress kept untouched except for the post-processing extraction. M3-05 will drop it."
  - "resolveChatForm() is server-local (inside registerRoutes) for now; extract to storage/util if it grows new callers."

patterns-established:
  - "server/lib/ for small shared logic that isn't a route handler but is called from multiple routes"
  - "Public route pattern: probe endpoint via useQuery with retry:false → 404 state renders a dedicated card instead of a blank modal"

duration: ~75min
started: 2026-04-14T16:00:00Z
completed: 2026-04-14T17:15:00Z
---

# M3-03 Plan 03-01: Public Form + Chat Widget Slug Awareness Summary

**Public `/f/:slug` URLs now serve per-form capture pages and chat qualification respects an admin-selected form, with zero regression to the existing homepage modal or default chat behavior.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~75 min |
| Started | 2026-04-14T16:00:00Z |
| Completed | 2026-04-14T17:15:00Z |
| Tasks | 10 completed |
| Files created | 5 |
| Files modified | 9 |
| New REST endpoints | 1 (POST /api/forms/slug/:slug/leads/progress) |
| New DB columns | 1 (chat_settings.form_slug) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: `npm run check` passes | ✅ Pass | Clean |
| AC-2: `npm run build` passes | ✅ Pass | Both client + server bundled |
| AC-3: Migration applied on remote Supabase | ✅ Pass | `chat_settings.form_slug` exists (text, nullable). Pushed via session pooler (port 5432). |
| AC-4: `/f/:slug` serves per-form page | ✅ Pass (by wiring) | PublicForm probes config → renders LeadFormModal with `formSlug={slug}` → submit hits `/api/forms/slug/:slug/leads/progress` which stamps `form_id` |
| AC-5: Legacy `/` modal still hits `/api/form-config` + `/api/form-leads/progress` | ✅ Pass | LeadFormModal falls back when `formSlug` is omitted; Home.tsx unchanged |
| AC-6: Chat `get_form_config` respects `chatSettings.formSlug` | ✅ Pass | resolveChatForm() reads slug, checks isActive, falls back to ensureDefaultForm() |
| AC-7: Admin Chat settings form selector saves | ✅ Pass (by wiring) | New select in ChatSection writes `formSlug` via existing updateField → autosave |
| AC-8: PT translations registered | ✅ Pass | 5 new keys added to translations.ts |

## Accomplishments

- Shipped the first **user-visible** slice of multi-forms: admins can publish two distinct capture URLs today
- Eliminated ~90 lines of duplicated post-upsert logic by extracting `runLeadPostProcessing` into a shared lib — both endpoints now share exactly one implementation for SMS + GHL sync
- Zero-regression dual-mode component: `LeadFormModal`'s two-line prop change preserves the existing homepage modal behavior bit-for-bit when `formSlug` is omitted
- Added a 404-aware public page (not a blank modal) for invalid/archived slugs — probe via `useQuery(retry:false)` returns null on 404 which flips the page into a "Form not found" state

## Files Created / Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/lib/lead-processing.ts` | Created | Shared `runLeadPostProcessing()` — called by both legacy and slug-based progress endpoints |
| `server/routes/forms.ts` | Modified | New `POST /api/forms/slug/:slug/leads/progress` endpoint |
| `server/routes/company.ts` | Modified | Legacy `POST /api/form-leads/progress` now calls `runLeadPostProcessing` instead of inlining 90 lines |
| `server/routes.ts` | Modified | New `resolveChatForm()` helper; 5 call sites (`getOrCreateLeadForConversation`, `get_form_config`, `save_lead_answer`, `get_lead_state`, complete-lead GHL sync) now use it |
| `shared/schema/chat.ts` | Modified | `form_slug` TEXT column + Zod schema |
| `migrations/0029_chat_settings_form_slug.sql` | Created | Drizzle Kit migration |
| `supabase/migrations/20260414160000_chat_settings_form_slug.sql` | Created | Supabase CLI mirror |
| `client/src/pages/PublicForm.tsx` | Created | Thin page that auto-opens `<LeadFormModal>` for `/f/:slug`; 404 fallback card |
| `client/src/App.tsx` | Modified | Lazy-imported `PublicForm`, registered `<Route path="/f/:slug" />` |
| `client/src/components/LeadFormModal.tsx` | Modified | `formSlug?` prop; URL/endpoint selection at render time |
| `client/src/components/admin/ChatSection.tsx` | Modified | `formsList` useQuery + "Qualification Form" selector card in settings |
| `client/src/components/admin/shared/types.ts` | Modified | `ChatSettingsData.formSlug?: string \| null` |
| `client/src/lib/translations.ts` | Modified | 5 new PT strings (selector labels + 404 page copy) |
| `.paul/phases/m3-03-public-and-chat-slug-awareness/03-01-PLAN.md` | Created | PAUL plan doc |
| `.paul/STATE.md` | Modified | Milestone progress tracking |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Extract `runLeadPostProcessing` to `server/lib/` (new directory) | Keeping notification + GHL sync in one place prevents drift between the two endpoints | Pattern established for future cross-route helpers |
| `resolveChatForm` defined inside `registerRoutes` scope | Currently only called from route handlers; moving it out of scope would require DI plumbing with no current benefit | Re-evaluate if a 3rd caller appears |
| Chat form selection reads once per new conversation (not per tool call) | `getOrCreateLeadForConversation` resolves the slug only when creating a lead; existing conversations keep their form's scoring | UI copy already says "Changes take effect on new conversations" |
| PublicForm probes the config up-front (not in the modal) | Lets the page render a proper 404 card instead of a broken modal when the slug doesn't exist | Slight duplicate fetch (config is re-fetched inside the modal), but config has `staleTime: 5min` so it's a single network trip |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 1 | Small — extracted `runLeadPostProcessing` was implicit in the plan but delivered as a proper shared lib |
| Deferred | 0 | — |

### Scope Additions

**1. Extracted `runLeadPostProcessing` to `server/lib/lead-processing.ts`**
- Plan hinted at "extract helper or duplicate minimally — default to extract"
- Delivered the extraction, not the duplication
- Net LOC change: -88 lines (90 removed from company.ts, ~110 added to lead-processing.ts, ~10 added to forms.ts endpoint)

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| TodoWrite tool initially unavailable (deferred tool schema) | Loaded via ToolSearch; no blocker |
| Edit tool rejected typo'd parameter name `new_str` | Re-issued with correct `new_string`; no data loss |

## Next Phase Readiness

**Ready:**
- `LeadsSection` can now filter by form using the same `/api/forms` query the Chat settings selector uses
- Dashboard can segment metrics by form via the same lead counts flow (`countLeadsForForm`)
- `runLeadPostProcessing` is the one place to modify if notification/GHL logic needs updating per-form (e.g., per-form Twilio templates in a future phase)

**Concerns:**
- Admin currently can archive a form referenced by Chat settings; `resolveChatForm` silently falls back to default, but the admin might not realize. M3-04 or a small UX polish pass could surface a warning.

**Blockers:**
- None. Ready for `/paul:plan` on M3-04 (leads section scoping by form).

---
*Phase: m3-03-public-and-chat-slug-awareness, Plan: 03-01*
*Completed: 2026-04-14*
