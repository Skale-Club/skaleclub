---
initiative: autoblog-parity
repo: skaleclub
phase: P3
role: converges on xkedule (single-site)
status: planned
---

# Auto-Blog Parity — Skale Club

Read [`MASTER.md`](./MASTER.md) first.

Skale Club is a **single site**, not a multi-tenant platform. Parity here means "the
capability exists", not "the capability exists per tenant". No `tenant_id` columns, no
super-admin gate — `super_admin_enabled` is effectively always true and can stay out of the
schema.

This repo is also the **donor** for RSS and pipeline robustness: XK-03…XK-12 in the Xkedule
plan port *from here*. Coordinate so the extraction into `server/blog/*` happens once and
both repos end up on the same file shape.

## What Skale Club already has (do not rebuild)

- RSS as a topic source: `blog_rss_sources` + `blog_rss_items`, `rssFetcher`,
  `rssTopicSelector` (keyword 0.6 / recency 0.4), items marked used after the post insert
- HTML sanitiser + 600–4000 plain-text bounds, `blogContentValidator`
- `withAiTimeout` (30s, AbortSignal forwarded) + `withAiRetry` [1s, 5s, 30s] + transient
  error classifier
- Preview without commit + commit-from-preview
- Job retry/cancel, `GET /api/blog/health`, per-stage `durations_ms`
- DB lock column (`lock_acquired_at`, stale after 10 min)
- HTTP cron endpoints on `CRON_SECRET`, driven by the `skale-cron` VPS crontab, with the
  in-process scheduler gated by `DISABLE_INPROCESS_CRON`
- Unit tests for the generator and the blog schema

## Gaps to close

| id | task | ported from | notes |
|---|---|---|---|
| ~~SC-01~~ | ~~`shared/blog-contract.ts`~~ | xkedule | **DONE** — `shared/schema/blog.ts` now imports its enums from it and re-exports them, so `#shared/schema.js` importers are unaffected |
| ~~SC-02~~ | ~~Extract the shared modules into `server/blog/`~~ | — | **DONE** — Xkedule's P1 ported from these exact files |
| ~~SC-03~~ | ~~Contract renames + new columns~~ | D-03 | **DONE** — `20260916150000_blog_parity_contract.sql`, step 1 of two: new columns added and backfilled, old ones left in place and made nullable. Also renamed `openrouter_text_model`/`openrouter_image_model` → `text_model`/`image_model`, and added `rss_enabled` (default **true** here — RSS is this repo's only topic source) and `posting_hour` |
| **SC-04** | Add `rss_enabled`; **make RSS optional** — when it is off, or no pending item clears the threshold, fall back to pillar rotation instead of skipping with `no_rss_items` | D-02 | today the generator cannot produce anything without an RSS item |
| **SC-05** | Port `shared/blog-prompt.ts`, adapted to this site's own content: pillars, geography (the agency's service regions), catalog (services + portfolio), internal links (site pages + published posts), keyword dedup | xkedule | replaces the hardcoded pt-BR brand-voice block as the only structure |
| **SC-06** | Port `shared/blog-schedule.ts` + `posting_hour` + site timezone; show "next post at …" in the admin | xkedule | today the cadence drifts |
| **SC-07** | Telegram: `telegram_settings.chat_id` (single) → **`chat_ids text[]`** with backfill; add `approvals_enabled`, `approvals_bot_token`, `approvals_chat_ids`, `webhook_secret`; `POST /api/telegram/webhook`; `setWebhook` reconcile; group + thread support; per-chat test button (MASTER §6) | xkedule | this repo is the furthest behind on Telegram |
| **SC-08** | `ai_generation_logs` + cost/token logging on `blog_post` and `blog_image` | websites | |
| **SC-09** | Image: WebP conversion + 16:9 normalisation + curated fallback cover | xkedule | currently uploads raw model output to the Supabase `images` bucket |
| **SC-10** | Encrypt the OpenRouter key at rest (D-06) — the key resolves from runtime cache → env → the `openrouter` integration row; encrypt the stored row | xmartmenu `src/lib/crypto.ts` | |
| **SC-11** | Admin UI (`components/admin/blog/BlogAutomationPanel.tsx`): posting hour, Telegram approvals panel, cost panel, pillar/RSS source toggle | — | panel is 319 lines today; expect to split it |
| **SC-12** | Tests: schedule, pillar fallback when RSS is empty, Telegram callback auth | — | extends the existing `server/lib/__tests__/` |

## Notes specific to this repo

- `blog_settings` is a one-row table with no `tenant_id`. Keep it that way — do not add
  tenancy to satisfy the contract; MASTER D-10 covers this explicitly.
- The AI key is a **platform** key (runtime cache → env → the OpenRouter integration row),
  per MASTER D-05. Do not port the tenant-key requirement from xkedule/websites.
- The GitHub Actions `blog-cron.yml` schedule is deliberately disabled — `skale-cron` on the
  Coolify VPS owns scheduling, `workflow_dispatch` stays as break-glass. Leave it that way.
- `DISABLE_INPROCESS_CRON=true` on the Coolify container is what stops double generation.
  Any change to `server/cron.ts` must preserve that gate.

## Follow-up migration (not yet written)

Step 2 of D-12: once this has run in production, drop `auto_approve`,
`openrouter_text_model`, `openrouter_image_model`, `blog_generation_jobs.error`,
`blog_post_feedback.signal` and `blog_post_feedback.rss_item_title`. Nothing
reads them today.

## Order of work

1. SC-02 (extract shared modules first — Xkedule's P1 depends on it)
2. SC-01, SC-03 (contract + renames)
3. SC-04, SC-05, SC-06 (pillars, optional RSS, schedule)
4. SC-07 (Telegram + groups)
5. SC-08, SC-09, SC-10
6. SC-11, SC-12
