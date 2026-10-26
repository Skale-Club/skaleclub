import { lazy, Suspense, useState } from 'react';
import { useLocation } from 'wouter';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { Copy, ExternalLink, Globe, LayoutDashboard, Lock, Network, PenLine, Plus, Search, Trash2, Workflow, X } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { useDebounce } from '@/hooks/useDebounce';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { createStarterDocument } from '@shared/boards/document';
import { createTemplateDocument, type BoardTemplateId } from '@shared/boards/templates';
import { BOARD_LIMITS, type Board, type BoardKind, type BoardPage, type BoardSummary } from '@shared/schema/boards';
import { AdminCard, EmptyState, SectionHeader } from './shared';

// React Flow and the editor load only once a board is opened.
const BoardEditor = lazy(() => import('@/features/boards/BoardEditor').then((m) => ({ default: m.BoardEditor })));
const TemplateGrid = lazy(() => import('@/features/boards/ui/TemplatePicker').then((m) => ({ default: m.TemplateGrid })));

// Each card carries a thumbnail, so the list loads a page at a time.
const PAGE_SIZE = 24;

const KINDS: { id: BoardKind; title: string; description: string; icon: typeof Network }[] = [
  { id: 'mindmap', title: 'Mind map', description: 'Start from a central topic and branch out with the keyboard.', icon: Network },
  { id: 'canvas', title: 'Canvas', description: 'A free board for sticky notes, shapes, frames and connectors.', icon: LayoutDashboard },
];

function boardPublicUrl(slug: string) {
  return `${window.location.origin}/b/${slug}`;
}

