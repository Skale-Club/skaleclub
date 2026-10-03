import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Archive, Bot, Check, ClipboardList, Cog, History, Plus, User } from 'lucide-react';
import { AdminCard, EmptyState } from '@/components/admin/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  JOURNEY_ENTRY_KIND_LABELS,
  PLAN_KIND_LABELS,
  isClosedPlanStatus,
  type JourneyEntryKind,
  type PlanKind,
} from '@shared/smartTagJourney';
import type { SmartTagJourney, SmartTagJourneyEntryItem, SmartTagPlanItem } from '@shared/smartTagsApi';
import { errorMessage, formatDate, formatDateTime, getJson, invalidateSmartTags, sendJson, SMART_TAGS_KEY, STALE_MS, withQuery } from './api';
import { NewEntryDialog, NewPlanDialog, PlanStatusDialog, planStatusLabel, type JourneyScope } from './JourneyForms';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

const KIND_VARIANT: Record<JourneyEntryKind, BadgeVariant> = {
  execution: 'secondary',
  decision: 'default',
  insight: 'outline',
  observation: 'outline',
  risk: 'warning',
  result: 'success',
};

const PLAN_VARIANT: Record<string, BadgeVariant> = {
  draft: 'outline',
  active: 'default',
  paused: 'secondary',
  validated: 'success',
  done: 'success',
  invalidated: 'destructive',
  cancelled: 'outline',
};

export function useJourney(scope: JourneyScope & { kind?: string; includeArchived?: boolean }) {
  return useQuery<SmartTagJourney>({
    queryKey: [SMART_TAGS_KEY, 'journey', scope],
    queryFn: () =>
      getJson(withQuery('/api/admin/smart-tag-journey', {
        batchId: scope.batchId,
        tagId: scope.tagId,
        customerId: scope.customerId,
        kind: scope.kind,
        includeArchived: scope.includeArchived ? '1' : undefined,
        limit: '300',
      })),
    staleTime: STALE_MS,
  });
}

function ActorLabel({ entry }: { entry: SmartTagJourneyEntryItem }) {
  const Icon = entry.actor === 'ai' ? Bot : entry.actor === 'human' ? User : Cog;
  const who = entry.actor === 'ai' ? 'AI (MCP)' : entry.actor === 'human' ? entry.actorEmail ?? 'admin' : 'system';
  return <span className="inline-flex items-center gap-1"><Icon className="h-3 w-3" />{who}</span>;
}

/** Scalar metadata as key: value chips (files, minutes, grams, checks). */
function MetadataChips({ metadata }: { metadata: Record<string, unknown> }) {
  const items = Object.entries(metadata).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {items.slice(0, 12).map(([k, v]) => (
        <span key={k} className="max-w-full truncate rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground" title={`${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`}>
          {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
        </span>
      ))}
    </div>
  );
}

function EntryRow({ entry, showScope }: { entry: SmartTagJourneyEntryItem; showScope: boolean }) {
  const { toast } = useToast();
  const review = useMutation({
    mutationFn: (status: string) => sendJson('PATCH', `/api/admin/smart-tag-journey/${entry.id}`, { status }),
    onSuccess: () => invalidateSmartTags(),
    onError: (err) => toast({ title: 'Could not update entry', description: errorMessage(err), variant: 'destructive' }),
  });
  const kind = entry.kind as JourneyEntryKind;
  const dimmed = entry.status === 'archived' || entry.status === 'superseded';
  return (
    <li className={cn('relative space-y-1 py-3 pl-5', dimmed && 'opacity-60')} data-testid="journey-entry">
      <span className="absolute left-0 top-[1.15rem] h-2 w-2 rounded-full bg-cta" aria-hidden />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={KIND_VARIANT[kind] ?? 'outline'}>{JOURNEY_ENTRY_KIND_LABELS[kind] ?? entry.kind}</Badge>
        {entry.action ? <span className="font-mono text-[11px] text-muted-foreground">{entry.action}</span> : null}
        {entry.status !== 'active' ? <Badge variant={entry.status === 'needs_review' ? 'warning' : 'outline'}>{entry.status.replace('_', ' ')}</Badge> : null}
      </div>
      <p className="font-medium">{entry.title}</p>
      {entry.beforeValue || entry.afterValue ? (
        <p className="break-all text-sm">
          {entry.beforeValue ? (
            <>
              <span className="text-muted-foreground">{entry.beforeValue}</span>
              <span className="mx-1">→</span>
            </>
          ) : null}
          <span>{entry.afterValue ?? '—'}</span>
        </p>
      ) : null}
      {entry.content ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{entry.content}</p> : null}
      <MetadataChips metadata={entry.metadata} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{formatDateTime(entry.occurredAt)}</span>
        <ActorLabel entry={entry} />
        {showScope && entry.batchCode ? <span className="font-mono">{entry.batchCode}</span> : null}
        {showScope && entry.publicCode ? <span className="font-mono">{entry.publicCode}{entry.serialNumber ? ` #${entry.serialNumber}` : ''}</span> : null}
        {entry.customerName ? <span>{entry.customerName}</span> : null}
        {entry.planTitle ? <span className="inline-flex items-center gap-1"><ClipboardList className="h-3 w-3" />{entry.planTitle}</span> : null}
        <span className="ml-auto flex gap-1">
          {entry.status === 'needs_review' ? (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => review.mutate('active')} disabled={review.isPending}>
              <Check className="mr-1 h-3 w-3" />Approve
            </Button>
          ) : null}
          {!dimmed ? (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => review.mutate('archived')} disabled={review.isPending}>
              <Archive className="mr-1 h-3 w-3" />Archive
            </Button>
          ) : null}
        </span>
      </div>
    </li>
  );
}

