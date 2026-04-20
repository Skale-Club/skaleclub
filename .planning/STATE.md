---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Links Page Upgrade
status: executing
last_updated: "2026-04-19T00:00:00.000Z"
last_activity: "2026-04-19 — Plan 12-01 shipped: admin Links Page three-zone layout + visibility Switch + click-count badge (LINKS-07 layout, LINKS-10 complete)"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 6
  completed_plans: 5
---

# STATE: Skale Club Web Platform

**Created:** 2026-03-30
**Status:** v1.3 in progress — Phase 11 shipped, Phase 12 next

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-20)

**Core value:** Admin manages a rich Linktree-style page with real file uploads, per-link icons, click analytics, and a live-preview editor.
**Current focus:** Phase 12 — Admin Redesign + Core Editing (Plan 12-01 shipped; 12-02 next)

---

## Current Position

Phase: 12 — Admin Redesign + Core Editing (plans 1/3 complete)
Plan: 12-02 (uploaders) next
Status: Plan 12-01 shipped — three-zone admin layout (Profile | Live Preview placeholder | Main Links) + per-link Visible Switch + click-count Badge + Background Image URL input + 24 PT translation keys; tsc + build green
Last activity: 2026-04-19 — Plan 12-01 shipped: admin Links Page three-zone layout + visibility Switch + click-count badge (LINKS-07 layout, LINKS-10 complete)

---

## Performance Metrics

### v1.0 — Xpot Tech Debt (shipped 2026-03-30)

| Metric | Value |
|--------|-------|
| Requirements | 18/18 complete |
| Phases completed | 4/4 |
| Plans executed | 10 |
| Files changed | 64 |
| Lines added/removed | +9,106 / -1,763 |
| Phase 06-db-schema-storage-layer P01 | 3 | 2 tasks | 2 files |
| Phase 08-admin-ui-estimatessection P01 | 114s | 2 tasks | 1 files |
| Phase 08-admin-ui-estimatessection P02 | 8 | 3 tasks | 3 files |
| Phase 09-public-viewer P02 | 130 | 2 tasks | 2 files |
| Phase 09-public-viewer P03 | 12 | 1 tasks | 1 files |
| Phase 10-schema-upload-foundation P02 | 3m | 3 tasks | 3 files |

### v1.1 — Multi-Forms Support (shipped 2026-04-15)

| Metric | Value |
|--------|-------|
| Sub-phases | 5 (M3-01 → M3-05) |
| Plans executed | 6 (tracked in `.paul/phases/m3-*`) |
| Lines added/removed | ~+3,400 / -700 |
| Prod DB verified | forms=1, form_leads=14 (all form_id=1) |

### v1.3 — Links Page Upgrade (in progress)

| Metric | Value |
|--------|-------|
| Requirements | 17 total, 17/17 mapped |
| Phases planned | 5 (Phases 10-14) |
| Phases completed | 2/5 (Phases 10 + 11) |
| Plans executed | 4 |
| Phase 10-schema-upload-foundation P01 | ~25m | 3 tasks | 3 files |
| Phase 10-schema-upload-foundation P02 | ~3m | 3 tasks | 3 files |
| Phase 11-click-analytics-api P01 | ~10m | 3 tasks | 4 files |
| Phase 12-admin-redesign-core-editing P01 | ~12m | 2 tasks | 2 files |

---

## Accumulated Context

### Decisions Made

