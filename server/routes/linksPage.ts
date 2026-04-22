// Phase 11 — Click Analytics API (LINKS-04).
// Public, IP-rate-limited click increment for /links page.
//
// Trade-offs (accepted for v1.3):
//   1. In-memory Map: per-process rate limit. Acceptable because /links traffic is low
//      and duplicate counts from multi-process edge are tolerable for analytics.
//   2. Read-modify-write race: two concurrent clicks on the same link could lose one
//      increment. Accepted for v1.3 (analytics, not billing).
//   3. Rate-limited requests return 204 (not 429) so navigator.sendBeacon does not
//      surface a console error on the client. Server-side log captures the skip if needed.
import type { Express, Request } from "express";
import { storage } from "../storage.js";

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

function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length) return fwd[0]!;
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

      const settings = await storage.getCompanySettings();
      const cfg = settings?.linksPageConfig;
      if (!cfg || !Array.isArray(cfg.links)) {
        return res.status(404).json({ message: "Link not found" });
      }
      const idx = cfg.links.findIndex((l: any) => l?.id === linkId);
      if (idx < 0) return res.status(404).json({ message: "Link not found" });

      const updatedLinks = cfg.links.map((l: any, i: number) =>
        i === idx ? { ...l, clickCount: (l.clickCount ?? 0) + 1 } : l
      );

      await storage.updateCompanySettings({
        linksPageConfig: { ...cfg, links: updatedLinks },
      } as any);

      clickMemory.set(key, now);
      if (clickMemory.size > PRUNE_AT_SIZE) pruneClickMemory();

      return res.status(204).send();
    } catch (err) {
      console.error("[links-page click]", err);
      return res.status(204).send();
    }
  });
}
