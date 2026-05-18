import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { requireAdmin } from "./_shared.js";
import type { MarketingFilters } from "#shared/marketing-types.js";

const MAX_WINDOW_MS = 90 * 86400_000;   // 90-day hard cap per CONTEXT.md specifics.
const DEFAULT_WINDOW_MS = 30 * 86400_000; // 30-day default window per source D-13.

const filtersSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  source: z.string().trim().max(120).optional(),
  campaign: z.string().trim().max(120).optional(),
  conversionType: z
    .enum(['lead_created', 'phone_click', 'form_submitted', 'booking_started'])
    .optional(),
});

function buildFilters(raw: z.infer<typeof filtersSchema>): MarketingFilters & { conversionType?: string } {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - DEFAULT_WINDOW_MS);
  let from = raw.dateFrom ? new Date(raw.dateFrom) : defaultFrom;
  const to = raw.dateTo ? new Date(raw.dateTo) : now;

  // 90-day hard cap — silently clamp `from` forward if the requested window exceeds the limit.
  // Source's buildFilters does NOT enforce this; we add it per CONTEXT.md specifics list.
  if (to.getTime() - from.getTime() > MAX_WINDOW_MS) {
    from = new Date(to.getTime() - MAX_WINDOW_MS);
  }

  return {
    from,
    to,
    channel: raw.source,
    campaign: raw.campaign,
    conversionType: raw.conversionType,
  };
}

export function registerMarketingRoutes(app: Express): void {
  app.get('/api/admin/marketing/overview', requireAdmin, async (req, res) => {
    try {
      const raw = filtersSchema.parse(req.query);
      const data = await storage.getMarketingOverview(buildFilters(raw));
      res.json(data);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid filters' });
      console.error('Marketing overview error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/admin/marketing/sources', requireAdmin, async (req, res) => {
    try {
      const raw = filtersSchema.parse(req.query);
      const data = await storage.getMarketingBySource(buildFilters(raw));
      res.json(data);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid filters' });
      console.error('Marketing sources error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/admin/marketing/campaigns', requireAdmin, async (req, res) => {
    try {
      const raw = filtersSchema.parse(req.query);
      const data = await storage.getMarketingByCampaign(buildFilters(raw));
      res.json(data);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid filters' });
      console.error('Marketing campaigns error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/admin/marketing/conversions', requireAdmin, async (req, res) => {
    try {
      const raw = filtersSchema.parse(req.query);
      const data = await storage.getMarketingConversions(buildFilters(raw));
      res.json(data);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid filters' });
      console.error('Marketing conversions error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/admin/marketing/journey', requireAdmin, async (req, res) => {
    try {
      const journeyQuery = z.object({ visitorId: z.string().uuid() }).parse(req.query);
      const data = await storage.getVisitorJourney(journeyQuery.visitorId);
      if (!data) return res.status(404).json({ error: 'Visitor session not found' });
      res.json(data);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid visitorId' });
      console.error('Marketing journey error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
