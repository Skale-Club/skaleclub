# Phase 38: Dynamic Cron & Observability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 38-dynamic-cron-observability
**Areas discussed:** Cron rescheduling mechanism, Retry placement, Image failure under retry, durationsMs admin display
**Mode:** User said "do recommended" — Claude selected the first/recommended option for each gray area without per-question follow-ups.

---

## Cron Rescheduling Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Recursive setTimeout | Self-pacing loop; each tick reads fresh settings, computes next interval, schedules itself. Cleanest, no clearInterval race. | ✓ |
| Hot-swap setInterval | Keep setInterval but check at each tick; if interval changed, clearInterval + start new. | |
| Settings watcher loop | Separate poller clears cron when settings change. | |

**User's choice:** Recursive setTimeout (recommended)
**Notes:** Existing `cron.ts` is 38 lines — easy refactor. Vercel guard preserved. Settings changes take effect on the very next tick.

---

## Retry Wrapper Placement

| Option | Description | Selected |
|--------|-------------|----------|
| `withGeminiRetry` wrapping `withGeminiTimeout` | New helper composes existing timeout wrapper; 3 call sites swap `Timeout`→`Retry`. | ✓ |
| Per call-site explicit retry | Inline retry loop at each Gemini call, no wrapper helper. | |
| Pipeline-level retry | Whole `runPipeline` retries on any Gemini failure. | |

**User's choice:** withGeminiRetry wrapping withGeminiTimeout (recommended)
**Notes:** Smallest blast radius. Existing timeout semantics preserved. Transient classifier: GeminiTimeoutError, GeminiEmptyResponseError, network errors, HTTP 5xx. Do NOT retry on 4xx.

---

## Image Failure Under Retry

| Option | Description | Selected |
|--------|-------------|----------|
| Retry 3x then non-blocking | Image gets full [1s,5s,30s] retries; if all fail, save post with `featureImageUrl: null` (Phase 22 D-04 preserved). | ✓ |
| Skip retry on image | Image stays fast-fail; only topic/content get retry. | |
| Retry once and give up | Single retry attempt, then non-blocking fall-through. | |

**User's choice:** Retry 3x then non-blocking (recommended)
**Notes:** Spec says "transient errors retry per call site" — image is one. Fall-through preserves v1.5 invariant ("draft must save when content + topic succeed"). Worst-case extra delay ~36s on a fully-failing image, acceptable for background cron.

---

## durationsMs Admin Display

| Option | Description | Selected |
|--------|-------------|----------|
| Expand-on-click row | Collapsed shows total chip; click row to reveal per-stage breakdown table. | ✓ |
| Inline chips per row | All stage durations as small chips on the row (compact but cluttered). | |
| Tooltip on total | Hover-only — least discoverable. | |

**User's choice:** Expand-on-click row (recommended)
**Notes:** Spec says "admin job history surfaces the breakdown" — chip alone insufficient. JobHistoryPanel is 225 lines, ~30 line addition stays well under 600-line cap. Reuses row pattern, no new modal.

---

## Claude's Discretion

- Exact transient-error classifier predicate (regex / instanceof / status check) — researcher investigates `@google/genai` error surface.
- `total` chip format (`12.4s` vs `12400ms`) — match existing chip style during planning.
- Vercel cron behavior for dynamic schedule — researcher confirms whether `vercel.json` supports it; document as node-only otherwise.
- RSS fetcher cron migration to recursive setTimeout — defer; not Phase 38 scope.

## Deferred Ideas

- RSS fetcher cron consistency refactor (separate phase)
- External structured logging sink (Better Stack / Datadog)
- Per-stage retry budget variations
- Backoff jitter
- Aggregate timing dashboards (p50/p95 trends)
- `retryAttempts` count column on jobs (researcher may surface during planning)
