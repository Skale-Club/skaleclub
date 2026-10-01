import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminCard } from '@/components/admin/shared';
import type { SmartTagOverview } from '@shared/smartTagsApi';
import { formatDateTime, getJson, percent, SMART_TAGS_KEY, STALE_MS } from './api';
import { destinationLabel, MetricCard } from './shared';

const EVENT_LABELS: Record<string, string> = {
  redirect: 'Opened destination',
  inventory_scan: 'Scanned while not activated',
  disabled_scan: 'Scanned while disabled',
  misconfigured_scan: 'Scanned — destination invalid',
};

export function OverviewTab({ onOpenTag }: { onOpenTag: (id: string) => void }) {
  const { data, isLoading, isError } = useQuery<SmartTagOverview>({
    queryKey: [SMART_TAGS_KEY, 'overview'],
    queryFn: () => getJson('/api/admin/smart-tags/overview'),
    staleTime: STALE_MS,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }
  if (isError || !data) return <p className="text-sm text-destructive">Could not load the overview.</p>;

  const { counts, interactions, split30 } = data;
  const split = split30.qr + split30.nfc;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total tags" value={counts.total} helper={`${counts.retired} retired`} />
        <MetricCard label="Active" value={counts.active} />
        <MetricCard label="Inventory / unassigned" value={counts.inventory} helper={`${counts.assigned} assigned, not live`} />
        <MetricCard label="Disabled" value={counts.disabled} />
        <MetricCard label="Interactions today" value={interactions.today} helper="UTC day" />
        <MetricCard label="Last 7 days" value={interactions.last7} />
        <MetricCard label="Last 30 days" value={interactions.last30} helper={`QR ${percent(split30.qr, split)} · NFC ${percent(split30.nfc, split)}`} />
        <MetricCard label="Approx. unique (30d)" value={data.approxUnique30} helper="Estimate, not people" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard padding="compact">
          <p className="mb-3 text-sm font-semibold">Latest scans & taps</p>
          {data.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scans yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {data.recentEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                  <button type="button" className="min-w-0 text-left" onClick={() => onOpenTag(e.tagId)}>
                    <span className="font-mono font-semibold">{e.publicCode}</span>
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs uppercase">{e.accessMethod}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {e.customerName ?? 'No customer'} · {EVENT_LABELS[e.eventType] ?? e.eventType}
                    </span>
                  </button>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(e.occurredAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <div className="space-y-4">
          <AdminCard padding="compact">
            <p className="mb-3 text-sm font-semibold">Recently activated</p>
            {data.recentActivations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active tags yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {data.recentActivations.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                    <button type="button" className="min-w-0 truncate text-left" onClick={() => onOpenTag(a.id)}>
                      <span className="font-mono font-semibold">{a.publicCode}</span>
                      <span className="ml-2 text-muted-foreground">{a.customerName ?? '—'}</span>
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.activatedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard padding="compact">
            <p className="mb-3 text-sm font-semibold">Recent destination changes</p>
            {data.recentChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {data.recentChanges.map((c) => (
                  <li key={c.id} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" className="font-mono font-semibold" onClick={() => onOpenTag(c.tagId)}>
                        {c.publicCode}
                      </button>
                      <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.newUrl ? `${destinationLabel(c.newDestinationType)} · ${c.newUrl}` : `Destination cleared${c.reason ? ` (${c.reason})` : ''}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
