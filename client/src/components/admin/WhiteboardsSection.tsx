import { lazy, Suspense, useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { useDebounce } from '@/hooks/useDebounce';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { whiteboardPublicUrl } from '@/components/whiteboard/whiteboardScene';
import { AdminCard, EmptyState, SectionHeader } from './shared';
import type { Whiteboard, WhiteboardSummary } from '@shared/schema';

// Excalidraw is a large bundle: it loads only once a board is opened.
const WhiteboardEditor = lazy(() =>
  import('./whiteboards/WhiteboardEditor').then((m) => ({ default: m.WhiteboardEditor })),
);

export function WhiteboardsSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  // /admin/whiteboards/:id opens the editor, so a reload keeps the board open.
  const editingId = location.replace(/^\/admin\/whiteboards\/?/, '').split('/')[0] || null;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WhiteboardSummary | null>(null);

  const { data: boards = [], isLoading } = useQuery<WhiteboardSummary[]>({
    queryKey: ['/api/whiteboards', 'list', debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiRequest('GET', `/api/whiteboards?${params.toString()}`).then((r) => r.json());
    },
  });

  const openBoard = (id: string) => setLocation(`/admin/whiteboards/${id}`);
  const closeBoard = () => setLocation('/admin/whiteboards');

  const createMutation = useMutation({
    mutationFn: (title: string) => apiRequest('POST', '/api/whiteboards', { title }).then((r) => r.json() as Promise<Whiteboard>),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ['/api/whiteboards', 'list'] });
      setIsCreateOpen(false);
      setNewTitle('');
      openBoard(board.id);
    },
    onError: (err: any) => {
      toast({ title: t('Failed to create whiteboard'), description: err.message, variant: 'destructive' });
    },
  });

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

  function submitCreate() {
    const title = newTitle.trim();
    if (title) createMutation.mutate(title);
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
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shrink-0" data-testid="whiteboards-new">
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
              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('New whiteboard')}</DialogTitle>
            <DialogDescription>{t('Give it a name. You can change it later.')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitCreate();
            }}
          >
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('e.g. How Google Ads bidding works')}
              maxLength={200}
              data-testid="whiteboard-new-title"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button type="submit" disabled={!newTitle.trim() || createMutation.isPending} data-testid="whiteboard-create">
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
          <WhiteboardEditor key={editingId} id={editingId} onClose={closeBoard} />
        </Suspense>
      )}
    </div>
  );
}
