# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.8 — Notification Templates System

**Shipped:** 2026-05-04
**Phases:** 3 (Phases 31–33) | **Plans:** 6 | **Sessions:** 1 (single-day sprint)

### What Was Built

- `notification_templates` table (one row per event × channel pair), `dispatchNotification(storage, eventKey, vars)` dispatcher with `{{variable}}` substitution replacing 4 hardcoded Twilio call sites
- `telegram_settings` singleton table, `sendTelegramMessage()` via native fetch to Telegram Bot API with `parse_mode: "Markdown"`
- GET/PUT/test routes for Telegram integration settings; `TelegramSection` admin component in Communications tab
- `GET /api/notifications/templates` + `PUT /api/notifications/templates/:id` routes; `NotificationsSection.tsx` — 3-event cards × 2-channel rows with per-row draft state, active toggle, variable badge clipboard copy
- Admin sidebar and router wired for new `notifications` section; Supabase migrations applied via `npx supabase db push`

### What Worked

- **Dispatcher pattern completely decoupled callers from channel logic** — routes.ts and lead-processing.ts simply call `dispatchNotification(storage, eventKey, vars)` and never touch Twilio/Telegram directly; adding a third channel in the future touches only notifications.ts
- **CONTEXT.md decisions resolved pitfalls before planning** — `chatId as TEXT` (overflow), `parse_mode: "Markdown"` vs MarkdownV2 (escaping), `notifyOnNewChat` guard at call site (not dispatcher) — all decided before the planner ran, resulting in zero deviations
- **Supabase CLI `db push` established as preferred migration path** — faster and more reliable than the tsx script runner; migration history repair documented for future de-sync scenarios
- **Phase 32 gap closure inline** — verifier found admin UI missing from Phase 32 scope; closed inline in under 5 minutes rather than spinning up a full gap cycle (TelegramSection was ~130 lines)

### What Was Inefficient

- **Worktree merge conflicts on STATE.md/ROADMAP.md** — same friction as v1.2; parallel executor agents always produce these conflicts on planning docs
- **Migration history de-sync** — remote Supabase had 13 migrations not tracked in local history; required `supabase migration repair --status applied` before push could run; this should have been maintained throughout v1.0–v1.7
- **sectionsWithOwnHeader correction** — CONTEXT.md incorrectly placed it in `AdminSidebar.tsx`; researcher caught the error; researcher read step before planning is essential for wiring phases

### Patterns Established

- **`dispatchNotification(storage, eventKey, vars)` as the single notification entry point** — any new event type adds: (1) seed row in notification_templates, (2) call site in routes/lead-processing, (3) Phase 33 admin panel surfaces it automatically
- **Supabase migrations via `npx supabase db push`** — create files in `supabase/migrations/` with timestamp naming; use `migration repair --status applied` to re-sync stale history before push
- **Per-row `Record<number, boolean>` saving state** — prevents 6+ Save buttons from all disabling when one fires; reuse for any admin panel with multiple independently-saveable rows
- **Inline gap closure for small UI gaps** — if verification finds a UI gap that's < 150 LOC and fully self-contained, close it inline rather than creating a gap plan; saves overhead for trivial fixes

### Key Lessons

1. **Maintain Supabase migration history from day one** — `supabase db push` failing due to de-sync is predictable friction; run `migration list` after each milestone to catch drift early
2. **sectionsWithOwnHeader is in Admin.tsx, not AdminSidebar.tsx** — this has now been corrected twice; capture as a known gotcha in the next codebase map update
3. **Dispatcher guards at call site, not inside dispatcher** — `notifyOnNewChat` belongs where the event is triggered (routes.ts), not inside `dispatchNotification`; the dispatcher is channel-agnostic and event-agnostic by design

### Cost Observations

- Model mix: Sonnet 4.6 throughout
- 3 phases, 6 plans, 40 commits in a single session
- Notable: plan checker passed on first attempt for all plans; CONTEXT.md + researcher combination eliminated all ambiguity before execution agents ran

---

## Milestone: v1.5 — Blog Post Automation

**Shipped:** 2026-04-24
**Phases:** 4 (Phases 21–24) | **Plans:** 6 | **Sessions:** 1 (single-day sprint)

### What Was Built

