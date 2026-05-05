/**
 * RSS Fetcher — Phase 35-01 (RSS-05)
 *
 * Pure ingestion module. Parses every enabled `blog_rss_sources` row via
 * `rss-parser`, upserts items into `blog_rss_items` keyed on (source_id, guid),
 * and stamps each source with `last_fetched_at` + `last_fetched_status` +
 * `error_message` after its pass.
 *
 * Decisions implemented:
 * - D-01: rss-parser as the canonical RSS lib (Parser singleton + UA header).
 * - D-02: single `fetchAllRssSources()` entry point returning structured summary.
 * - D-04: cap 20 items/source/run; skip items where published_at < lastFetchedAt.
 * - D-05: GUID fallback chain — guid → link URL → SHA-256(sourceId|title|pubDate).
 * - D-06: stripHtml + 1000-char summary cap (plain text only).
 * - D-07: per-source try/catch; error_message ≤ 500 chars; source NOT auto-disabled.
 * - D-13: no global lock — relies on (source_id, guid) UNIQUE-index idempotency.
 * - D-14: sequential `for...of` over sources (never `Promise.all`).
 *
 * Out of scope (deferred per Phase 35 CONTEXT):
 * - Cron wiring (Plan 35-03)
 * - Generator integration (Plan 35-03)
 * - Parallel fetching, per-host rate limit, conditional GET, auto-disable.
 */

import { createHash } from "crypto";
import Parser from "rss-parser";
import { storage } from "../storage.js";
import type { BlogRssSource, InsertBlogRssItem } from "#shared/schema.js";

// ─── Tunables (D-04, D-06, D-07) ────────────────────────────────────────────

const MAX_ITEMS_PER_SOURCE = 20;
const MAX_SUMMARY_CHARS = 1000;
const MAX_TITLE_CHARS = 1000;
const MAX_ERROR_MESSAGE_CHARS = 500;
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "Skale Club RSS Fetcher/1.0";

// ─── Parser singleton (D-01) ────────────────────────────────────────────────

const parser = new Parser({
  headers: { "User-Agent": USER_AGENT },
  timeout: FETCH_TIMEOUT_MS,
});

type ParsedItem = Parser.Item & {
  // rss-parser does not type these but emits them on many feeds.
  id?: string;
  summary?: string;
};

// ─── Public surface (D-02) ──────────────────────────────────────────────────

export interface FetchSummary {
  sourcesProcessed: number;
  itemsUpserted: number;
  errors: Array<{ sourceId: number; sourceName: string; message: string }>;
}

/**
 * Iterate every enabled RSS source sequentially, parse it, and upsert items.
 * Never throws — per-source failures are isolated and recorded on the source row.
 */
export async function fetchAllRssSources(): Promise<FetchSummary> {
  const summary: FetchSummary = {
    sourcesProcessed: 0,
    itemsUpserted: 0,
    errors: [],
  };

  const allSources = await storage.listRssSources();
  const sources = allSources.filter((s) => s.enabled);

  // D-14: sequential, in DB order. NEVER Promise.all.
  for (const source of sources) {
    try {
      const { upserted } = await processSource(source);
      summary.itemsUpserted += upserted;

      await storage.updateRssSource(source.id, {
        lastFetchedAt: new Date(),
        lastFetchedStatus: "ok",
        errorMessage: null,
      });

      // eslint-disable-next-line no-console
      console.log(
        `[rss-fetcher] source=${source.id} ${source.name} upserted=${upserted}`,
      );
    } catch (err) {
      // D-07: isolate, record, continue. Source is NEVER auto-disabled.
      const message = (err instanceof Error ? err.message : String(err)).slice(
        0,
        MAX_ERROR_MESSAGE_CHARS,
      );

      await storage.updateRssSource(source.id, {
        lastFetchedAt: new Date(),
        lastFetchedStatus: "error",
        errorMessage: message,
      });

      summary.errors.push({
        sourceId: source.id,
        sourceName: source.name,
        message,
      });

      // eslint-disable-next-line no-console
      console.error(
        `[rss-fetcher] source=${source.id} ${source.name} error: ${message}`,
      );
    } finally {
      summary.sourcesProcessed += 1;
    }
  }

  return summary;
}

