import { lazy, Suspense, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { Copy, ExternalLink, PenLine, PenTool, Plus, Search, Trash2, X } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { useDebounce } from '@/hooks/useDebounce';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { whiteboardPublicUrl } from '@/components/whiteboard/whiteboardScene';
import { AdminCard, EmptyState, SectionHeader } from './shared';
import type { WhiteboardPage, WhiteboardSummary } from '@shared/schema';

// Excalidraw is a large bundle: it loads only once a board is opened.
const WhiteboardEditor = lazy(() =>
  import('./whiteboards/WhiteboardEditor').then((m) => ({ default: m.WhiteboardEditor })),
);

// Each card carries a thumbnail, so the list loads a page at a time.
const PAGE_SIZE = 24;
const NEW_BOARD_ID = 'new';

export function WhiteboardsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  // /admin/whiteboards/:id opens the editor, so a reload keeps the board open.
  // /admin/whiteboards/new opens an empty board that has no record until its first save.
  const editingId = location.replace(/^\/admin\/whiteboards\/?/, '').split('/')[0] || null;
  const isNewBoard = editingId === NEW_BOARD_ID;
  // The first save moves the URL from /new to the board's id. The editor must stay
  // mounted through that (it holds the canvas and its undo history), so both URLs
  // share one key.
  const createdIdRef = useRef<string | null>(null);
  // Only meaningful during that transition: once the editor is closed the id is stale.
  if (!editingId) createdIdRef.current = null;
  const editorKey = isNewBoard || editingId === createdIdRef.current ? NEW_BOARD_ID : editingId;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [deleteTarget, setDeleteTarget] = useState<WhiteboardSummary | null>(null);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['/api/whiteboards', 'list', debouncedSearch],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pageParam) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiRequest('GET', `/api/whiteboards?${params.toString()}`).then((r) => r.json() as Promise<WhiteboardPage>);
    },
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
  const boards = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const openBoard = (id: string) => setLocation(`/admin/whiteboards/${id}`);
  const closeBoard = (opts?: { replace?: boolean }) => setLocation('/admin/whiteboards', opts);

  function handleCreated(id: string) {
    createdIdRef.current = id;
    // Replace the current entry (the editor's history guard, if any) instead of
    // stacking the board's URL on top of /new.
    setLocation(`/admin/whiteboards/${id}`, { replace: true });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/whiteboards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whiteboards', 'list'] });
      toast({ title: t('Whiteboard deleted') });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: t('Failed to delete whiteboard'), description: err.message, variant: 'destructive' });
    },
  });

  async function copyLink(slug: string) {
    try {
      await navigator.clipboard.writeText(whiteboardPublicUrl(slug));
      toast({ title: t('Link copied') });
    } catch {
      toast({ title: t('Could not copy link'), variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('Whiteboards')}
        description={t('Draw for your YouTube videos. Every saved board is public at its link.')}
        icon={<PenTool className="w-5 h-5" />}
        action={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
            <div className="relative flex-1 sm:flex-initial sm:w-56 group">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder={t('Search whiteboards...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 w-full"
                data-testid="whiteboards-search"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label={t('Clear search')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button onClick={() => openBoard(NEW_BOARD_ID)} className="gap-2 shrink-0" data-testid="whiteboards-new">
              <Plus className="w-4 h-4" />
              {t('New whiteboard')}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : boards.length === 0 ? (
        <EmptyState
          icon={<PenTool />}
          title={debouncedSearch ? t('No whiteboards found') : t('No whiteboards yet')}
          description={debouncedSearch ? undefined : t('Create a board, draw, and save: the link goes public right away.')}
          action={
            debouncedSearch ? undefined : (
              <Button onClick={() => openBoard(NEW_BOARD_ID)} className="gap-2">
                <Plus className="w-4 h-4" />
                {t('New whiteboard')}
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {boards.map((board) => (
            <AdminCard key={board.id} padding="compact" className="flex flex-col gap-3" data-testid={`whiteboard-card-${board.id}`}>
              <button
                type="button"
                onClick={() => openBoard(board.id)}
                className="aspect-video w-full overflow-hidden rounded-lg border bg-muted/40"
                aria-label={`${t('Edit')} ${board.title}`}
                data-testid={`whiteboard-thumbnail-${board.id}`}
              >
                {board.thumbnailUrl ? (
                  <img src={board.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <PenTool className="h-8 w-8 opacity-40" />
                  </div>
                )}
              </button>
              <button type="button" onClick={() => openBoard(board.id)} className="text-left min-w-0">
                <p className="font-semibold truncate">{board.title}</p>
                <p className="text-xs text-muted-foreground truncate">/w/{board.slug}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {board.elementCount === 0 ? t('Empty') : `${board.elementCount} ${t('elements')}`}
                  {board.updatedAt ? ` · ${new Date(board.updatedAt).toLocaleString()}` : ''}
                </p>
              </button>
              <div className="flex items-center gap-1 mt-auto">
                <Button size="sm" className="gap-2" onClick={() => openBoard(board.id)} data-testid={`whiteboard-edit-${board.id}`}>
                  <PenLine className="w-4 h-4" />
                  {t('Edit')}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => copyLink(board.slug)} aria-label={t('Copy link')}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" asChild>
                  <a href={`/w/${board.slug}`} target="_blank" rel="noopener noreferrer" aria-label={t('Open public page')}>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget(board)}
                  aria-label={t('Delete')}
                  data-testid={`whiteboard-delete-${board.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="gap-2"
            data-testid="whiteboards-load-more"
          >
            {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('Load more')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {boards.length} / {total}
          </p>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete whiteboard?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('The public link will stop working. This cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingId && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <WhiteboardEditor
            key={editorKey}
            id={isNewBoard ? null : editingId}
            onCreated={handleCreated}
            onClose={closeBoard}
          />
        </Suspense>
      )}
    </div>
  );
}
