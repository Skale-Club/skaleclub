import { CalendarDays, CheckCircle2, RefreshCcw } from 'lucide-react';

import { AdminCard, EmptyState } from '../shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from '@/components/ui/loader';
import type { HubLiveSummary } from '@shared/schema';

function statusBadge(status: string) {
  if (status === 'live') return 'success';
  if (status === 'ended') return 'secondary';
  if (status === 'cancelled') return 'destructive';
  return 'outline';
}

export type HubLiveLineupCardProps = {
  lives: HubLiveSummary[] | undefined;
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (live: HubLiveSummary) => void;
  onEdit: (live: HubLiveSummary) => void;
  onActivate: (id: number) => void;
  onRefresh: () => void;
  isActivating: boolean;
};

export function HubLiveLineupCard(props: HubLiveLineupCardProps): JSX.Element {
  const { lives, isLoading, selectedId, onSelect, onEdit, onActivate, onRefresh } = props;

  return (
    <AdminCard className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Live lineup</h3>
          <p className="text-sm text-muted-foreground">Select a live to edit or review quick participation counts.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onRefresh}>
          <RefreshCcw className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : !lives?.length ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No Skale Hub lives yet"
          description="Create the first weekly live so visitors can register before accessing the session link."
        />
      ) : (
        <div className="space-y-3">
          {lives.map((live) => {
            const isSelected = selectedId === live.id;
            return (
              <div
                key={live.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(live)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(live);
                  }
                }}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted/40'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{live.title}</p>
                      <Badge variant={statusBadge(live.status) as any}>{live.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">/{live.slug}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(live);
                      }}
                    >
                      Edit
                    </Button>
                    {live.status !== 'live' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={(event) => {
                          event.stopPropagation();
                          onActivate(live.id);
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Activate
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div className="rounded-xl bg-muted/40 px-3 py-2">
                    <p className="font-semibold text-foreground">{live.registrationCount}</p>
                    <p>Registrations</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 px-3 py-2">
                    <p className="font-semibold text-foreground">{live.grantedAccessCount}</p>
                    <p>Access granted</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 px-3 py-2">
                    <p className="font-semibold text-foreground">{live.uniqueParticipantCount}</p>
                    <p>Participants</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminCard>
  );
}
