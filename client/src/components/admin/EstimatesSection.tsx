import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Plus,
  Receipt,
  Trash2,
  Search,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import { AdminCard, EmptyState, SectionHeader } from './shared';
import {
  createEstimateThumbnailDataUrl,
  getEstimateThumbnailSignature,
} from '@/lib/thumbnails';
import type { Estimate, EstimateWithStats, EstimateServiceItem } from '@shared/schema';
import { useTranslation } from '@/hooks/useTranslation';
import { EstimateDialogForm } from './estimates/EstimateDialogForm';
import { EstimateListRow } from './estimates/EstimateListRow';
import { EstimateAccessCodeDialog } from './estimates/EstimateAccessCodeDialog';

function normalizeEstimateSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ──────────────────────────────────────────────────────────
// EstimatesSection — main export
// ──────────────────────────────────────────────────────────

export function EstimatesSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Estimate | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [editingAccessCodeEstimate, setEditingAccessCodeEstimate] = useState<Estimate | null>(null);
  const [accessCodeValue, setAccessCodeValue] = useState('');
  const [editingSlugId, setEditingSlugId] = useState<number | null>(null);
  const [slugValue, setSlugValue] = useState('');
  const skipSlugBlurRef = useRef(false);
  const thumbnailJobsRef = useRef(new Set<string>());

  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const { data: queryData, isLoading } = useQuery<{ data: EstimateWithStats[], total: number }>({
    queryKey: ['/api/estimates', page, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('limit', ITEMS_PER_PAGE.toString());
      params.append('offset', offset.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);
      return fetch(`/api/estimates?${params.toString()}`).then(r => r.json());
    },
  });

  const estimates = queryData?.data ?? [];
  const totalItems = queryData?.total ?? 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  useEffect(() => {
    estimates.forEach((estimate) => {
      const thumbnailSignature = getEstimateThumbnailSignature(estimate);
      if (estimate.thumbnailUrl && estimate.thumbnailSignature === thumbnailSignature) return;

      const jobKey = `${estimate.id}:${thumbnailSignature}`;
      if (thumbnailJobsRef.current.has(jobKey)) return;
      thumbnailJobsRef.current.add(jobKey);

      void (async () => {
        try {
          const thumbnailUrl = await createEstimateThumbnailDataUrl(estimate);
          await apiRequest('PUT', `/api/estimates/${estimate.id}/thumbnail`, {
            thumbnailUrl,
            thumbnailSignature,
          });
          const applyThumbnail = (current: { data: EstimateWithStats[]; total: number } | undefined) =>
            current
              ? {
                  ...current,
                  data: current.data.map((row) =>
                    row.id === estimate.id
                      ? { ...row, thumbnailUrl, thumbnailSignature }
                      : row,
                  ),
                }
              : current;

          queryClient.setQueryData<{ data: EstimateWithStats[]; total: number }>(
            ['/api/estimates', page, debouncedSearch],
            applyThumbnail,
          );
          queryClient.setQueriesData<{ data: EstimateWithStats[]; total: number }>(
            { queryKey: ['/api/estimates'] },
            applyThumbnail,
          );
        } catch (err) {
          console.warn('Failed to cache estimate thumbnail', err);
        } finally {
          thumbnailJobsRef.current.delete(jobKey);
        }
      })();
    });
  }, [debouncedSearch, estimates, page]);

  const createMutation = useMutation({
    mutationFn: async (data: { clientName: string; companyName: string; contactName: string; note: string | null; services: EstimateServiceItem[]; accessCode: string | null }) => {
      const res = await apiRequest('POST', '/api/estimates', data);
      return res.json() as Promise<Estimate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      setIsDialogOpen(false);
      toast({ title: t('Estimate created') });
    },
    onError: (err: Error) => {
      toast({ title: t('Failed to create estimate'), description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; clientName: string; companyName: string; contactName: string; note: string | null; services: EstimateServiceItem[]; accessCode: string | null }) => {
      const res = await apiRequest('PUT', `/api/estimates/${data.id}`, {
        clientName: data.clientName,
        companyName: data.companyName,
        contactName: data.contactName,
        note: data.note,
        services: data.services,
        accessCode: data.accessCode,
      });
      return res.json() as Promise<Estimate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      setIsDialogOpen(false);
      toast({ title: t('Estimate updated') });
    },
    onError: (err: Error) => {
      toast({ title: t('Failed to update estimate'), description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/estimates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      toast({ title: t('Estimate deleted') });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: t('Failed to delete estimate'), description: err.message, variant: 'destructive' });
    },
  });

  const updateAccessCodeMutation = useMutation({
    mutationFn: async (data: { id: number; accessCode: string | null }) => {
      const res = await apiRequest('PUT', `/api/estimates/${data.id}`, { accessCode: data.accessCode });
      return res.json() as Promise<Estimate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      setEditingAccessCodeEstimate(null);
      setAccessCodeValue('');
      toast({ title: t('Access code updated') });
    },
    onError: (err: Error) => {
      toast({ title: t('Failed to update access code'), description: err.message, variant: 'destructive' });
    },
  });

  const updateSlugMutation = useMutation({
    mutationFn: async (data: { id: number; slug: string }) => {
      const res = await apiRequest('PUT', `/api/estimates/${data.id}`, { slug: data.slug });
      const updated = (await res.json()) as Estimate;
      if (updated.slug !== data.slug) {
        throw new Error(`Server did not save the slug. Returned: ${updated.slug}`);
      }
      return updated;
    },
    onSuccess: (updatedEstimate, variables) => {
      const savedSlug = updatedEstimate.slug || variables.slug;
      const updateEstimateSlug = (current: { data: EstimateWithStats[]; total: number } | undefined) =>
        current
          ? {
              ...current,
              data: current.data.map((estimate) =>
                estimate.id === variables.id
                  ? { ...estimate, slug: savedSlug }
                  : estimate,
              ),
            }
          : current;

      queryClient.setQueryData<{ data: EstimateWithStats[]; total: number }>(
        ['/api/estimates', page, debouncedSearch],
        updateEstimateSlug,
      );
      queryClient.setQueriesData<{ data: EstimateWithStats[]; total: number }>(
        { queryKey: ['/api/estimates'] },
        updateEstimateSlug,
      );
      setEditingSlugId(null);
      setSlugValue('');
      toast({ title: t('Slug updated') });
    },
    onError: (err: Error) => {
      toast({ title: t('Failed to update slug'), description: err.message, variant: 'destructive' });
    },
  });

  const startSlugEdit = (estimate: Estimate) => {
    skipSlugBlurRef.current = false;
    setEditingSlugId(estimate.id);
    setSlugValue(estimate.slug);
  };

  const commitSlug = (estimate: Estimate, value = slugValue) => {
    if (skipSlugBlurRef.current) {
      skipSlugBlurRef.current = false;
      return;
    }

    const slug = normalizeEstimateSlug(value);

    if (!slug) {
      setSlugValue(estimate.slug);
      return;
    }

    if (slug !== estimate.slug) {
      setSlugValue(slug);
      updateSlugMutation.mutate({ id: estimate.id, slug });
      return;
    }

    setEditingSlugId(null);
    setSlugValue('');
  };

  const handleCopyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/e/${slug}`);
      toast({ title: 'Link copied', description: 'Share this link with your client.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy the URL manually.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('Estimates')}
        description={t('Create and manage client proposals — each generates a shareable link')}
        icon={<Receipt className="w-5 h-5" />}
        action={
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64 group">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Search estimates..."
                className="pl-9 pr-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingEstimate(null);
                setIsDialogOpen(true);
              }}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              {t('New Estimate')}
            </Button>
          </div>
        }
      />

      <AdminCard>
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : estimates.length === 0 ? (
          <EmptyState
            icon={<Receipt />}
            title={t('No estimates yet')}
            description={t('Create your first estimate to generate a shareable proposal link.')}
          />
        ) : (
          <div className="space-y-3">
            {estimates.map((est) => (
              <EstimateListRow
                key={est.id}
                est={est}
                editingSlugId={editingSlugId}
                slugValue={slugValue}
                isUpdatingSlug={updateSlugMutation.isPending}
                onStartSlugEdit={startSlugEdit}
                onSlugChange={setSlugValue}
                onCommitSlug={commitSlug}
                onCancelSlug={() => { skipSlugBlurRef.current = true; setEditingSlugId(null); setSlugValue(''); }}
                onCopyLink={handleCopyLink}
                onOpenLink={(slug) => window.open(`/e/${slug}`, '_blank', 'noopener,noreferrer')}
                onEditAccessCode={(est) => { setEditingAccessCodeEstimate(est); setAccessCodeValue(est.accessCode ?? ''); }}
                onEdit={(est) => { setEditingEstimate(est); setIsDialogOpen(true); }}
                onDelete={setDeleteTarget}
              />
            ))}

            {totalPages > 1 && (
              <div className="pt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={page === p}
                          onClick={() => setPage(p)}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
      </AdminCard>

      {/* Delete confirmation AlertDialog */}
      {deleteTarget && (
        <AlertDialog open={true} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('Delete estimate?')}</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the estimate for {deleteTarget.clientName}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('Delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <EstimateDialogForm
            key={editingEstimate?.id ?? 'new'}
            editingEstimate={editingEstimate}
            onSave={(companyName, contactName, note, services, accessCode) => {
              const clientName = companyName || contactName;
              const servicesWithOrder = services.map((s, i) => ({ ...s, order: i }));
              if (editingEstimate) {
                updateMutation.mutate({ id: editingEstimate.id, clientName, companyName, contactName, note, services: servicesWithOrder, accessCode });
              } else {
                createMutation.mutate({ clientName, companyName, contactName, note, services: servicesWithOrder, accessCode });
              }
            }}
            isPending={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Access Code dialog */}
      <EstimateAccessCodeDialog
        estimate={editingAccessCodeEstimate}
        value={accessCodeValue}
        onValueChange={setAccessCodeValue}
        onClose={() => setEditingAccessCodeEstimate(null)}
        onSubmit={(id, accessCode) => updateAccessCodeMutation.mutate({ id, accessCode })}
        isPending={updateAccessCodeMutation.isPending}
      />
    </div>
  );
}