function PlanList({ plans, onOpen }: { plans: SmartTagPlanItem[]; onOpen: (plan: SmartTagPlanItem) => void }) {
  if (plans.length === 0) return <p className="text-sm text-muted-foreground">No plans yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {plans.map((p) => (
        <li key={p.id}>
          <button type="button" onClick={() => onOpen(p)} className={cn('w-full space-y-1 py-2.5 text-left', isClosedPlanStatus(p.status) && 'opacity-70')}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={PLAN_VARIANT[p.status] ?? 'outline'}>{planStatusLabel(p.status)}</Badge>
              <span className="text-xs text-muted-foreground">{PLAN_KIND_LABELS[p.kind as PlanKind] ?? p.kind}</span>
              {p.dueDate ? <span className="text-xs text-muted-foreground">due {formatDate(`${p.dueDate}T12:00:00`)}</span> : null}
            </div>
            <p className="text-sm font-medium">{p.title}</p>
            {p.outcome ? <p className="text-xs text-muted-foreground">{p.outcome}</p> : null}
            {p.batchCode || p.publicCode ? (
              <p className="font-mono text-[11px] text-muted-foreground">{[p.batchCode, p.publicCode].filter(Boolean).join(' · ')}</p>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Day headings over a newest-first list. */
function groupByDay(entries: SmartTagJourneyEntryItem[]) {
  const groups: Array<{ day: string; entries: SmartTagJourneyEntryItem[] }> = [];
  for (const e of entries) {
    const day = formatDate(e.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(e);
    else groups.push({ day, entries: [e] });
  }
  return groups;
}

/**
 * The journey of one scope (a batch, a tag, a customer, or everything): the
 * timeline on the left, the plans on the right, and buttons to add to both.
 */
export function JourneyPanel({
  scope,
  kind,
  includeArchived,
  title = 'Journey',
}: {
  scope: JourneyScope;
  kind?: string;
  includeArchived?: boolean;
  title?: string;
}) {
  const [entryOpen, setEntryOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [plan, setPlan] = useState<SmartTagPlanItem | null>(null);
  const { data, isLoading, isError } = useJourney({ ...scope, kind, includeArchived });
  const scoped = !!(scope.batchId || scope.tagId || scope.customerId);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]" data-testid="smart-tags-journey">
      <AdminCard padding="compact">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4" />{title}</p>
          <Button size="sm" variant="outline" onClick={() => setEntryOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Record</Button>
        </div>
        {isLoading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : isError ? (
          <p className="text-sm text-destructive">Could not load the journey.</p>
        ) : !data || data.entries.length === 0 ? (
          <EmptyState icon={<History />} title="Nothing recorded yet" description="Batches, assignments, activations and NFC writes appear here as they happen; production steps and decisions are recorded from the MCP or with Record." className="p-8" />
        ) : (
          <div className="space-y-2">
            {groupByDay(data.entries).map((g) => (
              <section key={g.day}>
                <p className="sticky top-0 bg-card py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.day}</p>
                <ul className="divide-y divide-border border-l border-border">
                  {g.entries.map((e) => <EntryRow key={e.id} entry={e} showScope={!scope.tagId} />)}
                </ul>
              </section>
            ))}
          </div>
        )}
      </AdminCard>
      <AdminCard padding="compact" className="h-fit">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4" />Plans</p>
          <Button size="sm" variant="outline" onClick={() => setPlanOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Plan</Button>
        </div>
        {isLoading ? <Skeleton className="h-24 rounded-xl" /> : <PlanList plans={data?.plans ?? []} onOpen={setPlan} />}
        {!scoped ? null : <p className="mt-2 text-[11px] text-muted-foreground">New entries and plans are attached to this {scope.tagId ? 'tag' : scope.batchId ? 'batch' : 'customer'}.</p>}
      </AdminCard>
      <NewEntryDialog open={entryOpen} onOpenChange={setEntryOpen} scope={scope} />
      <NewPlanDialog open={planOpen} onOpenChange={setPlanOpen} scope={scope} />
      <PlanStatusDialog plan={plan} onOpenChange={(v) => !v && setPlan(null)} />
    </div>
  );
}
