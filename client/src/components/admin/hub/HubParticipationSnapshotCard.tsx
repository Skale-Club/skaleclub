import { useEffect, useState } from 'react';
import { Download, ExternalLink, Users } from 'lucide-react';

import { AdminCard, EmptyState } from '../shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from '@/components/ui/loader';
import type { HubLiveSummary } from '@shared/schema';
import type { HubLiveDetail } from './hubTypes';
import { csvFilenameSlug, downloadCsv, toIsoCell } from './hubExport';
import { formatInZone } from './hubTime';

const REGISTRATIONS_COLLAPSED = 6;
const EVENTS_COLLAPSED = 8;

function eventReason(metadata: unknown): string | null {
  if (metadata && typeof metadata === 'object' && 'reason' in metadata) {
    const reason = (metadata as Record<string, unknown>).reason;
    return typeof reason === 'string' && reason ? reason : null;
  }
  return null;
}

export type HubParticipationSnapshotCardProps = {
  selectedId: number | null;
  detail: HubLiveDetail | undefined;
  isLoading: boolean;
  isFetching: boolean;
  selectedLive: HubLiveSummary | null;
};

export function HubParticipationSnapshotCard(props: HubParticipationSnapshotCardProps): JSX.Element {
  const { selectedId, detail, isLoading, isFetching, selectedLive } = props;
  const [showAllRegistrations, setShowAllRegistrations] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const timeZone = detail?.live.timezone ?? selectedLive?.timezone ?? 'UTC';

  useEffect(() => {
    setShowAllRegistrations(false);
    setShowAllEvents(false);
  }, [selectedId]);

  const exportRegistrations = () => {
    if (!detail?.registrations.length) return;
    downloadCsv(
      `skale-hub-${csvFilenameSlug(detail.live.slug)}-registrations.csv`,
      ['Name', 'Phone', 'Email', 'Status', 'Registered at', 'Accesses', 'Denied attempts', 'Last access'],
      detail.registrations.map((registration) => [
        registration.participant.fullName,
        registration.participant.phoneRaw,
        registration.participant.emailRaw,
        registration.status,
        toIsoCell(registration.registeredAt),
        registration.grantedAccessCount,
        registration.deniedAccessCount,
        toIsoCell(registration.lastAccessAt),
      ]),
    );
  };

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
              <div className="flex items-center gap-2">
                <Badge variant="outline">{detail.registrations.length} people</Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={exportRegistrations}
                  disabled={!detail.registrations.length}
                  data-testid="button-hub-export-registrations"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              </div>
            </div>

            {detail.registrations.length === 0 ? (
              <EmptyState title="No registrations yet" description="Once visitors complete the Skale Hub gate, they will appear here." />
            ) : (
              <div className="space-y-2">
                {(showAllRegistrations ? detail.registrations : detail.registrations.slice(0, REGISTRATIONS_COLLAPSED)).map((registration) => (
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
                {detail.registrations.length > REGISTRATIONS_COLLAPSED ? (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllRegistrations((current) => !current)}
                      data-testid="button-hub-toggle-registrations"
                    >
                      {showAllRegistrations ? 'Show fewer' : `Show all (${detail.registrations.length})`}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">Recent access events</p>
              <Badge variant="outline">{detail.accessEvents?.length ?? 0} events</Badge>
            </div>

            {!detail.accessEvents?.length ? (
              <p className="text-sm text-muted-foreground">No access events recorded for this live yet.</p>
            ) : (
              <div className="divide-y divide-border rounded-2xl border border-border bg-background">
                {(showAllEvents ? detail.accessEvents : detail.accessEvents.slice(0, EVENTS_COLLAPSED)).map((event) => {
                  const reason = eventReason(event.metadata);
                  return (
                    <div key={event.id} className="flex flex-col gap-1 px-4 py-2 text-xs sm:flex-row sm:items-center sm:justify-between" data-testid={`row-hub-access-event-${event.id}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={event.outcome === 'granted' ? 'success' : 'destructive'}>{event.outcome}</Badge>
                        <span className="font-medium text-foreground">{event.eventType}</span>
                        <span className="text-muted-foreground">matched by {event.matchedBy}</span>
                        {reason ? <span className="text-muted-foreground">({reason})</span> : null}
                      </div>
                      <span className="text-muted-foreground">{formatInZone(event.createdAt, timeZone)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {detail.accessEvents && detail.accessEvents.length > EVENTS_COLLAPSED ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllEvents((current) => !current)}
                  data-testid="button-hub-toggle-events"
                >
                  {showAllEvents ? 'Show fewer' : `Show all (${detail.accessEvents.length})`}
                </Button>
              </div>
            ) : null}
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
