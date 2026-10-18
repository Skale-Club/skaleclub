import { useState } from 'react';
import { Download, Search, Users } from 'lucide-react';

import { AdminCard, EmptyState } from '../shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from '@/components/ui/loader';
import type { HubParticipantHistory } from '@shared/schema';
import { downloadCsv, toIsoCell } from './hubExport';

const COLLAPSED_COUNT = 8;

function ghlStatusBadge(status?: string | null) {
  if (status === 'synced') return 'success';
  if (status === 'failed') return 'destructive';
  if (status === 'skipped') return 'secondary';
  return 'outline';
}

export type HubParticipantHistoryCardProps = {
  history: HubParticipantHistory[] | undefined;
  isLoading: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
};

export function HubParticipantHistoryCard(props: HubParticipantHistoryCardProps): JSX.Element {
  const { history, isLoading, searchValue, onSearchChange } = props;
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? history : history?.slice(0, COLLAPSED_COUNT);

  const exportCsv = () => {
    if (!history?.length) return;
    downloadCsv(
      `skale-hub-participants-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'Phone', 'Email', 'Registrations', 'Lives accessed', 'Last access', 'GHL status'],
      history.map((participant) => [
        participant.fullName,
        participant.phoneRaw,
        participant.emailRaw,
        participant.registrationCount,
        participant.livesAccessedCount,
        toIsoCell(participant.lastAccessAt),
        participant.ghlSyncStatus || 'pending',
      ]),
    );
  };

  return (
    <AdminCard className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Participant history</h3>
          <p className="text-sm text-muted-foreground">Track repeat attendees, last live accessed, and contact details across all Skale Hub sessions.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:max-w-md">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by name, phone, or email"
              className="pl-9"
              data-testid="input-hub-participant-search"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2 shrink-0"
            onClick={exportCsv}
            disabled={!history?.length}
            data-testid="button-hub-export-participants"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : !history?.length ? (
        <EmptyState
          title="No participant history yet"
          description="Once visitors register and access Skale Hub lives, their history will appear here."
          icon={<Users />}
        />
      ) : (
        <div className="space-y-3">
          {(visible ?? []).map((participant) => (
            <div key={participant.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold text-foreground">{participant.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {participant.phoneRaw || 'No phone'}
                    {participant.emailRaw ? ` • ${participant.emailRaw}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{participant.registrationCount} registrations</Badge>
                  <Badge variant="outline">{participant.livesAccessedCount} lives accessed</Badge>
                  <Badge variant="outline">{participant.grantedAccessCount} granted</Badge>
                  <Badge
                    variant={ghlStatusBadge(participant.ghlSyncStatus) as any}
                    title={participant.ghlSyncError || undefined}
                  >
                    GHL: {participant.ghlSyncStatus || 'pending'}
                  </Badge>
                  {participant.ghlContactId ? <Badge variant="outline">GHL contact linked</Badge> : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Last live</p>
                  <p className="mt-1 font-medium">{participant.lastLive?.title || 'No live accessed yet'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Last access</p>
                  <p className="mt-1 font-medium">{participant.lastAccessAt ? new Date(participant.lastAccessAt).toLocaleDateString() : 'Never'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Last registration</p>
                  <p className="mt-1 font-medium">{participant.lastRegisteredAt ? new Date(participant.lastRegisteredAt).toLocaleDateString() : 'No registration'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Denied attempts</p>
                  <p className="mt-1 font-medium">{participant.deniedAccessCount}</p>
                </div>
              </div>
            </div>
          ))}
          {history.length > COLLAPSED_COUNT ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAll((current) => !current)}
                data-testid="button-hub-toggle-participants"
              >
                {showAll ? 'Show fewer' : `Show all (${history.length})`}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </AdminCard>
  );
}
