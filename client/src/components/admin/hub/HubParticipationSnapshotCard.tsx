import { ExternalLink, Users } from 'lucide-react';

import { AdminCard, EmptyState } from '../shared';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from '@/components/ui/loader';
import type { HubLiveSummary } from '@shared/schema';
import type { HubLiveDetail } from './hubTypes';

export type HubParticipationSnapshotCardProps = {
  selectedId: number | null;
  detail: HubLiveDetail | undefined;
  isLoading: boolean;
  isFetching: boolean;
  selectedLive: HubLiveSummary | null;
};

export function HubParticipationSnapshotCard(props: HubParticipationSnapshotCardProps): JSX.Element {
  const { selectedId, detail, isLoading, isFetching, selectedLive } = props;

  return (
    <AdminCard className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Participation snapshot</h3>
          <p className="text-sm text-muted-foreground">Quick view of who registered for the selected live and how often the link was accessed.</p>
        </div>
        {isFetching ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : null}
      </div>

      {!selectedId ? (
        <EmptyState title="Select a live" description="Choose a Skale Hub live to inspect registrations and access events." icon={<Users />} />
      ) : isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : detail ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Registrations</p>
              <p className="mt-2 text-2xl font-semibold">{detail.live.registrationCount}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Link access</p>
              <p className="mt-2 text-2xl font-semibold">{detail.live.grantedAccessCount}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Denied attempts</p>
              <p className="mt-2 text-2xl font-semibold">{detail.live.deniedAccessCount}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">Recent registrations</p>
              <Badge variant="outline">{detail.registrations.length} people</Badge>
            </div>

            {detail.registrations.length === 0 ? (
              <EmptyState title="No registrations yet" description="Once visitors complete the Skale Hub gate, they will appear here." />
            ) : (
              <div className="space-y-2">
                {detail.registrations.slice(0, 6).map((registration) => (
                  <div key={registration.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{registration.participant.fullName}</p>
                      <p className="text-sm text-muted-foreground">{registration.participant.phoneRaw || 'No phone'} {registration.participant.emailRaw ? `• ${registration.participant.emailRaw}` : ''}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{registration.status}</Badge>
                      <Badge variant="outline">{registration.grantedAccessCount} accesses</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedLive?.streamUrl ? (
            <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-4">
              <p className="text-sm font-medium text-foreground">Live destination</p>
              <a href={selectedLive.streamUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                <ExternalLink className="w-4 h-4" />
                Open live link
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </AdminCard>
  );
}
