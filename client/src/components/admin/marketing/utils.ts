// client/src/components/admin/marketing/utils.ts
// Shared helpers for the Marketing admin section (Phase 6).
// Consumed by MarketingSection.tsx and all four tab components.

export type DatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'last_month' | 'custom';

export interface MarketingFilters {
  datePreset: DatePreset;
  dateFrom?: string; // ISO datetime string, only when datePreset === 'custom'
  dateTo?: string;   // ISO datetime string, only when datePreset === 'custom'
  source?: string;
  campaign?: string;
  conversionType?: string;
}

/**
 * Resolves a DatePreset (and optional custom dates) into concrete from/to Date objects.
 * - today      -> midnight today through now
 * - yesterday  -> midnight yesterday through end of yesterday
 * - 7d         -> 7 days ago through now
 * - 30d        -> 30 days ago through now (default; matches server-side default)
 * - month      -> first of this month through now
 * - last_month -> first through last day of previous month
 * - custom     -> uses customFrom / customTo (falls back to last 30 days if either is missing)
 */
export function resolveDateRange(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    }
    case 'yesterday': {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end };
    }
    case '7d':
      return { from: new Date(now.getTime() - 7 * 86_400_000), to: now };
    case '30d':
      return { from: new Date(now.getTime() - 30 * 86_400_000), to: now };
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end };
    }
    case 'custom':
      return {
        from: customFrom ? new Date(customFrom) : new Date(now.getTime() - 30 * 86_400_000),
        to: customTo ? new Date(customTo) : now,
      };
  }
}

/**
 * Converts MarketingFilters to a query string starting with '?'.
 * Always sets dateFrom + dateTo. Only sets source/campaign/conversionType when truthy.
 * Note: conversionType is sent to the server but is currently ignored by storage.ts —
 *       MarketingConversionsTab applies a client-side filter as a fallback.
 */
export function buildMarketingQueryParams(filters: MarketingFilters): string {
  const params = new URLSearchParams();
  const { from, to } = resolveDateRange(filters.datePreset, filters.dateFrom, filters.dateTo);
  params.set('dateFrom', from.toISOString());
  params.set('dateTo', to.toISOString());
  if (filters.source) params.set('source', filters.source);
  if (filters.campaign) params.set('campaign', filters.campaign);
  if (filters.conversionType) params.set('conversionType', filters.conversionType);
  return `?${params.toString()}`;
}

/**
 * Maps a raw traffic source string to a business-language channel label (D-15, D-16).
 * Single source of truth for source → label translation, used by:
 *   - MarketingJourneyTab session summary card
 *   - LeadsSection lead attribution panel
 *
 * Vocabulary ban (DASH-07): no `utm_*` field names ever surface in the UI.
 * Treats null/undefined/empty/whitespace and any unrecognized value as "Unknown".
 * Case-insensitive: "ORGANIC_SEARCH" and "organic_search" both map to "Organic Search".
 */
export function channelLabel(source: string | null | undefined): string {
  if (!source) return 'Unknown';
  const s = source.toLowerCase().trim();
  if (!s) return 'Unknown';
  if (s === 'organic_search') return 'Organic Search';
  if (s === 'paid_search' || s === 'paid_ads') return 'Paid Ads';
  if (s === 'social') return 'Social Media';
  if (s === 'referral') return 'Referral';
  if (s === 'direct') return 'Direct';
  return 'Unknown';
}