export function BoardsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  // /admin/boards/:id opens the editor, so a reload keeps the board open.
  const editingId = location.replace(/^\/admin\/boards\/?/, '').split('/')[0] || null;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<BoardKind>('mindmap');
  const [newTemplate, setNewTemplate] = useState<BoardTemplateId>('blank');
  const [deleteTarget, setDeleteTarget] = useState<BoardSummary | null>(null);

  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['/api/boards', 'list', debouncedSearch],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pageParam) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiRequest('GET', `/api/boards?${params.toString()}`).then((r) => r.json() as Promise<BoardPage>);
    },
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
  const boards = data?.pages.flatMap((page) => page.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  // The editor's history entry remembers it was opened from this list, so
  // closing goes back to the list entry instead of stacking a new one on top
  // (browser Back would then reopen the editor). Opened any other way (a link,
  // a reload of a deep URL), the editor entry is replaced by the list.
  const openBoard = (id: string) => setLocation(`/admin/boards/${id}`, { state: { boardsFromList: true } });
  const closeBoard = () => {
    const state = window.history.state as { boardsFromList?: boolean } | null;
    if (state?.boardsFromList) window.history.back();
    else setLocation('/admin/boards', { replace: true });
  };

  const createMutation = useMutation({
    mutationFn: ({ title, kind, template }: { title: string; kind: BoardKind; template: BoardTemplateId }) =>
      apiRequest('POST', '/api/boards', {
        title,
        kind,
        document: kind === 'canvas' && template !== 'blank' ? createTemplateDocument(template) : createStarterDocument(kind, title),
      }).then(
        (r) => r.json() as Promise<Board>,
      ),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ['/api/boards', 'list'] });
      queryClient.setQueryData(['/api/boards', board.id], board);
      setIsCreateOpen(false);
      setNewTitle('');
      openBoard(board.id);
    },
    onError: (err: any) => {
      toast({ title: t('Failed to create board'), description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/boards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/boards', 'list'] });
      toast({ title: t('Board deleted') });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: t('Failed to delete board'), description: err.message, variant: 'destructive' });
    },
  });

  async function copyLink(slug: string) {
    try {
      await navigator.clipboard.writeText(boardPublicUrl(slug));
      toast({ title: t('Link copied') });
    } catch {
      toast({ title: t('Could not copy link'), variant: 'destructive' });
    }
  }

  function openCreate() {
    setNewTitle('');
    setNewKind('mindmap');
    setNewTemplate('blank');
    setIsCreateOpen(true);
  }

  function submitCreate() {
    const title = newTitle.trim();
    if (title) createMutation.mutate({ title, kind: newKind, template: newTemplate });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('Boards')}
        description={t('Mind maps and free canvases. Share any board by link.')}
        icon={<Workflow className="w-5 h-5" />}
        action={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
            <div className="relative flex-1 sm:flex-initial sm:w-56 group">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder={t('Search boards...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 w-full"
                data-testid="boards-search"
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
            <Button onClick={openCreate} className="gap-2 shrink-0" data-testid="boards-new">
              <Plus className="w-4 h-4" />
              {t('New board')}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <EmptyState icon={<Workflow />} title={t('Could not load boards')} description={t('Try again in a moment.')} />
      ) : boards.length === 0 ? (
        <EmptyState
          icon={<Workflow />}
          title={debouncedSearch ? t('No boards found') : t('No boards yet')}
          description={debouncedSearch ? undefined : t('Create a mind map or a canvas. Boards stay private until you share the link.')}
          action={
            debouncedSearch ? undefined : (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="w-4 h-4" />
                {t('New board')}
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {boards.map((board) => {
            const KindIcon = board.kind === 'canvas' ? LayoutDashboard : Network;
            const isPublic = board.visibility === 'link';
            return (
              <AdminCard key={board.id} padding="compact" className="flex flex-col gap-3" data-testid={`board-card-${board.id}`}>
                <button
                  type="button"
                  onClick={() => openBoard(board.id)}
                  className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted/40 transition-shadow hover:shadow-md"
                  aria-label={`${t('Edit')} ${board.title}`}
                  data-testid={`board-thumbnail-${board.id}`}
                >
                  {board.thumbnailUrl ? (
                    <img src={board.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <KindIcon className="h-8 w-8 opacity-40" />
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex gap-1.5">
                    <Badge variant="secondary" className="gap-1 bg-background/90 backdrop-blur" data-testid={`board-kind-${board.id}`}>
                      <KindIcon className="h-3 w-3" />
                      {board.kind === 'canvas' ? t('Canvas') : t('Mind map')}
                    </Badge>
                  </div>
                </button>
                <button type="button" onClick={() => openBoard(board.id)} className="text-left min-w-0">
                  <p className="font-semibold truncate">{board.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {board.nodeCount === 0 ? t('Empty') : board.nodeCount === 1 ? `1 ${t('item')}` : `${board.nodeCount} ${t('items')}`}
                    {board.updatedAt ? ` · ${new Date(board.updatedAt).toLocaleString()}` : ''}
                  </p>
                </button>
                <div className="flex items-center gap-1 mt-auto">
                  <Button size="sm" className="gap-2" onClick={() => openBoard(board.id)} data-testid={`board-edit-${board.id}`}>
                    <PenLine className="w-4 h-4" />
                    {t('Edit')}
                  </Button>
                  <Badge
                    variant="outline"
                    className={cn('ml-1 gap-1 font-normal', isPublic ? 'border-[#5173D6]/40 text-[#5173D6]' : 'text-muted-foreground')}
                    data-testid={`board-visibility-${board.id}`}
                  >
                    {isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {isPublic ? t('Shared') : t('Private')}
                  </Badge>
                  {isPublic && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => copyLink(board.slug)} aria-label={t('Copy link')}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" asChild>
                        <a href={`/b/${board.slug}`} target="_blank" rel="noopener noreferrer" aria-label={t('Open public page')}>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(board)}
                    aria-label={t('Delete')}
                    data-testid={`board-delete-${board.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </AdminCard>
            );
          })}
        </div>
      )}

      {hasNextPage && (
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="gap-2"
            data-testid="boards-load-more"
          >
            {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('Load more')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {boards.length} / {total}
          </p>
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className={cn('max-h-[92vh] overflow-y-auto', newKind === 'canvas' ? 'sm:max-w-2xl' : 'sm:max-w-lg')} data-testid="board-create-dialog">
          <DialogHeader>
            <DialogTitle>{t('New board')}</DialogTitle>
            <DialogDescription>{t('Pick a starting point. Both kinds can hold mind maps and canvas items.')}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitCreate();
            }}
          >
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('Board type')}>
              {KINDS.map(({ id, title, description, icon: Icon }) => {
                const selected = newKind === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setNewKind(id)}
                    data-testid={`board-kind-option-${id}`}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors',
                      selected ? 'border-[#5173D6] bg-[#5173D6]/5 ring-1 ring-[#5173D6]' : 'hover:bg-muted/60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg',
                        selected ? 'bg-[#5173D6] text-white' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="font-semibold">{t(title)}</span>
                    <span className="text-xs text-muted-foreground">{t(description)}</span>
                  </button>
                );
              })}
            </div>
            {newKind === 'canvas' && (
              <div className="space-y-1.5">
                <Label>{t('Start from')}</Label>
                <Suspense fallback={<div className="h-40" />}>
                  <TemplateGrid value={newTemplate} onPick={setNewTemplate} />
                </Suspense>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="board-new-title">{t('Title')}</Label>
              <Input
                id="board-new-title"
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={newKind === 'mindmap' ? t('e.g. Q3 marketing plan') : t('e.g. Website kickoff workshop')}
                maxLength={BOARD_LIMITS.title}
                data-testid="board-new-title"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button type="submit" disabled={!newTitle.trim() || createMutation.isPending} data-testid="board-create">
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {t('Create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete board?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('The board and its public link will be removed. This cannot be undone.')}
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
          <BoardEditor key={editingId} id={editingId} onClose={closeBoard} />
        </Suspense>
      )}
    </div>
  );
}
