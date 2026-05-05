---
status: partial
phase: 38-dynamic-cron-observability
source: [38-VERIFICATION.md]
started: 2026-05-05T15:50:00Z
updated: 2026-05-05T15:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Apply migration to live database
expected: `npx tsx scripts/migrate-blog-durations-ms.ts` runs without error; `\d blog_generation_jobs` shows new `durations_ms jsonb` column; idempotent (safe to re-run)
result: passed (applied via `supabase db push --include-all` on 2026-05-05; pushed two pending migrations: 20260504150000_create_blog_rss_tables.sql + 20260505120000_blog_jobs_durations_ms.sql; migration history now in sync with remote)

### 2. Cron interval responds to postsPerDay change without redeploy
expected: With server running (`npm run dev`), set `postsPerDay=24` in admin → wait one tick → log shows `interval=60min` (the 60min clamp); change to `postsPerDay=2` → next tick log shows `interval=720min`. No restart required.
result: [pending]

### 3. durations_ms populated on completed jobs
expected: Trigger Generate Now → preview → Save as Draft → query `SELECT durations_ms FROM blog_generation_jobs ORDER BY id DESC LIMIT 1` → JSONB has 5 numeric keys: `topic`, `content`, `image`, `upload`, `total` (image may be null if generation failed)
result: [pending]

### 4. Admin Job History chip + expand-on-click breakdown
expected: Open `/admin` → Blog → RSS → Jobs sub-tab → completed job rows show `⏱ {n.n}s` chip; clicking row toggles 5-cell breakdown grid (Pauta / Conteúdo / Imagem / Upload / Total); image cell shows `—` (em-dash) when image was non-blocking-skipped; pre-Phase-38 historical rows (durationsMs=null) show no chip and aren't clickable
result: [pending]

### 5. Transient Gemini retry observation (optional, requires fault injection)
expected: With Gemini mocked to throw HTTP 503 once, console logs show retry at +1s; success on second attempt; durations_ms.total reflects added latency. Three consecutive failures still mark job failed with appropriate reason.
result: [pending]

### 6. Image failure remains non-blocking after retry exhaustion
expected: With image API forced to throw 3x, `console.warn` logs about feature image; post saves with `featureImageUrl: null`; durations_ms recorded for topic/content/upload (image may be undefined/null in JSONB)
result: [pending]

## Summary

total: 6
passed: 1
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
