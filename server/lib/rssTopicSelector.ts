// server/lib/rssTopicSelector.ts
//
// Phase 35 — Plan 35-02 — RSS-07
// Topic-selection brain for the blog generator.
//
// Pure module: no Gemini calls, no DB writes, no cron wiring.
// - scoreItem(item, settings, now?): pure ranker (D-08).
// - selectNextRssItem(settings, now?): orchestrator that pulls pending items
//   from storage, scores them, returns the winner or null (D-09).
//
// Plan 35-03 will plug selectNextRssItem() into BlogGenerator.generate(),
// and call markRssItemUsed(item.id, post.id) after a successful post create.

import { storage } from "../storage.js";
import type { BlogRssItem, BlogSettings } from "#shared/schema.js";

// ─── Constants (D-08 / D-09) ───────────────────────────────────────────────

/** 14-day recency window — items older than this contribute 0 to recency. */
const RECENCY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/** D-08: keyword overlap weight in the final score. */
const KEYWORD_WEIGHT = 0.6;

/** D-08: recency weight in the final score. */
const RECENCY_WEIGHT = 0.4;

/** D-09: pending items batch size pulled from storage per selection. */
const PENDING_BATCH_SIZE = 50;

// ─── File-local helpers ────────────────────────────────────────────────────

/**
 * Splits the comma-separated `seoKeywords` string from BlogSettings into a
 * normalized array of lowercase, trimmed, non-empty keywords.
 */
function parseSeoKeywords(seoKeywords: string): string[] {
  return seoKeywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);
}

/**
 * Counts DISTINCT keywords from `keywords` that appear (case-insensitive
 * substring) in the item's title + summary, normalized by keywords.length.
 *
 * D-08: empty keyword list → returns 0 (no signal, NOT 1, NOT NaN).
 */
function scoreKeywordOverlap(item: BlogRssItem, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const haystack = `${item.title} ${item.summary ?? ""}`.toLowerCase();
  const matches = keywords.filter((k) => haystack.includes(k)).length;
  return Math.min(matches / keywords.length, 1);
}

/**
 * D-08 recency formula: `1 - clamp((now - publishedAt) / 14days, 0, 1)`.
 *
 * - Today → recency ≈ 1
 * - 14d+ old → recency = 0
 * - Future-dated (rare) → ratio clamped to 0 → recency = 1
 * - publishedAt is null → recency = 0 (treat as old; no signal)
 */
function scoreRecency(item: BlogRssItem, now: Date): number {
  if (!item.publishedAt) return 0;
  const ageMs = now.getTime() - item.publishedAt.getTime();
  const ratio = Math.max(0, Math.min(ageMs / RECENCY_WINDOW_MS, 1));
  return 1 - ratio;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * D-08: pure scoring function for a single RSS item.
 *
 * Final score: `KEYWORD_WEIGHT * keywordOverlap + RECENCY_WEIGHT * recency`,
 * which evaluates to `0.6 * keywordOverlap + 0.4 * recency`.
 *
 * `now` is exposed for testability — callers (and Plan 35-03's generator)
 * can pass a deterministic clock.
 */
export function scoreItem(
  item: BlogRssItem,
  settings: BlogSettings,
  now: Date = new Date(),
): number {
  const keywords = parseSeoKeywords(settings.seoKeywords);
  const keywordScore = scoreKeywordOverlap(item, keywords);
  const recencyScore = scoreRecency(item, now);
  return KEYWORD_WEIGHT * keywordScore + RECENCY_WEIGHT * recencyScore;
}

/**
 * D-09: select the next RSS item the generator should turn into a post.
 *
 * Algorithm:
 *   1. Pull up to PENDING_BATCH_SIZE (50) most-recent pending items via
 *      storage.listPendingRssItems(50). The DB layer already orders these
 *      by `published_at DESC NULLS LAST`.
 *   2. Score each via scoreItem(item, settings, now).
 *   3. Return the highest-scored item, or `null` if the list is empty.
 *
 * Tiebreak: candidates arrive newest-first. The loop uses a STRICT `>` on
 * score, so on ties the FIRST candidate (the newer publishedAt) wins —
 * implicit, stable, and rooted in DB order rather than ad-hoc comparators.
 *
 * No side effects beyond logging. Marking items as used belongs to the
 * generator (Plan 35-03) so a failed generation leaves the item `pending`
 * for retry on the next run.
 */
export async function selectNextRssItem(
  settings: BlogSettings,
  now: Date = new Date(),
): Promise<BlogRssItem | null> {
  const candidates = await storage.listPendingRssItems(PENDING_BATCH_SIZE);
  if (candidates.length === 0) {
    console.log("[rss-selector] no pending items — generator should skip");
    return null;
  }

  let best: BlogRssItem | null = null;
  let bestScore = -Infinity;

  // candidates already ordered by publishedAt DESC NULLS LAST.
  // Strict `>` keeps the newer publishedAt as the implicit tiebreaker.
  for (const candidate of candidates) {
    const score = scoreItem(candidate, settings, now);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (best) {
    console.log(
      `[rss-selector] picked item id=${best.id} score=${bestScore.toFixed(3)} title=${best.title.slice(0, 80)}`,
    );
  }

  return best;
}
