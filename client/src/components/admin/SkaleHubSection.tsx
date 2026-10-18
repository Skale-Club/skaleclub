import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, RadioTower } from 'lucide-react';

import { AdminCard, SectionHeader } from './shared';
import { Button } from '@/components/ui/button';
import { Loader2 } from '@/components/ui/loader';
import { adminQueryOptions, apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { HubDashboardSummary, HubLiveSummary, HubParticipantHistory } from '@shared/schema';

import { HubLiveLineupCard } from './hub/HubLiveLineupCard';
import { HubParticipationSnapshotCard } from './hub/HubParticipationSnapshotCard';
import { HubParticipantHistoryCard } from './hub/HubParticipantHistoryCard';
import {
  HubLiveFormDialog,
  fromSummaryToForm,
  buildLivePayload,
  validateLiveForm,
  EMPTY_FORM,
  type LiveFormState,
} from './hub/HubLiveFormDialog';
import type { HubLiveDetail } from './hub/hubTypes';

export function SkaleHubSection() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<LiveFormState>(EMPTY_FORM);
  const [isLiveFormOpen, setIsLiveFormOpen] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');

  const dashboardQuery = useQuery<HubDashboardSummary>({
    queryKey: ['/api/skale-hub/dashboard'],
    ...adminQueryOptions,
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
    ...adminQueryOptions,
  });

  const livesQuery = useQuery<HubLiveSummary[]>({
    queryKey: ['/api/skale-hub/lives'],
    ...adminQueryOptions,
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
    ...adminQueryOptions,
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

  // Prefix keys: ['/api/skale-hub/lives'] also covers every live detail query, and
  // ['/api/skale-hub/participants'] covers each search variant.
  const invalidateHubQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/skale-hub/lives'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/skale-hub/dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/skale-hub/participants'] }),
    ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateLiveForm(form);
      if (validationError) {
        throw new Error(validationError);
      }
      // Wall-clock inputs are interpreted in the form's timezone, not the browser's.
      const payload = buildLivePayload(form);

      const response = form.id == null
        ? await apiRequest('POST', '/api/skale-hub/lives', payload)
        : await apiRequest('PUT', `/api/skale-hub/lives/${form.id}`, payload);

      return response.json() as Promise<HubLiveSummary>;
    },
    onSuccess: async (live) => {
      await invalidateHubQueries();
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
      await invalidateHubQueries();
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

  const deleteMutation = useMutation({
    mutationFn: async (liveId: number) => {
      await apiRequest('DELETE', `/api/skale-hub/lives/${liveId}`);
      return liveId;
    },
    onSuccess: async (liveId) => {
      // Drop the deleted live locally first so selection logic never lands on it again.
      queryClient.setQueryData<HubLiveSummary[]>(['/api/skale-hub/lives'], (current) =>
        current?.filter((live) => live.id !== liveId),
      );
      queryClient.removeQueries({ queryKey: ['/api/skale-hub/lives', liveId] });
      setSelectedId(null);
      setForm(EMPTY_FORM);
      setIsLiveFormOpen(false);
      await invalidateHubQueries();
      toast({ title: 'Live deleted' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Unable to delete live',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const canSave = Boolean(form.slug.trim() && form.title.trim() && form.startsAt) && !validateLiveForm(form);

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
            data-testid="button-hub-new-live"
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
        <HubLiveLineupCard
          lives={livesQuery.data}
          isLoading={livesQuery.isLoading}
          selectedId={selectedId}
          onSelect={(live) => {
            setSelectedId(live.id);
            setForm(fromSummaryToForm(live));
          }}
          onEdit={openEditLiveDialog}
          onActivate={(id) => activateMutation.mutate(id)}
          onRefresh={() => livesQuery.refetch()}
          isActivating={activateMutation.isPending}
        />

        <div className="space-y-6">
          <HubParticipationSnapshotCard
            selectedId={selectedId}
            detail={detailQuery.data}
            isLoading={detailQuery.isLoading}
            isFetching={detailQuery.isFetching}
            selectedLive={selectedLive}
          />

          <HubParticipantHistoryCard
            history={participantHistoryQuery.data}
            isLoading={participantHistoryQuery.isLoading}
            searchValue={participantSearch}
            onSearchChange={setParticipantSearch}
          />
        </div>
      </div>

      <HubLiveFormDialog
        open={isLiveFormOpen}
        onOpenChange={setIsLiveFormOpen}
        form={form}
        onFormChange={setForm}
        selectedLive={selectedLive}
        onSubmit={() => {
          if (canSave && !saveMutation.isPending) {
            saveMutation.mutate();
          }
        }}
        isPending={saveMutation.isPending}
        onDelete={() => {
          if (form.id != null && !deleteMutation.isPending) {
            deleteMutation.mutate(form.id);
          }
        }}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
