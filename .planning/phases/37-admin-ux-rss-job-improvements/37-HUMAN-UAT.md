---
status: partial
phase: 37-admin-ux-rss-job-improvements
source: [37-VERIFICATION.md]
started: 2026-05-05T15:35:00Z
updated: 2026-05-05T15:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. RSS tab navigation
expected: Open `/admin` → Blog → click "RSS" tab; three sub-tabs (Sources / Queue / Jobs) render under the AutomationStatusBanners; sub-tabs are visible and switchable; banners pinned above
result: [pending]

### 2. RSS Sources CRUD round-trip
expected: Click Add Source → fill name/URL → Save (source appears); toggle the Switch (auto-saves via PATCH); click Edit (dialog round-trips); click Delete (confirmation appears, source removed)
result: [pending]

### 3. RSS Queue browsing
expected: Switch among Pending / Used / Skipped sub-tabs; pagination next/prev works at 50/page; pending rows show numeric score badge (two decimals); Used rows show "View resulting post" link
result: [pending]

### 4. Generate Now → preview → Save/Discard
expected: Click Generate Now in Automation tab; preview modal opens with title, feature image, excerpt, first ~200 words of body; Save as Draft creates a `blog_post` (draft) + marks `rss_item` used + invalidates Posts cache; Discard does NOT write to DB
result: [pending]

### 5. Stuck job cancellation
expected: Force a stale lock condition (`lockAcquiredAt > 10min ago`, `job.status='running'`); Cancel button appears in JobHistoryPanel; clicking it releases the lock and marks job `failed` with reason `cancelled_by_admin`
result: [pending]

### 6. Red banner trigger
expected: Unset `BLOG_GEMINI_API_KEY` (or disable Gemini integration) → reload RSS tab → red banner appears with text about Gemini integration unavailable; "Open Integrations" link visible
result: [pending]

### 7. Next-run countdown + cost chips
expected: Chips show relative time (next-run countdown from `lastRunAt + 24h/postsPerDay`) and dollar amount (monthly cost from `postsPerDay × pricing × 30`); tooltip explains "approximate, based on Gemini list pricing"; chips update when `postsPerDay` changes
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