- `blog_settings` singleton + `blog_generation_jobs` event-log tables with typed Drizzle/Zod schemas and IStorage stubs
- `BlogGenerator.generate()` with deterministic skip gates (no-settings, disabled, cadence, locked) and guarded singleton DB lock
- Full Gemini pipeline: topic → structured JSON draft → optional feature image → Supabase Storage upload → `blog_posts` draft row
- Four REST endpoints + hourly in-process cron with Vercel guard
- `BlogAutomationPanel` co-located in `BlogSection.tsx` — 5 settings fields, Generate Now with spinner/toast, `lastRunAt` status bar, Posts/Automation tab strip

### What Worked

- **Executable test harness pattern** — Phase 22 used injectable dependency hooks to verify skip/lock/pipeline behavior without live DB or Gemini credentials; caught a subtle lazy-import bug before execution
- **Single-day delivery cadence** — all 4 phases planned and executed in one session; clear phase dependencies (schema → engine → API → UI) meant no blocking
- **Feature-image as non-blocking side-effect** — Phase 22 decision to degrade to `featureImageUrl: null` on image failure avoided a hard dependency on Gemini's image quota

### What Was Inefficient

- **MILESTONES.md accomplishments left blank by CLI** — `gsd-tools milestone complete` extracted 0 accomplishments because SUMMARY.md one-liners weren't in the expected YAML format; required manual fill-in at completion time
- **Archived ROADMAP.md was unmodified copy** — CLI wrote the pre-collapse ROADMAP to `v1.5-ROADMAP.md`; the original still needed manual reorganization and cleanup of stale v1.4 inline phase details

### Patterns Established

- **Dedicated AI singleton per subsystem** — `server/lib/blog-gemini.ts` (Gemini for blog) + `server/lib/anthropic.ts` (Claude for presentations) = no provider-shim interference between features
- **Literal routes before parameterized wildcards** — register `GET /api/blog/settings` before `GET /api/blog/:idOrSlug`; established pattern for any future sub-routes under existing parameterized endpoints
- **`setInterval` callback pattern for lazy DB init** — `BlogGenerator.generate()` called inside the callback, not at module load, so the executable spec can import the cron module without a live database

### Key Lessons

1. **Executable specs with injected dependencies are worth the setup cost** — Phase 22's injectable hooks caught two blocking bugs (eager DB import, test URL assertion) before execution agents ran, saving rework
2. **SUMMARY.md YAML must have a `one_liner` field for CLI extraction** — without it, `summary-extract` returns nothing and MILESTONES.md shows "(none recorded)"; either enforce the field in future PLANs or post-process at completion
3. **Route ordering is a deployment concern, not just a test concern** — the Express wildcard bug would have silently returned 404 in production; registering specific routes before parameterized routes should be a checklist item in API phase plans

### Cost Observations

- Model mix: Sonnet 4.6 throughout
- 4 phases, 6 plans executed in a single session
- Notable: all 6 plans had no deviation from spec (2 auto-fixed blocking issues across the milestone, both were import/env edge cases)

---

## Milestone: v1.2 — Estimates System

**Shipped:** 2026-04-20
**Phases:** 4 (Phases 6–9) | **Plans:** 8 | **Sessions:** 1

### What Was Built

- `estimates` table with JSONB service snapshot schema (immutable proposals), UUID slugs, typed Drizzle/Zod layer
- Six typed storage CRUD methods + PostgreSQL migration via raw SQL tsx script
- Five authenticated admin API endpoints + public slug lookup, plus view tracking + access code routes
- `EstimatesSection.tsx` — full admin component with dnd-kit reorder, catalog picker, custom rows, price override dialog
- Estimates tab wired into admin sidebar and dashboard routing
- `EstimateViewer.tsx` — 262-line fullscreen scroll-snap public viewer with IntersectionObserver nav dots, framer-motion animations, AccessCodeGate, view tracking (useRef dedup), graceful 404
- `isEstimateRoute` guard in App.tsx isolating `/e/*` from all site chrome

### What Worked

- **Wave-based parallel execution** — Plans 09-02 and 09-03 ran simultaneously with no conflicts (different files)
- **CONTEXT.md + RESEARCH.md → planner** pipeline eliminated ambiguity; executor agents rarely deviated from spec
- **Locked decisions in CONTEXT.md** correctly resolved REQUIREMENTS.md ambiguities (e.g., plain-text access code vs bcrypt) before execution — no mid-execution pivots
- **Raw SQL tsx migration pattern** (established in Phase 6.2) reused cleanly in Phase 9.1 without confusion
- **Plan checker caught nothing** — 3/3 iterations passed on first verification, indicating plan quality was high

