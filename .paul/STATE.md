# State — Milestone 3: Multi-Forms Support

**Current phase:** M3-05 — Cleanup (legacy endpoints + column drop)
**Current plan:** 05-01 ✅ Complete (code-only rewire + endpoint deletes)
**Next action:** `/paul:plan` for M3-05 plan 05-02 (DB column drop: `company_settings.formConfig` + migration pair + remove storage fallback branches + apply to remote Supabase)
**Last activity:** 2026-04-15 — M3-05 plan 05-01 UNIFY complete. SUMMARY written. Loop closed.
**Resume file:** `.paul/phases/m3-05-cleanup/05-01-SUMMARY.md`

---

## Loop Position

```
┌─────────────────────────────────────┐
│  PLAN ──▶ APPLY ──▶ UNIFY          │
│   ✓        ✓        ✓               │  [05-01 loop complete — 05-02 is next plan in phase]
└─────────────────────────────────────┘
```

---

## Position

| Milestone | Phase | Status |
|-----------|-------|--------|
| 1 — Xpot Hardening | 1–6 | ✅ Complete |
| 2 — Design + Structural Refactor | 1–9 | ✅ Complete (file splits deferred) |
| 3 — Multi-Forms Support | 1 — Schema + Migration + Compat Shim | ✅ Complete (migration live on remote Supabase) |
| 3 — Multi-Forms Support | 2 — Admin Forms list + editor rewire | ✅ Complete (sidebar section + list + editor + 7 REST endpoints) |
| 3 — Multi-Forms Support | 3 — Public form + Chat widget slug awareness | ✅ Complete (/f/:slug route + chat_settings.form_slug + shared lead-processing helper) |
| 3 — Multi-Forms Support | 4 — Leads section scoping | ✅ Complete (formId filter + per-section form selector + row/detail badges + single-form suppression) |
| 3 — Multi-Forms Support | 5 — Cleanup (drop legacy column + endpoints) | 🔄 In progress — 05-01 ✅ code rewire + endpoint deletes complete, 05-02 pending (DB column drop) |

---

## Phase M3-01 Progress

- ✅ Drizzle schema: `forms` table + `formId` FK on `form_leads`
- ✅ Migration `migrations/0028_multi_forms.sql` (Drizzle Kit)
- ✅ Migration `supabase/migrations/20260414140000_multi_forms.sql` (Supabase CLI mirror)
- ✅ Zod schemas + types (`Form`, `InsertForm`, `insertFormSchema`, `updateFormSchema`)
- ✅ Storage methods (11): `listForms`, `getForm`, `getFormBySlug`, `getDefaultForm`, `ensureDefaultForm`, `createForm`, `updateForm`, `softDeleteForm`, `duplicateForm`, `setDefaultForm`, `countLeadsForForm`
- ✅ `upsertFormLeadProgress` accepts `formId` with fallback to default form
- ✅ Compat shim: `/api/form-config` (GET/PUT), `/api/form-leads/progress`, and all 4 chat tool sites (`get_form_config`, `save_lead_answer`, `get_lead_state`, GHL sync) route to default form
- ✅ Verification: `npm run check` (clean), `npm run build` (green), migration pushed to remote via `supabase db push` (session pooler port 5432). DB state: `forms` has 1 row (slug="default", 13 questions seeded), `form_leads` has 14 rows all with `form_id` = 1, 0 orphans

---

## Decisions Locked (for Milestone 3)

| Decision | Phase impacted |
|----------|----------------|
| Forms = top-level admin sidebar section | M3-02 |
| Public URL: `/f/:slug` dedicated route | M3-03 |
| Chat picks form globally in Chat settings | M3-03 |
| Delete form with leads → soft-delete (archive) | M3-02 |
| GHL field collisions across forms → allowed with UI hint | M3-02 |

---

## Previous Milestones (summary)

### Milestone 2 — Design + Structural Refactor ✅

- Neutral charcoal dark theme (was bluish slate)
- Alpha hairline border token (was slate-200/slate-700 solid)
- 10 shadcn base components audited and token-clean
- 51 harsh border occurrences across 13 files converted to soft token
- Global `<SectionHeader>` + `<AdminCard>` + `<EmptyState>` + `<FormGrid>` primitives
- Duplicate section-level headers removed from 11 admin sections
- Memory rules saved (translations, borders, design system)

### Deferred from Milestone 2

| Item | Reason |
|------|--------|
| Content pages border sweep | User instructed to skip |
| Split `server/routes.ts` (3490 lines) | Deferred |
| Split `server/storage.ts` (1599 lines) | Deferred |
| Split `IntegrationsSection.tsx` (1688) | Deferred |
| Split `LeadsSection.tsx` (1270) | Deferred |
| Split `BlogSection.tsx` (1087) | Deferred |
| Split `ChatSection.tsx` (966) | Deferred |
| Unify primary color hex values | Deferred |

---

## Blockers

None.

---

## Decisions Log

| Decision | Made in | Rationale |
|----------|---------|-----------|
| Start Milestone 3 (Multi-Forms) after M2 close | 2026-04-14 | User requested the ability to have multiple forms |
| Forms = new top-level admin section | 2026-04-14 | Decision locked from draft plan recommendations |
| Public form URL = `/f/:slug` | 2026-04-14 | Cleaner shareable URL than query param |
| Chat form selection = global in Chat settings | 2026-04-14 | Simpler v1; per-URL rules can come later |
| Delete form with leads = soft-delete | 2026-04-14 | Preserves lead history; hard delete only if empty |
| GHL field collisions allowed across forms | 2026-04-14 | Latest write wins on contact; rare in practice |
| Mirror migrations to both `migrations/` and `supabase/migrations/` | 2026-04-14 | Project tracks both Drizzle Kit and Supabase CLI histories |
| Use session pooler (port 5432) for `supabase db push`, not transaction pooler (port 6543) | 2026-04-14 | Transaction pooler rejects prepared statements (SQLSTATE 42P05). POSTGRES_URL uses 6543 for runtime; swap to 5432 for migrations |
| Borders always hairline alpha, never solid black/white | 2026-04-14 | Past M2 decision, still in force |
| Max file size: 600 lines for `.tsx` | 2026-04-14 | Past M2 decision, still in force |
