import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import {
  buildMarketingQueryParams,
  type MarketingFilters,
} from '@/components/admin/marketing/utils';
import type { AttributionConversion } from '@shared/schema';

// Business labels for conversion types (D-27)
const CONVERSION_LABELS: Record<string, string> = {
  lead_created: 'Lead Created',
  phone_click: 'Phone Call',
  form_submitted: 'Form Submitted',
  booking_started: 'Booking Started',
  page_view: 'Page View', // never rendered — filtered out — kept for type completeness
};

// Pill color classes per conversion type (D-27, 06-UI-SPEC.md "Conversion event type pill colors")
const CONVERSION_PILL_CLASS: Record<string, string> = {
  lead_created: 'bg-green-100 text-green-800 hover:bg-green-100',
  phone_click: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  form_submitted: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  booking_started: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  page_view: 'bg-muted text-muted-foreground hover:bg-muted',
};

export interface MarketingConversionsTabProps {
  filters: MarketingFilters;
  onSelectVisitor?: (visitorUuid: string) => void;
}

export function MarketingConversionsTab({ filters, onSelectVisitor }: MarketingConversionsTabProps) {
  // Fetch all conversions — server returns up to 500 rows ordered by convertedAt desc.
  // Note: server ignores conversionType filter (Critical Finding: FILTER-04 storage gap).
  // Client-side filtering applied via useMemo below.
  const { data: allConversions = [], isLoading, isError, refetch } = useQuery<Array<AttributionConversion & { visitorUuid: string | null }>>({
    queryKey: ['/api/admin/marketing/conversions', filters],
    queryFn: async () => {
      const params = buildMarketingQueryParams(filters);
      const res = await apiRequest('GET', `/api/admin/marketing/conversions${params}`);
      return res.json();
    },
    staleTime: 30_000,
  });

  // FILTER-04 client-side: exclude page_view rows + apply conversionType filter.
  // D-29: cap at 25 most recent (server already orders by convertedAt desc).
  // Note: the schema type union omits 'page_view' (column is plain text so values CAN appear).
  // We widen to string[] before filtering so TypeScript accepts the comparison.
  const allConversionsWidened = allConversions as Array<Omit<AttributionConversion, 'conversionType'> & { conversionType: string; visitorUuid: string | null }>;
  const visibleConversions = useMemo(() => {
    return allConversionsWidened
      .filter((c) => c.conversionType !== 'page_view') // never show page_view
      .filter((c) => !filters.conversionType || c.conversionType === filters.conversionType)
      .slice(0, 25); // D-29: cap at 25 most recent
  }, [allConversionsWidened, filters.conversionType]);

  // Loading state — 6 row skeletons (Pattern 10)
  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // Error state — identical to other tabs (Pattern 12)
  if (isError) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-8 px-6">
            <h3 className="text-base font-bold mb-2">Could not load marketing data</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Check your connection and try refreshing. If this persists, contact support.
            </p>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state — when no rows match filters (D-30, DASH-08)
  if (visibleConversions.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-8 px-6">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-bold mb-2">No conversions tracked yet</h3>
            <p className="text-sm text-muted-foreground">
              When visitors submit the form, click your phone number, or start booking, their actions will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loaded table — 25 most recent conversions (Pattern 7, DASH-05)
  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="marketing-conversions-table">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">When</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Campaign</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Landing Page</th>
              </tr>
            </thead>
            <tbody>
              {visibleConversions.map((row) => {
                const label = CONVERSION_LABELS[row.conversionType] ?? row.conversionType;
                const pillClass = CONVERSION_PILL_CLASS[row.conversionType] ?? 'bg-muted text-muted-foreground hover:bg-muted';
                // Use ftCampaign (first-touch) per UI-SPEC "Columns to display in Conversions tab"
                const campaignText = row.ftCampaign && row.ftCampaign.trim() && row.ftCampaign !== 'Unknown'
                  ? row.ftCampaign
                  : null;
                // convertedAt comes as ISO string from the server JSON
                const convertedAtStr = typeof row.convertedAt === 'string'
                  ? row.convertedAt
                  : (row.convertedAt as Date).toISOString();
                const clickable = !!onSelectVisitor && row.visitorUuid != null;
                return (
                  <tr
                    key={row.id}
                    className={
                      clickable
                        ? 'border-b border-border hover:bg-muted/40 transition-colors cursor-pointer'
                        : 'border-b border-border hover:bg-muted/40 transition-colors'
                    }
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={clickable ? () => onSelectVisitor!(row.visitorUuid!) : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectVisitor!(row.visitorUuid!);
                            }
                          }
                        : undefined
                    }
                    data-testid={clickable ? `conversions-row-clickable-${row.id}` : `conversions-row-${row.id}`}
                  >
                    <td
                      className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap"
                      title={convertedAtStr}
                    >
                      {formatDistanceToNow(new Date(convertedAtStr), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={pillClass}>{label}</Badge>
                    </td>
                    <td className="px-4 py-3">{row.ftSource ?? '—'}</td>
                    <td className="px-4 py-3">
                      {campaignText
                        ? <span>{campaignText}</span>
                        : <span className="italic text-muted-foreground">Direct / Untagged</span>}
                    </td>
                    <td
                      className="px-4 py-3 text-muted-foreground truncate max-w-[260px]"
                      title={row.ftLandingPage ?? ''}
                    >
                      {row.ftLandingPage ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
