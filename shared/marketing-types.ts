// shared/marketing-types.ts
// Aggregation result types for the Marketing admin section (v1.2 Phase 3-7).
// These types are NOT Drizzle-derived — they are query result shapes.
// Phase 3 defines the contract; Phase 4 implements the SQL that produces them.

import type { VisitorSession, AttributionConversion } from "./schema.js";

/**
 * Filter parameters accepted by every marketing query method.
 * Phase 4 will enforce a default 30-day window and 90-day max at the route layer
 * (see STATE.md "Server enforces default date range" constraint).
 */
export interface MarketingFilters {
  from?: Date;
  to?: Date;
  channel?: string;   // e.g., "Organic Search", "Paid Ads", "Social Media"
  campaign?: string;
}

/**
 * Overview tab aggregate (DASH-02 will consume this in Phase 6).
 */
export interface MarketingOverview {
  totalVisits: number;
  totalLeads: number;
  conversionRate: number;       // leads / visits, 0..1 (Phase 6 multiplies by 100 for %)
  topSource: string | null;
  topCampaign: string | null;
  topLandingPage: string | null;
  timeSeries: Array<{
    date: string;               // ISO date (YYYY-MM-DD), one row per day in the filter window
    visits: number;
    conversions: number;
  }>;
}

/**
 * Sources tab row — one row per traffic channel (DASH-03 in Phase 6).
 */
export interface MarketingBySource {
  channel: string;              // "Organic Search" | "Paid Ads" | "Social Media" | "Referral" | "Direct" | "Unknown"
  visits: number;
  leads: number;
  hotLeads: number;             // form_leads.classificacao = 'quente'
  warmLeads: number;            // 'morno'
  coldLeads: number;            // 'frio'
  conversionRate: number;       // leads / visits
}

/**
 * Campaigns tab row — one row per unique campaign (DASH-04 in Phase 6).
 */
export interface MarketingByCampaign {
  campaign: string;
  source: string;
  channel: string;
  visits: number;
  leads: number;
  conversionRate: number;
  topLandingPages: string[];    // top 3 landing pages used by this campaign
}

/**
 * Journey tab payload — full visit history for a single visitor (DASH-06 in Phase 7).
 * Returned by getVisitorJourney(visitorId).
 */
export interface VisitorJourney {
  session: VisitorSession;
  conversions: AttributionConversion[];
}
