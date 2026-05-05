# Requirements: Skale Club Web Platform — v1.9 Blog Intelligence & RSS Sources

**Defined:** 2026-05-04
**Core Value:** The auto-post pipeline produces relevant, well-written, deduplicated content automatically by selecting the most timely item from admin-curated RSS feeds — without burning the API budget or shipping low-quality drafts.

## v1.9 Requirements

### RSS Sources Foundation

- [x] **RSS-01**: Additive table `blog_rss_sources` exists with `id, name, url, enabled, last_fetched_at, last_fetched_status, error_message`.
- [x] **RSS-02**: Additive table `blog_rss_items` exists with `id, source_id (FK), guid, url, title, summary, published_at, status (pending|used|skipped), used_at, used_post_id`.
- [x] **RSS-03**: Shared Drizzle/Zod contracts exist in `shared/schema/blog.ts` and re-export from the barrel.
- [x] **RSS-04**: Storage layer supports source CRUD, item upsert by `guid`, listing pending items, and marking items as used.

### RSS Fetcher & Topic Selection

- [x] **RSS-05**: Server-side RSS parser fetches each enabled source, upserts items by `guid` (no duplicates), and records `last_fetched_at` + status per source.
- [x] **RSS-06**: A separate fetcher cron runs hourly (independent of the generator) and is Vercel-guarded.
- [x] **RSS-07**: Topic selection picks the highest-scored pending item per generator run using SEO keywords + recency, then marks the item `used` linked to the resulting post.
- [x] **RSS-08**: When no pending RSS items exist, the generator skips the run with reason `no_rss_items` (no fallback to a generic AI-invented topic).

### Generator Quality Overhaul

- [ ] **BLOG2-01**: Topic and content prompts are explicitly Brazilian Portuguese (pt-BR), include the source item title/summary as context, and instruct strict HTML output with allowed tags only (`p, h2, h3, ul, ol, li, strong, em, a, blockquote`).
- [x] **BLOG2-02**: A server-side HTML validator strips or rejects disallowed tags (`script, iframe, form, style, link`) before saving the post.
- [x] **BLOG2-03**: Slug generation normalizes Portuguese accents (NFD + diacritic removal) so titles like "Análise de CRM" become `analise-de-crm`.
- [ ] **BLOG2-04**: Content length is validated (min 600, max 4000 chars of body HTML) and runs that fail the bound are marked failed with a clear reason.
- [x] **BLOG2-05**: All Gemini API calls have an `AbortController` timeout (default 30s) and an empty-candidates check that throws a typed error.
- [x] **BLOG2-06**: Gemini model identifiers (`BLOG_CONTENT_MODEL`, `BLOG_IMAGE_MODEL`) are overridable via env vars with documented defaults.

### Admin UX

- [ ] **BLOG2-07**: Admin manages RSS sources (list, add, edit, enable/disable, delete) within the Blog section.
- [ ] **BLOG2-08**: Admin sees the RSS items queue (pending vs used vs skipped) with the source name, published date, and the resulting post link when used.
- [ ] **BLOG2-09**: Manual "Generate Now" opens a preview modal with the draft (title, excerpt, feature image, first paragraphs) and lets the admin keep, edit, or discard before it lands in the Posts list.
- [ ] **BLOG2-10**: Admin sees a job history table (last N jobs) with status, started/completed timestamps, source item, error message, and a per-row Retry button.
- [ ] **BLOG2-11**: A stuck job (lock older than the configured staleness window) can be cancelled from the admin UI; the lock is force-released.
- [ ] **BLOG2-12**: A visible warning banner appears when `BLOG_GEMINI_API_KEY` is missing or the active Gemini integration is disabled.
- [ ] **BLOG2-13**: The admin sees the next-run countdown (`lastRunAt + 24h/postsPerDay`) and an estimated monthly Gemini cost based on `postsPerDay`.

### Cron & Observability

- [ ] **BLOG2-14**: The generator cron frequency is dynamic — derived from `postsPerDay` (e.g., 4 posts/day → every 6h) — instead of the current hardcoded 60-minute interval.
- [ ] **BLOG2-15**: Structured logs include `durationMs` per stage (topic, content, image, upload) on every job, persisted in `blog_generation_jobs`.
- [ ] **BLOG2-16**: Failed Gemini calls retry with exponential backoff (1s, 5s, 30s) before the run is marked failed.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-publish (skip the draft step) | Human review remains required; v1.5 decision still in force |
| AI-suggested RSS feeds | Admin curates manually for v1.9; auto-discovery is a future enhancement |
| Multilingual posts | pt-BR only this milestone; English/Spanish are future work |
| Internal-link auto-resolution | Prompts may emit placeholder anchors, but resolving them to real post slugs is deferred |
| Webhook notifications on failure (Slack/Discord) | Email/Telegram via the v1.8 dispatcher can be wired later — not part of v1.9 scope |
| A/B testing of prompts | Single canonical prompt this milestone; experimentation infra is future work |
| Plagiarism / Copyscape checks | Deferred — relies on Gemini's own training quality for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RSS-01 | Phase 34 | Not started |
| RSS-02 | Phase 34 | Not started |
| RSS-03 | Phase 34 | Not started |
| RSS-04 | Phase 34 | Not started |
| RSS-05 | Phase 35 | Not started |
| RSS-06 | Phase 35 | Not started |
| RSS-07 | Phase 35 | Not started |
| RSS-08 | Phase 35 | Not started |
| BLOG2-01 | Phase 36 | Not started |
| BLOG2-02 | Phase 36 | Not started |
| BLOG2-03 | Phase 36 | Not started |
| BLOG2-04 | Phase 36 | Not started |
| BLOG2-05 | Phase 36 | Not started |
| BLOG2-06 | Phase 36 | Not started |
| BLOG2-07 | Phase 37 | Not started |
| BLOG2-08 | Phase 37 | Not started |
| BLOG2-09 | Phase 37 | Not started |
| BLOG2-10 | Phase 37 | Not started |
| BLOG2-11 | Phase 37 | Not started |
| BLOG2-12 | Phase 37 | Not started |
| BLOG2-13 | Phase 37 | Not started |
| BLOG2-14 | Phase 38 | Not started |
| BLOG2-15 | Phase 38 | Not started |
| BLOG2-16 | Phase 38 | Not started |

**Coverage:**
- v1.9 requirements: 24 total
- Mapped to phases: 24/24 (100%)

**Phase distribution:**
- Phase 34 (RSS Sources Foundation): 4 reqs — RSS-01–04
- Phase 35 (RSS Fetcher & Topic Selection): 4 reqs — RSS-05–08
- Phase 36 (Generator Quality Overhaul): 6 reqs — BLOG2-01–06
- Phase 37 (Admin UX): 7 reqs — BLOG2-07–13
- Phase 38 (Cron & Observability): 3 reqs — BLOG2-14–16

---
*Requirements defined: 2026-05-04*
