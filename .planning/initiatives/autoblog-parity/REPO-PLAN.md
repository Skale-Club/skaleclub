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
| ~~SC-04~~ | ~~Make RSS optional~~ | D-02 | **DONE** — `no_rss_items` is gone from the skip taxonomy entirely. An empty queue now runs the pillar rotation instead of publishing nothing |
| ~~SC-05~~ | ~~Editorial pillars + grounded prompt sections~~ | xkedule | **DONE** — rotation machinery ported verbatim; the 8 pillars are this site's own (B2B agency), since Xkedule's are written for trades visiting a customer's home. Geography skipped: this repo has no service-area data |
| ~~SC-06~~ | ~~Posting hour + timezone~~ | xkedule | **DONE** — `blog-schedule.ts` ported byte-identical, plus a `timezone` column (this repo has no company-settings equivalent). `GET /api/blog/settings` returns `nextScheduledRunAt` from the same helper the cron gate uses. **Admin UI for the hour picker still to do (SC-11)** |
| ~~SC-07~~ | ~~Telegram groups~~ | xkedule | **DONE** — `chat_ids text[]`, multi-destination fan-out, forum-topic threads, validation at save time, per-chat failure reporting, AND now the approvals half: draft cards with Aprovar/Rejeitar, the public webhook (`POST /api/blog/telegram/webhook`, secret-checked in constant time and restricted to chats a card could have gone to), `setWebhook` registration with a secret that rotates on a fresh enable, and `POST /api/blog/telegram/reconcile` for a registration that went stale. `server/blog/approval.ts` is the single decision the panel and the bot share. **Admin panel for it is SC-11.** |
| ~~SC-08~~ | ~~`ai_generation_logs` + per-call logging~~ | websites | **DONE** — `20260916170000_ai_generation_logs.sql`. Text calls log model/prompt/duration (the OpenRouter wrapper here does not surface token counts); an image call that returns nothing logs `skipped`, not `failure` |
| ~~SC-09~~ | ~~Cover normalisation~~ | xkedule | **DONE** — 16:9 crop (attention-positioned, outside a 5% tolerance) + WebP re-encode on both the generate and preview paths. Never throws: a failed crop or encode uploads the original bytes. **Curated fallback cover not ported** — this repo has no curated set |
| ~~SC-10~~ | ~~Encrypt provider keys at rest~~ | xkedule | **DONE** — ported `server/lib/token-crypto.ts` (AES-256-GCM, per-product salt) and applied it in the storage layer, so it covers every `chat_integrations` key, not only OpenRouter. Legacy plaintext decrypts unchanged and re-encrypts on the next write: no migration, no downtime |
| **SC-11** | Admin UI (`components/admin/blog/BlogAutomationPanel.tsx`): posting hour, Telegram approvals panel, cost panel, pillar/RSS source toggle | — | **PARTLY DONE** — posting hour + timezone picker (with the server-computed "next post" line, from the same helper the cron gate uses) and `TelegramApprovalsPanel.tsx` (approval chats, optional separate bot, enable/disable, and a one-click webhook reconcile — Telegram drops a webhook whose URL stops resolving and the only symptom is buttons that quietly stop working). `AiCostPanel.tsx` reads `ai_generation_logs`, which had been written since SC-08 with nothing reading it. **Still open:** a pillar/RSS source toggle in the panel (RSS sources already have their own tab). |
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