### What Was Inefficient

- **Worktree merge conflicts** — parallel agents (isolation: worktree) created STATE.md and ROADMAP.md conflicts on merge that needed manual resolution 3 times. These are planning docs, not code — less painful than code conflicts but still friction.
- **SUMMARY.md one-liner extraction** — gsd-tools `summary-extract` didn't reliably parse all SUMMARY files (some lacked the expected YAML field); milestone CLI had to fall back to partial data.
- **db:push workaround** — drizzle-kit CJS/ESM incompatibility forced the tsx migration script pattern both in Phase 6 and Phase 9. Known limitation, but adds a manual step each time schema changes.

### Patterns Established

- **Raw SQL tsx migration script** — preferred over `db:push` for this project. Pattern: create `migrations/NNNN_description.sql` + `scripts/migrate-description.ts`, run with `tsx scripts/migrate-description.ts`. Idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- **Event-log table for tracking** — `estimate_views` (no counter column) enables queryable history, cascade delete, and avoids UPDATE contention. Reuse for any future "track X per record" requirement.
- **isEstimateRoute structural isolation** — returning early in App.tsx before the layout branch (not conditionally hiding components inside the layout) is the correct pattern for full-page isolation routes.
- **`useRef(false)` mutation dedup guard** — exact VCard.tsx pattern reused for view tracking. Single fire on mount, immune to re-renders and StrictMode double-invocation.
- **Plain-text access codes** — chosen for GHL automation readability. If bcrypt is ever needed, a separate `password_hash` column should be added rather than changing `access_code`.

### Key Lessons

1. **Parallel worktree agents need a merge step** — always budget time to resolve STATE.md/ROADMAP.md conflicts after parallel waves. These are low-severity (no logic, just counters and dates) but require judgment to pick the right side.
2. **CONTEXT.md decisions gate replaces REQUIREMENTS.md ambiguities** — when a REQUIREMENTS.md spec conflicts with a locked CONTEXT.md decision, the decision wins. Checkers should surface this as informational, not a blocker.
3. **Drizzle-kit is unusable for migrations in this project** — document this prominently in CLAUDE.md or project onboarding. The tsx script pattern is the only viable path until the CJS/ESM split is resolved upstream.

### Cost Observations

- Model mix: Sonnet 4.6 throughout (executor, planner, checker, verifier)
- All 4 phases planned and executed in a single session (~4 hours)
- Notable: plan checker passed on first attempt for all 3 plans — good CONTEXT.md + RESEARCH.md investment upstream

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Files | LOC+ | Duration |
|-----------|--------|-------|-------|------|----------|
| v1.0 Xpot Tech Debt | 4 | 10 | 64 | +9,106 | 1 session (2026-03-30) |
| v1.1 Multi-Forms | 5 sub-phases | 6 | ~40 | +3,400 | 2 sessions (2026-04-14/15) |
| v1.2 Estimates System | 4 | 8 | 62 | +10,263 | 1 session (2026-04-19/20) |
| v1.3 Links Page Upgrade | 5 | 10 | ~50 | ~+8,000 | 1 session (2026-04-20) |
| v1.4 Admin Presentations | 6 | 10 | ~55 | ~+9,000 | 2 sessions (2026-04-21/22) |
| v1.5 Blog Post Automation | 4 | 6 | 45 | +6,343 | 1 session (2026-04-22) |
| v1.6 Skale Hub Live Gate | 5 | 5 | ~45 | ~+5,000 | 1 session (2026-05-02) |
| v1.7 Translation Overhaul | 1 | 4 | ~30 | ~+2,000 | 1 session (2026-05-03) |
| v1.8 Notification Templates | 3 | 6 | 53 | +5,894 | 1 session (2026-05-04) |

**Trend:** Delivery density remains high and consistent — v1.8 shipped 14 requirements across 3 phases in a single day with zero execution deviations. The dispatcher pattern (v1.8) is the cleanest architectural expansion yet: adding a third notification channel (e.g., email) requires only a new branch in notifications.ts + seed row, with zero changes to callers. The CONTEXT.md investment continues to pay for itself by eliminating mid-execution pivots.