- ✅ Surgical refactoring — all API contracts preserved (v1.0)
- ✅ GeoContext for shared geoState — resolved useState isolation bug (v1.0)
- ✅ Barrel re-export pattern — zero consumer changes for schema split (v1.0)
- ✅ express-async-errors — lightweight async error catching (v1.0)
- ✅ `/f/:slug` route (not `?form=` param) — cleaner shareable public form URL (v1.1)
- ✅ `hasMultipleForms` gate — single-form workspaces see no UI change (v1.1)
- ✅ Soft-delete (archive) for forms with leads — default form always protected (v1.1)
- ✅ `form_slug` on `chat_settings` — chat AI resolves form via `resolveChatForm()` (v1.1)
- ✅ Supabase session pooler (port 5432) for migrations — avoids SQLSTATE 42P05 (v1.1)
- [Phase 06-db-schema-storage-layer]: JSONB snapshot for estimates services — NOT FK to portfolio_services; editing catalog never mutates sent proposals (v1.2)
- [Phase 06-db-schema-storage-layer]: Manual Zod insert schema for estimates (not drizzle-zod) — follows portfolioServices convention in cms.ts (v1.2)
- [Phase 08-admin-ui-estimatessection]: EstimatesSection.tsx co-locates all three components (SortableServiceRow, EstimateDialogForm, EstimatesSection) in one file — consistent with PortfolioSection pattern
- [Phase 08-admin-ui-estimatessection]: Both slug maps in Admin.tsx must be updated simultaneously — partial update causes TypeScript errors from Record<AdminSection,string> exhaustiveness check
- [Phase 09-01]: Plain text access code (D-07) — codes not bcrypt-hashed; GHL automation must read and inject them into links
- [Phase 09-01]: Raw SQL migration pattern (tsx script) — drizzle-kit push cannot resolve .js ESM imports in CJS bundle; follows Phase 6.2 convention
- [Phase 09-02]: isEstimateRoute isolated branch in App.tsx: structural isolation (no Navbar/Footer/ChatWidget) for /e/* routes
- [Phase 09-02]: isUnlocked=false default works for non-gated estimates: gate condition (data.hasAccessCode && !isUnlocked) is false when hasAccessCode=false
- [Phase 09-03]: No new npm dependencies for view badges — formatDistanceToNow and Eye already in date-fns and lucide-react
- [Phase 09-03]: viewCount ?? 0 fallback ensures badge always visible for new estimates (not hidden when 0)
- [Phase 10-01]: Use z.input<> (not z.infer<>) for exported LinksPageLink/LinksPageConfig TS types so pre-Phase-12 client code still compiles after schema gains .transform()-powered id field
- [Phase 10-01]: Per-link new fields are Zod .optional() rather than .default() — runtime defaults guaranteed by normalizeLinksPageConfig on every read, keeping the TS output type lenient for the v1.3 migration window
- [Phase 10-01]: Lazy UUID backfill on read + transform-on-write = zero-migration rollout for additive JSONB shape change (no SQL, no data script)
- [Phase 10-01]: Theme defaults hard-coded to current visual state (#1C53A3 / #0f1014) so legacy rows look identical after normalization
- [Phase 10-02]: Base64-JSON upload (not multipart) for /api/uploads/links-page — keeps single admin upload code path; 2 MB cap fits trivially under 50 MB Express body limit
- [Phase 10-02]: Path uses {timestamp}-{randomUUID} (not content hash) for v1.3 — matches existing uploadBuffer convention; idempotency-by-content-hash deferred
- [Phase 10-02]: Pre-flight 503 env guard (Xpot leads precedent) before deep getSupabaseAdmin throw — clearer error in misconfigured envs
- [Phase 10-02]: Defensive data-URL prefix strip (data:image/png;base64,...) — accepts both raw base64 and full data URLs from clients
- [Phase 11-01]: Return 204 (not 429) on rate-limit so navigator.sendBeacon does not surface a console error on the public /links page
- [Phase 11-01]: In-memory Map rate limit accepted for v1.3 — per-process (Vercel); duplicate counts across function containers tolerable for analytics
- [Phase 11-01]: Admin click-count badge UI deferred to Phase 12; LINKS-05 shipped as data-surface contract (normalizer guarantee) not as rendered UI
- [Phase 11-01]: Array.from(map.entries()) instead of for..of over Map — tsconfig has no target/downlevelIteration flags, so direct Map iteration hits TS2802 (scoped fix preferred over global tsconfig change)
- [Phase 12-01]: AdminCard + FormGrid primitives swapped in for Card/CardHeader/CardContent — establishes three-zone admin layout pattern (Profile | Preview | Links) via grid-cols-1 md:grid-cols-2 lg:grid-cols-12 with md:col-span-2 lg:col-span-4 cells
- [Phase 12-01]: Radix Switch bound to link.visible with `!== false` guard — reuses existing updateLink → saveSettings → PUT /api/company-settings path; no new save endpoint, no new state machine
- [Phase 12-01]: Avatar URL + Background Image URL kept as plain Inputs with `TODO(12-02)` markers — Plan 12-02 swaps to DragDropUploader; layout ships functional in the meantime
- [Phase 12-01]: PT translations added proactively (24 new keys) even though JSX strings still hardcoded English — satisfies CLAUDE.md translation rule now so future t() wrap is zero-touch on the translation side
- [Phase 12-01]: addLink does NOT set visible:true explicitly — lets server normalizer (Phase 10) stamp the default; UI reads `link.visible !== false` so new rows render as visible without a client-side write

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260419-rfo | Add EST-11 view tracking and EST-12 password protection requirements | 2026-04-19 | c6fa749 | [260419-rfo](./quick/260419-rfo-add-est-11-view-tracking-and-est-12-pass/) |

### Blockers

None.

---

## Session Continuity

| Session | Action | Result |
|---------|--------|--------|
| 2026-03-30 | v1.0 complete | started v1.1 planning |
| 2026-04-14/15 | v1.1 M3 complete (tracked in PAUL) | GSD synced 2026-04-19 |
| 2026-04-19 | GSD retroactive sync | ready for `/gsd:new-milestone` |
| 2026-04-19 | v1.2 milestone initialized | REQUIREMENTS.md + PROJECT.md created, Phase 6 ready to plan |
| 2026-04-20 | v1.3 milestone initialized | Defining requirements for Links Page Upgrade |
| 2026-04-20 | v1.3 roadmap created | 5 phases (10-14), 17/17 reqs mapped, Phase 10 ready to plan |
| 2026-04-19 | Plan 10-01 executed | Schema + normalizer shipped (3 tasks, 3 commits); 10-02 next |
| 2026-04-20 | Plan 10-02 executed | Upload endpoint live (3 tasks, 3 commits: 7ebdaf4, 86ae880, 0e744f9); Phase 10 plans 2/2 — ready for /gsd:verify-work |
| 2026-04-19 | Plan 11-01 executed | Click endpoint live (3 tasks, 3 commits: f7e3fb9, 72ede6e, 2900a80); Phase 11 plans 1/1 — ready for /gsd:verify-work |
| 2026-04-19 | Plan 12-01 executed | Admin three-zone layout + Visible Switch + click-count Badge (2 tasks, 2 commits: 6091c1d, f5cc862); Phase 12 plans 1/3 — 12-02 next |

---

*Last updated: 2026-04-19 — Plan 12-01 complete (admin redesign layout + visibility toggle); Phase 12 plans 1/3 — 12-02 (uploaders) next*
