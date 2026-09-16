// Phase 11 — Click Analytics API (LINKS-04).
// Public, IP-rate-limited click increment for /links page.
//
// Trade-offs (accepted for v1.3):
//   1. In-memory Map: per-process rate limit. Acceptable because /links traffic is low
//      and duplicate counts from multi-process edge are tolerable for analytics.
//   2. Clicks are incremented by a single atomic UPDATE (the links array is rebuilt
//      in SQL), so concurrent clicks on the same link no longer lose increments.
//   3. Rate-limited requests return 204 (not 429) so navigator.sendBeacon does not
//      surface a console error on the client. Server-side log captures the skip if needed.
import type { Express, Request } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db.js";

const CLICK_WINDOW_MS = 60_000;
const PRUNE_AT_SIZE = 5000;
const clickMemory = new Map<string, number>();

function pruneClickMemory() {
  const cutoff = Date.now() - CLICK_WINDOW_MS * 2;
  // Use Array.from to avoid TS2802 (downlevelIteration not enabled; no target set in tsconfig).
  for (const [key, ts] of Array.from(clickMemory.entries())) {
    if (ts < cutoff) clickMemory.delete(key);
  }
}

// `req.ip`, not the raw X-Forwarded-For: the leftmost entry of that header is
// supplied by the caller, so keying a limiter on it lets anyone mint a new
// bucket per request. Express resolves the real hop via `trust proxy`.
function getClientIp(req: Request): string {
  return req.ip ?? "unknown";
}

export function registerLinksPageRoutes(app: Express) {
  app.post("/api/links-page/click/:linkId", async (req, res) => {
    try {
      const linkId = String(req.params.linkId ?? "");
      if (!linkId) return res.status(404).json({ message: "Link not found" });

      const ip = getClientIp(req);
      const key = `${ip}:${linkId}`;
      const last = clickMemory.get(key);
      const now = Date.now();

      if (last && now - last < CLICK_WINDOW_MS) {
        return res.status(204).send();
      }

      // Single atomic statement: rebuild the links array in SQL and bump the
      // matching link's counter. The previous read-modify-write round-trip
      // through storage.updateCompanySettings() dropped concurrent clicks.
      const updated = await db.execute(sql`
        UPDATE company_settings
        SET links_page_config = jsonb_set(
          links_page_config,
          '{links}',
          (
            SELECT COALESCE(
              jsonb_agg(
                CASE
                  WHEN elem->>'id' = ${linkId}
                    THEN jsonb_set(elem, '{clickCount}', to_jsonb(COALESCE((elem->>'clickCount')::int, 0) + 1))
                  ELSE elem
                END
                ORDER BY ord
              ),
              '[]'::jsonb
            )
            FROM jsonb_array_elements(links_page_config->'links') WITH ORDINALITY AS t(elem, ord)
          )
        )
        WHERE jsonb_typeof(links_page_config->'links') = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(links_page_config->'links') AS e(elem)
            WHERE elem->>'id' = ${linkId}
          )
      `);

      if (!updated.rowCount) return res.status(404).json({ message: "Link not found" });

      clickMemory.set(key, now);
      if (clickMemory.size > PRUNE_AT_SIZE) pruneClickMemory();

      return res.status(204).send();
    } catch (err) {
      console.error("[links-page click]", err);
      return res.status(204).send();
    }
  });
}
