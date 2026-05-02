import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, ExternalLink, Plus, RadioTower, RefreshCcw, Save, Search, Users } from 'lucide-react';

import { AdminCard, EmptyState, SectionHeader } from './shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { HubAccessEvent, HubDashboardSummary, HubLiveSummary, HubParticipantHistory, HubRegistrationSummary } from '@shared/schema';

type HubStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';

type HubLiveDetail = {
  live: HubLiveSummary;
  registrations: HubRegistrationSummary[];
  accessEvents: HubAccessEvent[];
};

type LiveFormState = {
  id: number | null;
  slug: string;
  title: string;
  description: string;
  startsAt: string;
  timezone: string;
  streamUrl: string;
  replayUrl: string;
  status: HubStatus;
  capacity: string;
};

const EMPTY_FORM: LiveFormState = {
  id: null,
  slug: '',
  title: '',
  description: '',
  startsAt: '',
  timezone: 'America/New_York',
  streamUrl: '',
  replayUrl: '',
  status: 'scheduled',
  capacity: '',
};

const COMMON_TIMEZONES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'America/New_York', label: 'New York (ET)' },
  { value: 'America/Chicago', label: 'Chicago (CT)' },
  { value: 'America/Denver', label: 'Denver (MT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
  { value: 'Europe/London', label: 'London (UK)' },
  { value: 'UTC', label: 'UTC' },
];

function toDateTimeLocal(value?: string | Date | null) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function fromSummaryToForm(live: HubLiveSummary): LiveFormState {
  return {
    id: live.id,
    slug: live.slug,
    title: live.title,
    description: live.description ?? '',
    startsAt: toDateTimeLocal(live.startsAt),
    timezone: live.timezone,
    streamUrl: live.streamUrl ?? '',
    replayUrl: live.replayUrl ?? '',
    status: live.status as HubStatus,
    capacity: live.capacity == null ? '' : String(live.capacity),
  };
}

function statusBadge(status: string) {
  if (status === 'live') return 'success';
  if (status === 'ended') return 'secondary';
  if (status === 'cancelled') return 'destructive';
  return 'outline';
}

function ghlStatusBadge(status?: string | null) {
  if (status === 'synced') return 'success';
  if (status === 'failed') return 'destructive';
  if (status === 'skipped') return 'secondary';
  return 'outline';
}