// ─── Per-source pipeline ────────────────────────────────────────────────────

async function processSource(
  source: BlogRssSource,
): Promise<{ upserted: number }> {
  const feed = await parser.parseURL(source.url);
  const items = (feed.items ?? []).slice(0, MAX_ITEMS_PER_SOURCE);

  let upserted = 0;

  for (const raw of items) {
    const item = raw as ParsedItem;
    const publishedAt = parsePublishedAt(item);

    // D-04: skip items older than our last successful sweep — they were
    // already ingested on a prior run.
    if (
      publishedAt &&
      source.lastFetchedAt &&
      publishedAt < source.lastFetchedAt
    ) {
      continue;
    }

    const guid = resolveGuid(item, source.id);
    const url = item.link && isHttpUrl(item.link) ? item.link : null;

    // `insertBlogRssItemSchema` requires `url` to pass `z.string().url()`.
    // If we have no valid http(s) URL, skip the item rather than violating
    // the contract. (Synthesized GUID hashes are not URLs.)
    if (!url) {
      continue;
    }

    const summary = stripHtml(
      item.contentSnippet ?? item.content ?? item.summary ?? "",
    ).slice(0, MAX_SUMMARY_CHARS);

    const title = (item.title ?? "(untitled)").slice(0, MAX_TITLE_CHARS);

    const payload: InsertBlogRssItem = {
      sourceId: source.id,
      guid,
      url,
      title,
      summary: summary.length > 0 ? summary : null,
      publishedAt: publishedAt ?? null,
      // status omitted — schema default "pending" applies.
    };

    await storage.upsertRssItem(payload);
    upserted += 1;
  }

  return { upserted };
}

// ─── Helpers (file-local, not exported) ─────────────────────────────────────

/**
 * D-05: GUID fallback chain. Always returns a non-empty string.
 *   1. <guid> / Atom <id> (rss-parser unifies both into `item.guid`).
 *   2. Link URL.
 *   3. SHA-256(sourceId|title|pubDate) — deterministic synthesized id.
 */
function resolveGuid(item: ParsedItem, sourceId: number): string {
  const guidCandidate = (item.guid ?? item.id ?? "").trim();
  if (guidCandidate) {
    return guidCandidate;
  }

  const linkCandidate = (item.link ?? "").trim();
  if (linkCandidate) {
    return linkCandidate;
  }

  const seed = `${sourceId}|${item.title ?? ""}|${item.pubDate ?? item.isoDate ?? ""}`;
  return createHash("sha256").update(seed).digest("hex");
}

/**
 * Prefer rss-parser's normalized `isoDate`; fall back to raw `pubDate`.
 * Returns `null` when neither parses to a finite Date.
 */
function parsePublishedAt(item: ParsedItem): Date | null {
  const candidates = [item.isoDate, item.pubDate];
  for (const value of candidates) {
    if (!value) continue;
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) {
      return date;
    }
  }
  return null;
}

/**
 * D-06: strip HTML tags and decode the most common entities. Plain-text only.
 * Caller is responsible for `.slice(0, MAX_SUMMARY_CHARS)` after this.
 */
function stripHtml(input: string | null | undefined): string {
  if (!input) return "";

  // Drop tags first.
  let text = input.replace(/<[^>]*>/g, " ");

  // Decode the handful of entities RSS feeds commonly use. We deliberately
  // avoid pulling in an HTML-entity dependency for v1.9.
  const entityMap: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };
  for (const [entity, literal] of Object.entries(entityMap)) {
    text = text.split(entity).join(literal);
  }

  // Numeric entities (decimal): &#NNN;
  text = text.replace(/&#(\d+);/g, (_, code: string) => {
    const num = Number(code);
    return Number.isFinite(num) ? String.fromCodePoint(num) : "";
  });

  // Collapse whitespace.
  return text.replace(/\s+/g, " ").trim();
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
