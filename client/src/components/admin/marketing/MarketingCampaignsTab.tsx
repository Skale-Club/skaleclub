import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import {
  buildMarketingQueryParams,
  type MarketingFilters,
} from '@/components/admin/marketing/utils';
import type { MarketingByCampaign } from '@shared/marketing-types';

export interface MarketingCampaignsTabProps {
  filters: MarketingFilters;
}

function renderCampaignCell(campaign: string | null | undefined) {
  const trimmed = (campaign ?? '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') {
    return <span className="italic text-muted-foreground">Direct / Untagged</span>;
  }
  return <span className="font-medium">{trimmed}</span>;
}

const formatRate = (rate: number, visits: number) =>
  visits === 0 ? '—' : `${(rate * 100).toFixed(1)}%`;

const renderTopLanding = (pages: string[]) =>
  pages.length === 0 ? '—' : pages[0];

export function MarketingCampaignsTab({ filters }: MarketingCampaignsTabProps) {
  const { data: rows = [], isLoading, isError, refetch } = useQuery<MarketingByCampaign[]>({
    queryKey: ['/api/admin/marketing/campaigns', filters],
    queryFn: async () => {
      const params = buildMarketingQueryParams(filters);
      const res = await apiRequest('GET', `/api/admin/marketing/campaigns${params}`);
      return res.json();
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

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

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-8 px-6">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-bold mb-2">No campaign data yet</h3>
            <p className="text-sm text-muted-foreground">
              Tag your ad links with a campaign name to track which campaigns send the most leads.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="marketing-campaigns-table">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left  text-xs font-bold uppercase tracking-wide text-muted-foreground">Campaign</th>
                <th className="px-4 py-3 text-left  text-xs font-bold uppercase tracking-wide text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-left  text-xs font-bold uppercase tracking-wide text-muted-foreground">Channel</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">Visits</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">Leads</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">Conv. Rate</th>
                <th className="px-4 py-3 text-left  text-xs font-bold uppercase tracking-wide text-muted-foreground">Top Landing Page</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={`${row.campaign}-${row.source}-${idx}`}
                  className="border-b border-border hover:bg-muted/40 transition-colors"
                >
                  <td className="px-4 py-3">{renderCampaignCell(row.campaign)}</td>
                  <td className="px-4 py-3">{row.source || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.channel || '—'}</td>
                  <td className="px-4 py-3 text-right">{row.visits.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{row.leads.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatRate(row.conversionRate, row.visits)}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[260px]" title={renderTopLanding(row.topLandingPages)}>
                    {renderTopLanding(row.topLandingPages)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
