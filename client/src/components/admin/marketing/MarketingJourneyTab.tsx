import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { TrendingUp, Globe, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import { channelLabel } from '@/components/admin/marketing/utils';
import type { VisitorJourney } from '@shared/marketing-types';
import type { AttributionConversion } from '@shared/schema';

// Business labels for real conversion events (mirrors MarketingConversionsTab CONVERSION_LABELS — D-16/DASH-07).
// page_view is rendered with the pagePath itself, NOT a label.
const CONVERSION_LABELS: Record<string, string> = {
  lead_created: 'Lead Created',
  phone_click: 'Phone Call',
  form_submitted: 'Form Submitted',
  booking_started: 'Booking Started',
};

export interface MarketingJourneyTabProps {
  selectedVisitorUuid: string | null;
}

// Local type widening — the schema union omits 'page_view' but the DB column is plain text (Pitfall 1).
// Same pattern as MarketingConversionsTab.tsx line 56.
type ConversionRow = Omit<AttributionConversion, 'conversionType'> & { conversionType: string };

export function MarketingJourneyTab({ selectedVisitorUuid }: MarketingJourneyTabProps) {
  const { data, isLoading, isError, refetch } = useQuery<VisitorJourney>({
    queryKey: ['/api/admin/marketing/journey', selectedVisitorUuid],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/admin/marketing/journey?visitorId=${selectedVisitorUuid}`);
      return res.json();
    },
    enabled: !!selectedVisitorUuid, // Pitfall 6 — never fire when no visitor selected
    staleTime: 30_000,
  });

  // D-04 empty state — no visitor selected
  if (!selectedVisitorUuid) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-8 px-6">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-bold mb-2">Pick a visitor to see their journey</h3>
            <p className="text-sm text-muted-foreground">
              Select a visitor from the Conversions tab to view their journey.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading skeletons — 6 rows (matches MarketingConversionsTab loading pattern)
  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // Error state — same shape as MarketingConversionsTab
  if (isError || !data) {
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

  const { session, conversions } = data;
  const widenedConversions = conversions as ConversionRow[];

  return (
    <div className="space-y-4 pt-4" data-testid="marketing-journey-tab">
      {/* Session summary card — D-07 */}
      <Card>
        <CardContent className="pt-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="journey-session-card">
          <div className="p-3 rounded-lg border border-border bg-muted/40">
            <p className="text-xs uppercase text-muted-foreground">First Source</p>
            <p className="text-sm font-medium text-foreground break-words">
              {channelLabel(session.ftSourceChannel)}
            </p>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/40">
            <p className="text-xs uppercase text-muted-foreground">Campaign</p>
            <p className="text-sm font-medium text-foreground break-words">
              {session.ftCampaign || '—'}
            </p>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/40">
            <p className="text-xs uppercase text-muted-foreground">Entry Page</p>
            <p className="text-sm font-medium text-foreground break-words">
              {session.ftLandingPage || '/'}
            </p>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/40">
            <p className="text-xs uppercase text-muted-foreground">Total Events</p>
            <p className="text-sm font-medium text-foreground">
              {String(widenedConversions.length)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Vertical timeline — D-06, D-08, D-09 */}
      {widenedConversions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <p className="text-sm text-muted-foreground">No events recorded for this visitor yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 pb-4" data-testid="journey-timeline">
            <ol className="space-y-0">
              {widenedConversions.map((event, idx) => {
                const isPageView = event.conversionType === 'page_view';
                const isLast = idx === widenedConversions.length - 1;
                const convertedAtStr = typeof event.convertedAt === 'string'
                  ? event.convertedAt
                  : (event.convertedAt as Date).toISOString();
                const label = isPageView
                  ? (event.pagePath && event.pagePath.trim() ? event.pagePath : '/')
                  : (CONVERSION_LABELS[event.conversionType] ?? event.conversionType);
                return (
                  <li key={event.id} className="flex gap-3 items-start" data-testid={`journey-event-${event.id}`}>
                    <div className="flex flex-col items-center">
                      <div
                        className={
                          isPageView
                            ? 'h-8 w-8 rounded-full bg-muted flex items-center justify-center'
                            : 'h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center'
                        }
                      >
                        {isPageView
                          ? <Globe className="h-4 w-4 text-muted-foreground" />
                          : <Zap className="h-4 w-4 text-primary" />}
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />}
                    </div>
                    <div className="pb-4 flex-1 min-w-0">
                      <p className={isPageView ? 'text-sm text-foreground truncate' : 'text-sm font-semibold text-foreground'}>
                        {label}
                      </p>
                      <p
                        className="text-xs text-muted-foreground"
                        title={convertedAtStr}
                      >
                        {formatDistanceToNow(new Date(convertedAtStr), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