export function SkaleHubSection() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<LiveFormState>(EMPTY_FORM);
  const [isLiveFormOpen, setIsLiveFormOpen] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');

  const dashboardQuery = useQuery<HubDashboardSummary>({
    queryKey: ['/api/skale-hub/dashboard'],
  });

  const participantHistoryQuery = useQuery<HubParticipantHistory[]>({
    queryKey: ['/api/skale-hub/participants', participantSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (participantSearch.trim()) {
        params.set('search', participantSearch.trim());
      }
      const url = params.toString()
        ? `/api/skale-hub/participants?${params.toString()}`
        : '/api/skale-hub/participants';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error((await response.text()) || 'Failed to load participants');
      }
      return response.json();
    },
  });

  const livesQuery = useQuery<HubLiveSummary[]>({
    queryKey: ['/api/skale-hub/lives'],
  });

  const selectedLive = useMemo(
    () => livesQuery.data?.find((live) => live.id === selectedId) ?? null,
    [livesQuery.data, selectedId],
  );

  const detailQuery = useQuery<HubLiveDetail>({
    queryKey: ['/api/skale-hub/lives', selectedId],
    queryFn: async () => {
      const response = await fetch(`/api/skale-hub/lives/${selectedId}`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error((await response.text()) || 'Failed to load Skale Hub live details');
      }
      return response.json();
    },
    enabled: selectedId != null,
  });

  useEffect(() => {
    if (!livesQuery.data?.length) {
      setSelectedId(null);
      return;
    }

    if (selectedId == null || !livesQuery.data.some((live) => live.id === selectedId)) {
      setSelectedId(livesQuery.data[0].id);
    }
  }, [livesQuery.data, selectedId]);

  useEffect(() => {
    if (isLiveFormOpen && selectedLive && form.id === selectedLive.id) {
      setForm(fromSummaryToForm(selectedLive));
    }
  }, [isLiveFormOpen, selectedLive, form.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        slug: form.slug,
        title: form.title,
        description: form.description || null,
        startsAt: new Date(form.startsAt).toISOString(),
        timezone: form.timezone,
        streamUrl: form.streamUrl || null,
        replayUrl: form.replayUrl || null,
        status: form.status,
        capacity: form.capacity ? Number(form.capacity) : null,
      };

      const response = form.id == null
        ? await apiRequest('POST', '/api/skale-hub/lives', payload)
        : await apiRequest('PUT', `/api/skale-hub/lives/${form.id}`, payload);

      return response.json() as Promise<HubLiveSummary>;
    },
    onSuccess: async (live) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/skale-hub/lives'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/skale-hub/dashboard'] }),
      ]);
      setSelectedId(live.id);
      setForm(fromSummaryToForm(live));
      setIsLiveFormOpen(false);
      toast({ title: form.id == null ? 'Live created' : 'Live updated' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Unable to save live',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (liveId: number) => {
      const response = await apiRequest('PUT', `/api/skale-hub/lives/${liveId}`, { status: 'live' });
      return response.json() as Promise<HubLiveSummary>;
    },
    onSuccess: async (live) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/skale-hub/lives'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/skale-hub/lives', live.id] }),
      ]);
      setSelectedId(live.id);
      toast({ title: 'Live activated' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Unable to activate live',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const canSave = form.slug.trim() && form.title.trim() && form.startsAt;

  const openCreateLiveDialog = () => {
    setForm(EMPTY_FORM);
    setIsLiveFormOpen(true);
  };

  const openEditLiveDialog = (live: HubLiveSummary) => {
    setSelectedId(live.id);
    setForm(fromSummaryToForm(live));
    setIsLiveFormOpen(true);
  };

  const dashboardCards = [
    {
      label: 'Total participants',
      value: dashboardQuery.data?.totalParticipants ?? 0,
      helper: `${dashboardQuery.data?.totalRegistrations ?? 0} registrations recorded`,
    },
    {
      label: 'Lives created',
      value: dashboardQuery.data?.totalLives ?? 0,
      helper: dashboardQuery.data?.activeLiveId ? `Active live #${dashboardQuery.data.activeLiveId}` : 'No live active right now',
    },
    {
      label: 'Access granted',
      value: dashboardQuery.data?.grantedAccessCount ?? 0,
      helper: `${dashboardQuery.data?.deniedAccessCount ?? 0} denied attempts`,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Skale Hub"
        description="Create weekly lives, update access links, and control which live is currently active."
        icon={<RadioTower className="w-5 h-5" />}
        action={
          <Button
            className="gap-2 border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
            onClick={openCreateLiveDialog}
          >
            <Plus className="w-4 h-4" />
            New live
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {dashboardCards.map((card) => (
          <AdminCard key={card.label} className="space-y-2" tone="muted">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            {dashboardQuery.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <>
                <p className="text-3xl font-semibold tracking-tight">{card.value}</p>
                <p className="text-sm text-muted-foreground">{card.helper}</p>
              </>
            )}
          </AdminCard>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <AdminCard className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Live lineup</h3>
              <p className="text-sm text-muted-foreground">Select a live to edit or review quick participation counts.</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => livesQuery.refetch()}>
              <RefreshCcw className="w-4 h-4" />
            </Button>
          </div>

          {livesQuery.isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
          ) : !livesQuery.data?.length ? (
            <EmptyState
              icon={<CalendarDays />}
              title="No Skale Hub lives yet"
              description="Create the first weekly live so visitors can register before accessing the session link."
            />
          ) : (
            <div className="space-y-3">
              {livesQuery.data.map((live) => {
                const isSelected = selectedId === live.id;
                return (
                  <div
                    key={live.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedId(live.id);
                      setForm(fromSummaryToForm(live));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedId(live.id);
                        setForm(fromSummaryToForm(live));
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
                            openEditLiveDialog(live);
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
                              activateMutation.mutate(live.id);
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

        <div className="space-y-6">
          <AdminCard className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Participation snapshot</h3>
                <p className="text-sm text-muted-foreground">Quick view of who registered for the selected live and how often the link was accessed.</p>
              </div>
              {detailQuery.isFetching ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : null}
            </div>

            {!selectedId ? (
              <EmptyState title="Select a live" description="Choose a Skale Hub live to inspect registrations and access events." icon={<Users />} />
            ) : detailQuery.isLoading ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : detailQuery.data ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Registrations</p>
                    <p className="mt-2 text-2xl font-semibold">{detailQuery.data.live.registrationCount}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Link access</p>
                    <p className="mt-2 text-2xl font-semibold">{detailQuery.data.live.grantedAccessCount}</p>
                  </div>
                  <div className="rounded-2xl bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Denied attempts</p>
                    <p className="mt-2 text-2xl font-semibold">{detailQuery.data.live.deniedAccessCount}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">Recent registrations</p>
                    <Badge variant="outline">{detailQuery.data.registrations.length} people</Badge>
                  </div>

                  {detailQuery.data.registrations.length === 0 ? (
                    <EmptyState title="No registrations yet" description="Once visitors complete the Skale Hub gate, they will appear here." />
                  ) : (
                    <div className="space-y-2">
                      {detailQuery.data.registrations.slice(0, 6).map((registration) => (
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

          <AdminCard className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Participant history</h3>
                <p className="text-sm text-muted-foreground">Track repeat attendees, last live accessed, and contact details across all Skale Hub sessions.</p>
              </div>
              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={participantSearch}
                  onChange={(event) => setParticipantSearch(event.target.value)}
                  placeholder="Search by name, phone, or email"
                  className="pl-9"
                />
              </div>
            </div>

            {participantHistoryQuery.isLoading ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : !participantHistoryQuery.data?.length ? (
              <EmptyState
                title="No participant history yet"
                description="Once visitors register and access Skale Hub lives, their history will appear here."
                icon={<Users />}
              />
            ) : (
              <div className="space-y-3">
                {participantHistoryQuery.data.slice(0, 8).map((participant) => (
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
              </div>
            )}
          </AdminCard>
        </div>
      </div>

      <Dialog open={isLiveFormOpen} onOpenChange={setIsLiveFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2 pr-8">
              <DialogTitle>{form.id == null ? 'Create live' : 'Edit live'}</DialogTitle>
              {form.status === 'live' ? <Badge variant="success">Currently active</Badge> : null}
            </div>
            <DialogDescription>
              Manage the title, schedule, destination link, and status from one place.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSave && !saveMutation.isPending) {
                saveMutation.mutate();
              }
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="hub-title">Live title</Label>
                <Input id="hub-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hub-slug">Slug</Label>
                <Input id="hub-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hub-status">Status</Label>
                <select
                  id="hub-status"
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as HubStatus }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Inactive</option>
                  <option value="live">Active</option>
                  <option value="ended">Ended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hub-starts-at">Date and time</Label>
                <Input id="hub-starts-at" type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hub-timezone">Timezone</Label>
                <select
                  id="hub-timezone"
                  value={form.timezone}
                  onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {COMMON_TIMEZONES.some((tz) => tz.value === form.timezone) ? null : (
                    <option value={form.timezone}>{form.timezone}</option>
                  )}
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="hub-description">Description</Label>
                <Textarea id="hub-description" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hub-stream-url">Live link</Label>
                <Input id="hub-stream-url" value={form.streamUrl} onChange={(event) => setForm((current) => ({ ...current, streamUrl: event.target.value }))} placeholder="https://zoom.us/..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hub-replay-url">Replay link</Label>
                <Input id="hub-replay-url" value={form.replayUrl} onChange={(event) => setForm((current) => ({ ...current, replayUrl: event.target.value }))} placeholder="https://example.com/replay" />
              </div>
              <div className="space-y-2 md:max-w-[180px]">
                <Label htmlFor="hub-capacity">Capacity</Label>
                <Input id="hub-capacity" type="number" min="0" value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))} />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:space-x-0">
              <Button type="button" variant="outline" onClick={() => setIsLiveFormOpen(false)}>
                Cancel
              </Button>
              {form.id != null ? (
                <Button type="button" variant="outline" onClick={() => setForm(selectedLive ? fromSummaryToForm(selectedLive) : EMPTY_FORM)}>
                  Reset
                </Button>
              ) : null}
              <Button type="submit" className="gap-2" disabled={!canSave || saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {form.id == null ? 'Create live' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
