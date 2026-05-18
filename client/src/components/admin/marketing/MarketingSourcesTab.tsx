import { useQuery } from '@tanstack/react-query';
import { BarChart2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import {
  buildMarketingQueryParams,
  type MarketingFilters,
} from '@/components/admin/marketing/utils';
import type { MarketingBySource } from '@shared/marketing-types';

export interface MarketingSourcesTabProps {
  filters: MarketingFilters;
}

const formatRate = (rate: number, visits: number) =>
  visits === 0 ? '—' : `${(rate * 100).toFixed(1)}%`;

export function MarketingSourcesTab({ filters }: MarketingSourcesTabProps) {
  const { data: rows = [], isLoading, isError, refetch } = useQuery<MarketingBySource[]>({
    queryKey: ['/api/admin/marketing/sources', filters],
    queryFn: async () => {
      const params = buildMarketingQueryParams(filters);
      const res = await apiRequest('GET', `/api/admin/marketing/sources${params}`);
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
              <BarChart2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-bold mb-2">No traffic sources tracked yet</h3>
            <p className="text-sm text-muted-foreground">
              When visitors land on your site, their source is automatically detected. Share your site link to see data here.
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
          <table className="w-full text-sm" data-testid="marketing-sources-table">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">Visits</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">Leads</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">HOT</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">WARM</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">COLD</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">Conv. Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.channel} className="border-b border-border hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.channel}</td>
                  <td className="px-4 py-3 text-right">{row.visits.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{row.leads.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{row.hotLeads}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{row.warmLeads}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className="bg-muted text-muted-foreground hover:bg-muted">{row.coldLeads}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatRate(row.conversionRate, row.visits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
