import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
import {
  buildMarketingQueryParams,
  type MarketingFilters,
} from '@/components/admin/marketing/utils';
import type { MarketingOverview } from '@shared/marketing-types';

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface MarketingOverviewTabProps {
  filters: MarketingFilters;
}

export function MarketingOverviewTab({ filters }: MarketingOverviewTabProps) {
  const { data, isLoading, isError, refetch } = useQuery<MarketingOverview>({
    queryKey: ['/api/admin/marketing/overview', filters],
    queryFn: async () => {
      const params = buildMarketingQueryParams(filters);
      const res = await apiRequest('GET', `/api/admin/marketing/overview${params}`);
      return res.json();
    },
    staleTime: 30_000, // 30 seconds — overrides default Infinity
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 pt-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-8 px-6">
            <h3 className="text-base font-bold mb-2">Could not load marketing data</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Check your connection and try refreshing. If this persists, contact support.
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (data && data.totalVisits === 0 && data.timeSeries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-8 px-6">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-bold mb-2">No traffic data yet</h3>
            <p className="text-sm text-muted-foreground">
              Add UTM parameters to your ad links to start tracking visitors. Example:{' '}
              ?utm_source=google&amp;utm_medium=cpc
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loaded content ─────────────────────────────────────────────────────────

  // Format helpers
  const formatRate = (rate: number, visits: number) =>
    visits === 0 ? '—' : `${(rate * 100).toFixed(1)}%`;

  const formatRateHelper = (leads: number, visits: number) =>
    visits === 0 ? 'No visits yet' : `${leads} leads / ${visits} visits`;

  return (
    <div className="space-y-6 pt-4">
      {/* Row 1: Metric KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Total Visits"
          value={data!.totalVisits.toLocaleString()}
          helper="in the selected period"
        />
        <KpiCard
          label="Leads Generated"
          value={data!.totalLeads.toLocaleString()}
          helper="from all sources"
        />
        <KpiCard
          label="Conversion Rate"
          value={formatRate(data!.conversionRate, data!.totalVisits)}
          helper={formatRateHelper(data!.totalLeads, data!.totalVisits)}
        />
      </div>

      {/* Row 2: Descriptor KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Top Traffic Source"
          value={data!.topSource ?? '—'}
          helper="most visits in period"
        />
        <KpiCard
          label="Best Campaign"
          value={data!.topCampaign ?? 'None tagged yet'}
          helper="generated most leads"
        />
        <KpiCard
          label="Best Landing Page"
          value={data!.topLandingPage ?? '—'}
          helper="entry point for most visits"
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">
            Visits &amp; Conversions Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={data!.timeSeries}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="visits"
                name="Visits"
                stroke="#1C53A3"
                fill="#1C53A3"
                fillOpacity={0.15}
              />
              <Area
                type="monotone"
                dataKey="conversions"
                name="Conversions"
                stroke="#FFD700"
                fill="#FFD700"
                fillOpacity={0.20}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
