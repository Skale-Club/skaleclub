# Phase 37: Admin UX (RSS + Job Improvements) - Discussion Log

> Audit trail only. Decisions live in CONTEXT.md.

**Date:** 2026-05-05
**Phase:** 37-admin-ux-rss-job-improvements
**Mode:** Auto (`--auto`) — all gray areas resolved with recommended defaults aligned to the existing admin design system.

---

## Auto-Selected Decisions

| Area | Choice | Rationale |
|------|--------|-----------|
| File layout | Split into `client/src/components/admin/blog/` (6 new files) | Each ≤ 600 lines; existing 1351-line BlogSection.tsx left as legacy |
| Tab structure | Posts \| Automation \| RSS (top-level); Sources \| Queue \| Jobs (sub-tabs in RSS) | Three top-level tab ceiling; sub-tabs for sub-domain |
| CRUD pattern | Modal Dialog (matches FaqsSection / NewFormDialog) | Project pattern |
| Source row fields | name, url (truncated+tooltip), enabled (Switch with auto-save), last_fetched_at (relative), status badge, error_message (collapsible) | Operationally what admin needs at a glance |
| Queue display | Status sub-tabs (Pending/Used/Skipped) + 50/page pagination | Three buckets are operationally distinct |
| Generate Now flow | Two-step: POST /api/blog/preview → preview dialog → POST /api/blog/posts/from-preview OR Discard | Honors "keep, edit, or discard" requirement |
| Preview endpoint contract | Returns generated content WITHOUT writing post or job; from-preview commits | Allows true Discard without DB churn |
| Job history | Last 50 jobs, retry on failed rows, cancel only on 10-min stale running rows | Matches v1.5 pattern |
| Retry semantics | Re-uses sourceItemId; new job row (audit preserved) | "Same content, fresh attempt" |
| Cancel semantics | 10-min staleness gate, force-releases lock, marks job cancelled_by_admin | Matches existing lock-staleness convention |
| API-key warning | Single red banner if any of: API key missing OR integration disabled OR integration row absent | One banner, clear remedy |
| Next-run + cost chips | Relative countdown ("in 3h 15m") + monthly cost approximation | Hardcoded pricing constant with verifiable comment |
| Cost pricing | Hardcoded BLOG_COST_PRICING constant (3000 tokens/post × $0.075/1M + $0.039/image) | Approximation; documented source |
| New endpoints | 11 new routes under /api/blog/* | Respects existing namespace; CRON_SECRET routes untouched |
| Storage additions | listRssItemsByStatus, listBlogGenerationJobs, getBlogGenerationJob, updateBlogGenerationJob | Joins live in storage layer |
| Translations | New section "Admin — Blog RSS (Phase 37)" in translations.ts ≤ 600 lines | TypeScript overload-cast enforces keys |
| Refresh strategy | React Query 30s staleTime; jobs poll 5s while latestJob.status='running' | Standard pattern; polling stops when idle |
| Manual Generate Now | Reuses existing button; behavior upgraded to open PreviewDraftDialog | Single source of truth |

## Claude's Discretion

- Internal component prop shapes
- AdminCard wrapping per panel (recommended)
- Whether Add Source dialog includes "fetch now" toggle (recommended NO for v1.9)
- Exact relative-time strings (date-fns defaults)

## Deferred Ideas

- Inline editing of preview content
- Bulk RSS source operations
- Free-text search across queue
- Job history beyond 50
- Configurable cost pricing
- Auto-retry on failure (Phase 38)
- Real-time push (WebSocket/SSE)
- CSV export
- Per-source priority/weight in scoring
- BlogSection.tsx refactor (legacy 1351 lines — separate polish phase)
