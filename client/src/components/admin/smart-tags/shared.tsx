import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  SMART_TAG_DESTINATION_LABELS,
  SMART_TAG_DESTINATION_TYPES,
  SMART_TAG_PRODUCT_LABELS,
  SMART_TAG_PRODUCT_TYPES,
  type SmartTagDestinationType,
  type SmartTagProductType,
} from '@shared/smartTags';
import type { SmartTagAnalytics } from '@shared/smartTagsApi';
import { formatDateTime, getJson, percent, SMART_TAGS_KEY, STALE_MS, withQuery } from './api';

export const productLabel = (type: string | null | undefined) =>
  type ? SMART_TAG_PRODUCT_LABELS[type as SmartTagProductType] ?? type : '—';

export const destinationLabel = (type: string | null | undefined) =>
  type ? SMART_TAG_DESTINATION_LABELS[type as SmartTagDestinationType] ?? type : '—';

const STATUS_STYLES: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  inventory: { label: 'Inventory', variant: 'secondary' },
  assigned: { label: 'Assigned', variant: 'warning' },
  active: { label: 'Active', variant: 'success' },
  disabled: { label: 'Disabled', variant: 'destructive' },
  retired: { label: 'Retired', variant: 'outline' },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={style.variant} data-testid={`smart-tag-status-${status}`}>{style.label}</Badge>;
}

export function MetricCard({ label, value, helper, className }: { label: string; value: string | number; helper?: string; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

export type RangePreset = 'today' | '7d' | '30d' | '90d';

export const RANGE_PRESETS: ReadonlyArray<{ id: RangePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

export interface AnalyticsRange {
  preset: RangePreset | 'custom';
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

export function rangeParams(range: AnalyticsRange): Record<string, string | undefined> {
  if (range.preset !== 'custom') return { range: range.preset };
  return {
    from: range.from ? new Date(`${range.from}T00:00:00Z`).toISOString() : undefined,
    // inclusive end date → exclusive upper bound
    to: range.to ? new Date(new Date(`${range.to}T00:00:00Z`).getTime() + 86_400_000).toISOString() : undefined,
  };
}

export function RangePicker({ value, onChange }: { value: AnalyticsRange; onChange: (r: AnalyticsRange) => void }) {
  const [custom, setCustom] = useState({ from: value.from ?? '', to: value.to ?? '' });
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="smart-tags-range">
      {RANGE_PRESETS.map((p) => (
        <Button
          key={p.id}
          size="sm"
          variant={value.preset === p.id ? 'default' : 'outline'}
          onClick={() => onChange({ preset: p.id })}
        >
          {p.label}
        </Button>
      ))}
      <div className="flex items-center gap-1">
        <input
          type="date"
          aria-label="From"
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={custom.from}
          onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="date"
          aria-label="To"
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={custom.to}
          onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
        />
        <Button
          size="sm"
          variant={value.preset === 'custom' ? 'default' : 'outline'}
          disabled={!custom.from}
          onClick={() => onChange({ preset: 'custom', from: custom.from, to: custom.to || undefined })}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

/**
 * KPIs + daily QR/NFC chart for any scope. `scopeUrl` is the analytics endpoint
 * (global, or /:id/analytics for one tag); `scope` adds customer/batch/product filters.
 */
export function AnalyticsPanel({
  scopeUrl,
  scope = {},
  range,
  showTopTags = false,
  onOpenTag,
}: {
  scopeUrl: string;
  scope?: Record<string, string | undefined>;
  range: AnalyticsRange;
  showTopTags?: boolean;
  onOpenTag?: (id: string) => void;
}) {
  const url = withQuery(scopeUrl, { ...scope, ...rangeParams(range) });
  const { data, isLoading, isError } = useQuery<SmartTagAnalytics>({
    queryKey: [SMART_TAGS_KEY, 'analytics', url],
    queryFn: () => getJson(url),
    staleTime: STALE_MS,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (isError || !data) {
    return <p className="text-sm text-destructive">Could not load analytics.</p>;
  }

  const { totals } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Interactions" value={totals.interactions} helper="QR scans + NFC taps" />
        <MetricCard label="QR scans" value={totals.qr} helper={percent(totals.qr, totals.interactions)} />
        <MetricCard label="NFC taps" value={totals.nfc} helper={percent(totals.nfc, totals.interactions)} />
        <MetricCard label="Approx. unique interactions" value={totals.approxUnique} helper="Per tag, per day estimate" />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Interactions by day</p>
          <p className="text-xs text-muted-foreground">Last interaction: {formatDateTime(totals.lastInteractionAt)}</p>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.daily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="qr" name="QR scans" stackId="1" stroke="#1C53A3" fill="#1C53A3" fillOpacity={0.25} />
              <Area type="monotone" dataKey="nfc" name="NFC taps" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          An interaction is a QR scan or NFC tap that reached the destination. It is not a review, lead or customer.
          {totals.botHits > 0 ? ` ${totals.botHits} automated hit(s) excluded.` : ''}
          {totals.inactiveScans > 0 ? ` ${totals.inactiveScans} scan(s) while inactive.` : ''}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Devices</p>
          {data.devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interactions in this period.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.devices.map((d) => (
                <li key={d.deviceType} className="flex justify-between">
                  <span className="capitalize">{d.deviceType}</span>
                  <span className="tabular-nums text-muted-foreground">{d.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {showTopTags ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-sm font-semibold">Top tags</p>
            {data.topTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No interactions in this period.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {data.topTags.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="truncate text-left font-mono hover:underline"
                      onClick={() => onOpenTag?.(t.id)}
                    >
                      {t.publicCode}
                      {t.customerName ? <span className="ml-2 font-sans text-muted-foreground">{t.customerName}</span> : null}
                    </button>
                    <span className="shrink-0 tabular-nums text-muted-foreground">QR {t.qr} · NFC {t.nfc}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const ALL = '__all__'; // Select cannot hold an empty-string value

/** Compact select whose empty choice means "no filter". */
export function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
  testId,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  className?: string;
  testId?: string;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger className={cn('h-9 w-full sm:w-44', className)} data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const PRODUCT_OPTIONS = SMART_TAG_PRODUCT_TYPES.map((value) => ({ value, label: SMART_TAG_PRODUCT_LABELS[value] }));
export const DESTINATION_OPTIONS = SMART_TAG_DESTINATION_TYPES.map((value) => ({ value, label: SMART_TAG_DESTINATION_LABELS[value] }));
