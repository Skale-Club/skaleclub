import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { db } from "../db.js";
import { visitorSessions } from "#shared/schema.js";
import { eq } from "drizzle-orm";

// ===== POST /api/attribution/session =====
// Accepts visitor UUID + UTM/referrer/landing fields and upserts a visitor_sessions row.
// Per source D-06: ZodError → 400 { error: string }; all other failures → 200 {} (never 500).
// Per source D-07/D-09: public endpoint, no auth required.
const sessionUpsertSchema = z.object({
  visitorId: z.string().uuid(),
  ftSource: z.string().trim().max(120).optional(),
  ftMedium: z.string().trim().max(120).optional(),
  ftCampaign: z.string().trim().max(120).optional(),
  ftTerm: z.string().trim().max(120).optional(),
  ftContent: z.string().trim().max(120).optional(),
  ftId: z.string().trim().max(120).optional(),
  ftSourceChannel: z.string().trim().max(40).optional(),
  ftLandingPage: z.string().trim().max(600).optional(),
  ftReferrer: z.string().trim().max(600).optional(),
  ltSource: z.string().trim().max(120).optional(),
  ltMedium: z.string().trim().max(120).optional(),
  ltCampaign: z.string().trim().max(120).optional(),
  ltTerm: z.string().trim().max(120).optional(),
  ltContent: z.string().trim().max(120).optional(),
  ltId: z.string().trim().max(120).optional(),
  ltSourceChannel: z.string().trim().max(40).optional(),
  ltLandingPage: z.string().trim().max(600).optional(),
  ltReferrer: z.string().trim().max(600).optional(),
  deviceType: z.string().trim().max(20).optional(),
  converted: z.boolean().optional(),
});

// ===== POST /api/attribution/conversion =====
// Accepts { visitorId, conversionType, pagePath?, leadId? }.
// Resolves UUID → integer FK from visitor_sessions; silently returns 200 {} if visitor not found.
// Per source D-06: ZodError → 400; missing visitor or any other failure → 200 {} (never 500).
const conversionSchema = z.object({
  visitorId: z.string().uuid(),
  conversionType: z.enum(['lead_created', 'phone_click', 'form_submitted', 'booking_started']),
  pagePath: z.string().trim().max(600).optional(),
  leadId: z.number().int().positive().optional(),
});

export function registerAttributionRoutes(app: Express): void {
  // POST /api/attribution/session
  // Upserts a visitor session row. First-touch columns are immutable after the initial INSERT
  // (enforced by upsertVisitorSession's ON CONFLICT logic in storage.ts).
  app.post('/api/attribution/session', async (req, res) => {
    try {
      const payload = sessionUpsertSchema.parse(req.body);
      await storage.upsertVisitorSession(payload as any);
      return res.status(200).json({});
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid session payload' });
      }
      // Silently discard non-validation errors so attribution never blocks the client.
      console.error('[attribution/session] silenced error:', err);
      return res.status(200).json({});
    }
  });

  // POST /api/attribution/conversion
  // Inserts an attribution_conversions row when the visitor session exists.
  // Returns 200 {} silently when the visitor session does not exist (D-06).
  // Denormalizes ft_*/lt_* from the visitor_sessions row at insert time so
  // dashboard/journey queries can GROUP BY source/campaign without a join.
  app.post('/api/attribution/conversion', async (req, res) => {
    try {
      const payload = conversionSchema.parse(req.body);

      // Resolve UUID → integer FK. If no visitor session exists, return 200 silently.
      const [session] = await db
        .select({
          id: visitorSessions.id,
          ftSource: visitorSessions.ftSource,
          ftMedium: visitorSessions.ftMedium,
          ftCampaign: visitorSessions.ftCampaign,
          ftLandingPage: visitorSessions.ftLandingPage,
          ltSource: visitorSessions.ltSource,
          ltMedium: visitorSessions.ltMedium,
          ltCampaign: visitorSessions.ltCampaign,
          ltLandingPage: visitorSessions.ltLandingPage,
        })
        .from(visitorSessions)
        .where(eq(visitorSessions.visitorId, payload.visitorId));

      if (!session) return res.status(200).json({});

      await storage.createAttributionConversion({
        visitorId: session.id,
        conversionType: payload.conversionType as any,
        leadId: payload.leadId ?? null,
        pagePath: payload.pagePath ?? null,
        ftSource: session.ftSource ?? null,
        ftMedium: session.ftMedium ?? null,
        ftCampaign: session.ftCampaign ?? null,
        ftLandingPage: session.ftLandingPage ?? null,
        ltSource: session.ltSource ?? null,
        ltMedium: session.ltMedium ?? null,
        ltCampaign: session.ltCampaign ?? null,
        ltLandingPage: session.ltLandingPage ?? null,
      });

      return res.status(200).json({});
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid conversion payload' });
      }
      // Never 500 for missing visitor or any DB error in attribution.
      console.error('[attribution/conversion] silenced error:', err);
      return res.status(200).json({});
    }
  });
}
