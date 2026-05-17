import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Presentation, Sparkles, Search, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { useDebounce } from '@/hooks/useDebounce';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import { AdminCard, EmptyState, SectionHeader } from './shared';
import { BrandGuidelinesSection } from './BrandGuidelinesSection';
import {
  createPresentationThumbnailDataUrl,
  getPresentationThumbnailSignature,
} from '@/lib/thumbnails';
import { PresentationEditor } from './presentations/PresentationEditor';
import { normalizePresentationSlug } from './presentations/presentationSlug';
import { PresentationsListRow } from './presentations/PresentationsListRow';
import { CreatePresentationDialog } from './presentations/CreatePresentationDialog';
import { GeneratePresentationDialog } from './presentations/GeneratePresentationDialog';
import type { PresentationWithStats } from '@shared/schema';

export function PresentationsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PresentationWithStats | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [editingSlugId, setEditingSlugId] = useState<string | null>(null);
  const [slugValue, setSlugValue] = useState('');
  const skipSlugBlurRef = useRef(false);
  const thumbnailJobsRef = useRef(new Set<string>());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const { data: queryData, isLoading } = useQuery<{ data: PresentationWithStats[], total: number }>({
    queryKey: ['/api/presentations', page, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('limit', ITEMS_PER_PAGE.toString());
      params.append('offset', offset.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);
      return fetch(`/api/presentations?${params.toString()}`).then(r => r.json());
    },
  });

  const presentations = queryData?.data ?? [];
  const totalItems = queryData?.total ?? 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  useEffect(() => {
    presentations.forEach((presentation) => {
      const thumbnailSignature = getPresentationThumbnailSignature(presentation);
      if (presentation.thumbnailUrl && presentation.thumbnailSignature === thumbnailSignature) return;

      const jobKey = `${presentation.id}:${thumbnailSignature}`;
      if (thumbnailJobsRef.current.has(jobKey)) return;
      thumbnailJobsRef.current.add(jobKey);

      void (async () => {
        try {
          const thumbnailUrl = await createPresentationThumbnailDataUrl(presentation);
          await apiRequest('PUT', `/api/presentations/${presentation.id}/thumbnail`, {
            thumbnailUrl,
            thumbnailSignature,
          });
          const applyThumbnail = (current: { data: PresentationWithStats[]; total: number } | undefined) =>
            current
              ? {
                  ...current,
                  data: current.data.map((row) =>
                    row.id === presentation.id
                      ? { ...row, thumbnailUrl, thumbnailSignature }
                      : row,
                  ),
                }
              : current;

          queryClient.setQueryData<{ data: PresentationWithStats[]; total: number }>(
            ['/api/presentations', page, debouncedSearch],
            applyThumbnail,
          );
          queryClient.setQueriesData<{ data: PresentationWithStats[]; total: number }>(
            { queryKey: ['/api/presentations'] },
            applyThumbnail,
          );
        } catch (err) {
          console.warn('Failed to cache presentation thumbnail', err);
        } finally {
          thumbnailJobsRef.current.delete(jobKey);
        }
      })();
    });
  }, [debouncedSearch, page, presentations]);

  const createMutation = useMutation({
    mutationFn: (data: { title: string; slug: string }) =>
      apiRequest('POST', '/api/presentations', data).then((r) => r.json()),
    onSuccess: (newPres: { id: string; slug: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      toast({ title: t('Presentation created') });
      setIsCreateOpen(false);
      setSelectedId(newPres.id);
    },
    onError: (err: any) => {
      toast({
        title: t('Failed to create presentation'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiRequest('PUT', `/api/presentations/${id}`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      setRenamingId(null);
    },
    onError: (err: any) => {
      toast({ title: t('Failed to save slides'), description: err.message, variant: 'destructive' });
      setRenamingId(null);
    },
  });

  function commitRename(id: string) {
    const trimmed = renamingTitle.trim();
    if (!trimmed) return setRenamingId(null);
    const current = presentations.find((p) => p.id === id);
    if (current && trimmed !== current.title) {
      renameMutation.mutate({ id, title: trimmed });
    } else {
      setRenamingId(null);
    }
  }

  const slugMutation = useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }) => {
      const response = await apiRequest('PUT', `/api/presentations/${id}`, { slug });
      const updated = (await response.json()) as PresentationWithStats;
      if (updated.slug !== slug) {
        throw new Error(`Server did not save the slug. Returned: ${updated.slug}`);
      }
      return updated;
    },
    onSuccess: (updatedPresentation, variables) => {
      const savedSlug = updatedPresentation.slug || variables.slug;
      const updatePresentationSlug = (current: { data: PresentationWithStats[]; total: number } | undefined) =>
        current
          ? {
              ...current,
              data: current.data.map((presentation) =>
                presentation.id === variables.id
                  ? { ...presentation, slug: savedSlug, version: updatedPresentation.version ?? presentation.version + 1 }
                  : presentation,
              ),
            }
          : current;

      queryClient.setQueryData<{ data: PresentationWithStats[]; total: number }>(
        ['/api/presentations', page, debouncedSearch],
        updatePresentationSlug,
      );
      queryClient.setQueriesData<{ data: PresentationWithStats[]; total: number }>(
        { queryKey: ['/api/presentations'] },
        updatePresentationSlug,
      );
      setEditingSlugId(null);
      setSlugValue('');
      toast({ title: t('Slug saved') });
    },
    onError: (err: any) => {
      toast({ title: t('Failed to save slug'), description: err.message, variant: 'destructive' });
    },
  });

  function startSlugEdit(presentation: PresentationWithStats) {
    skipSlugBlurRef.current = false;
    setEditingSlugId(presentation.id);
    setSlugValue(presentation.slug);
  }

  function commitSlug(presentation: PresentationWithStats, value = slugValue) {
    if (skipSlugBlurRef.current) {
      skipSlugBlurRef.current = false;
      return;
    }

    const slug = normalizePresentationSlug(value);

    if (!slug) {
      setSlugValue(presentation.slug);
      return;
    }

    if (slug !== presentation.slug) {
      setSlugValue(slug);
      slugMutation.mutate({ id: presentation.id, slug });
      return;
    }

    setEditingSlugId(null);
    setSlugValue('');
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/presentations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/presentations'] });
      setDeleteTarget(null);
      toast({ title: t('Presentation deleted') });
    },
    onError: (err: any) => {
      toast({
        title: t('Failed to delete presentation'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  function handleCopyLink(slug: string) {
    navigator.clipboard
      .writeText(`${window.location.origin}/p/${slug}`)
      .then(() => toast({ title: t('Link copied') }))
      .catch(() =>
        toast({ title: t('Copy failed'), variant: 'destructive' }),
      );
  }

  // Editor sub-view
  if (selectedId !== null) {
    const selected = presentations.find((p) => p.id === selectedId);
    if (!selected) {
      // Was deleted while editor was open — fall back to list
      setSelectedId(null);
    } else {
      return (
        <PresentationEditor
          key={selectedId}
          presentation={selected}
          onBack={() => setSelectedId(null)}
        />
      );
    }
  }

  // List view
  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('Presentations')}
        description={t(
          'Build AI-powered slide decks and share them as immersive fullscreen experiences.',
        )}
        icon={<Presentation className="w-5 h-5" />}
        action={
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64 group">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder={t('Search presentations...')}
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
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsGenerateOpen(true)}
              className="gap-2 w-full sm:w-auto"
            >
              <Sparkles className="w-4 h-4" />
              {t('Generate with AI')}
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              {t('New Presentation')}
            </Button>
          </div>
        }
      />

      <AdminCard>
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : presentations.length === 0 ? (
          <EmptyState
            title={t('No presentations yet')}
            description={t('Create your first presentation to get started.')}
          />
        ) : (
          <div className="space-y-3">
            {presentations.map((p) => (
              <PresentationsListRow
                key={p.id}
                p={p}
                renamingId={renamingId}
                renamingTitle={renamingTitle}
                editingSlugId={editingSlugId}
                slugValue={slugValue}
                isUpdatingSlug={slugMutation.isPending}
                onStartRename={(target) => { setRenamingId(target.id); setRenamingTitle(target.title); }}
                onRenameChange={setRenamingTitle}
                onCommitRename={commitRename}
                onCancelRename={() => setRenamingId(null)}
                onStartSlugEdit={startSlugEdit}
                onSlugChange={setSlugValue}
                onCommitSlug={commitSlug}
                onCancelSlug={() => {
                  skipSlugBlurRef.current = true;
                  setEditingSlugId(null);
                  setSlugValue('');
                }}
                onOpenLink={(slug) => window.open(`/p/${slug}`, '_blank')}
                onCopyLink={handleCopyLink}
                onDelete={setDeleteTarget}
                onOpenEditor={setSelectedId}
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

      {/* Delete confirmation */}
      {deleteTarget && (
        <AlertDialog
          open={true}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('Delete presentation?')}</AlertDialogTitle>
              <AlertDialogDescription>
                &quot;{deleteTarget.title}&quot; —{' '}
                {t(
                  'This will permanently remove this presentation. This action cannot be undone.',
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                className="border-none hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t('Delete')
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Create presentation dialog */}
      <CreatePresentationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        isPending={createMutation.isPending}
        onCreate={(data) => createMutation.mutate(data)}
      />

      {/* Generate presentation dialog */}
      <GeneratePresentationDialog
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        onSuccess={(result) => setSelectedId(result.id)}
      />

      {/* Brand Guidelines always visible below presentations list */}
      <BrandGuidelinesSection />
    </div>
  );
}
