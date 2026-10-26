import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useStore } from 'zustand';
import { AlertTriangle, ArrowLeft, CloudOff, Keyboard, Loader2 as Spinner, Save } from 'lucide-react';
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
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { normalizeDocument } from '@shared/boards/document';
import { BOARD_LIMITS, type Board, type BoardVisibility } from '@shared/schema/boards';
import { BoardStoreProvider, useCreateBoardStore, type BoardStore } from './store/boardStore';
import { BoardCanvas, type ThumbnailRenderer } from './engine/BoardCanvas';
import { clearSnapshot, conflictCode, isSnapshotNewer, readSnapshot, useBoardAutosave, type BoardSnapshot, type SaveStatus } from './io/autosave';
import { Toolbar } from './ui/Toolbar';
import { StylePanel } from './ui/StylePanel';
import { ShareMenu } from './ui/ShareMenu';
import { ShortcutsDialog } from './ui/ShortcutsDialog';

interface BoardEditorProps {
  id: string;
  /** `replace` when the editor left a guard entry in history (see below). */
  onClose: (opts?: { replace?: boolean }) => void;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function SaveStatusText({ status }: { status: SaveStatus }) {
  const { t } = useTranslation();
  const map: Record<SaveStatus, { label: string; className?: string; icon?: React.ReactNode }> = {
    saving: { label: t('Saving…'), icon: <Spinner className="h-3 w-3 animate-spin" /> },
    dirty: { label: t('Unsaved changes') },
    saved: { label: t('All changes saved') },
    offline: { label: t('Offline, changes pending'), className: 'text-amber-600 dark:text-amber-400', icon: <CloudOff className="h-3 w-3" /> },
    conflict: { label: t('Saved somewhere else'), className: 'text-destructive', icon: <AlertTriangle className="h-3 w-3" /> },
  };
  const entry = map[status];
  return (
    <span
      className={cn('hidden items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground sm:inline-flex', entry.className)}
      data-testid="board-save-status"
      data-status={status}
    >
      {entry.icon}
      {entry.label}
    </span>
  );
}

export function BoardEditor({ id, onClose }: BoardEditorProps) {
  const { data: board, isLoading, isError } = useQuery<Board>({
    queryKey: ['/api/boards', id],
    queryFn: () => apiRequest('GET', `/api/boards/${id}`).then((r) => r.json()),
    // The editor owns the document once loaded; a background refetch must not
    // reset what is on the canvas.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const store = useCreateBoardStore();

  return (
    <BoardStoreProvider store={store}>
      <EditorShell id={id} board={board} isLoading={isLoading} isError={isError} store={store} onClose={onClose} />
    </BoardStoreProvider>
  );
}

function EditorShell({
  id,
  board,
  isLoading,
  isError,
  store,
  onClose,
}: BoardEditorProps & { board: Board | undefined; isLoading: boolean; isError: boolean; store: BoardStore }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const title = useStore(store, (s) => s.title);
  const setTitle = useStore(store, (s) => s.setTitle);
  const activeTool = useStore(store, (s) => s.activeTool);
  const setActiveTool = useStore(store, (s) => s.setActiveTool);
  const thumbnailRef = useRef<ThumbnailRenderer | null>(null);

  const [loaded, setLoaded] = useState(false);
  // Remounts the canvas when the saved version is loaded over local edits.
  const [canvasKey, setCanvasKey] = useState(0);
  const [visibility, setVisibility] = useState<BoardVisibility>('private');
  const [slug, setSlug] = useState('');
  const [visibilityPending, setVisibilityPending] = useState(false);
  const [restoreSnapshot, setRestoreSnapshot] = useState<BoardSnapshot | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const autosave = useBoardAutosave({
    boardId: id,
    store,
    enabled: loaded && !restoreSnapshot,
    getThumbnail: () => thumbnailRef.current?.() ?? Promise.resolve(null),
    onSaved: (updated) => {
      queryClient.setQueryData(['/api/boards', id], updated);
      queryClient.invalidateQueries({ queryKey: ['/api/boards', 'list'] });
    },
    onError: (err) => {
      toast({ title: t('Failed to save board'), description: err.message, variant: 'destructive' });
    },
  });
  const { status, isDirty } = autosave;

  // Seed the store once from the server copy: later cache updates (after a
  // save) must not overwrite what is being edited.
  useEffect(() => {
    if (!board || loaded) return;
    const document = normalizeDocument(board.document);
    store.getState().replaceDocument(document, { title: board.title, viewport: document.viewport ?? null });
    autosave.setBaseVersion(board.version);
    setVisibility(board.visibility);
    setSlug(board.slug);
    const snapshot = readSnapshot(id);
    if (isSnapshotNewer(snapshot, board)) setRestoreSnapshot(snapshot);
    else if (snapshot) clearSnapshot(id);
    setLoaded(true);
    // autosave.setBaseVersion only writes a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, id, loaded, store]);

  useEffect(() => {
    if (status === 'conflict') setConflictOpen(true);
  }, [status]);

  const saveNow = useCallback(() => {
    void autosave.save().catch(() => undefined);
  }, [autosave]);

  function restoreLocal() {
    if (!restoreSnapshot || !board) return;
    store.getState().replaceDocument(restoreSnapshot.document, {
      title: restoreSnapshot.title || board.title,
      viewport: restoreSnapshot.document.viewport ?? null,
      dirty: true,
    });
    // Keep the server's title as the saved baseline so a restored title counts as a change.
    store.setState({ savedTitle: board.title });
    setRestoreSnapshot(null);
    setCanvasKey((key) => key + 1);
  }

  function discardLocal() {
    clearSnapshot(id);
    setRestoreSnapshot(null);
  }

  async function changeVisibility(next: BoardVisibility) {
    const previous = visibility;
    setVisibility(next);
    setVisibilityPending(true);
    try {
      const updated = await autosave.save({ extra: { visibility: next } });
      if (updated) {
        setVisibility(updated.visibility);
        toast({ title: next === 'link' ? t('Link sharing is on') : t('Board is private') });
      }
    } catch (err) {
      setVisibility(previous);
      if (conflictCode(err) !== 'version_conflict') {
        toast({ title: t('Could not change sharing'), variant: 'destructive' });
      }
    } finally {
      setVisibilityPending(false);
    }
  }

  // Drops local edits and shows what was saved elsewhere.
  const loadLatest = useCallback(async () => {
    try {
      const latest = (await apiRequest('GET', `/api/boards/${id}`).then((r) => r.json())) as Board;
      queryClient.setQueryData(['/api/boards', id], latest);
      const document = normalizeDocument(latest.document);
      store.getState().replaceDocument(document, { title: latest.title, viewport: document.viewport ?? null });
      autosave.setBaseVersion(latest.version);
      autosave.dismissConflict();
      clearSnapshot(id);
      setVisibility(latest.visibility);
      setSlug(latest.slug);
      setConflictOpen(false);
      setCanvasKey((key) => key + 1);
    } catch (err: any) {
      toast({ title: t('Failed to load board'), description: err.message, variant: 'destructive' });
    }
  }, [autosave, id, store, t, toast]);

  const overwrite = useCallback(async () => {
    setConflictOpen(false);
    try {
      await autosave.save({ overwrite: true });
    } catch {
      // status / toast already report it
    }
  }, [autosave]);

  // Ctrl/Cmd+S saves now; "?" opens the shortcuts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        event.stopPropagation();
        saveNow();
        return;
      }
      if (event.key === '?' && !isTypingTarget(event.target)) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [saveNow]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // Browser back (or a swipe) would unmount the editor with no warning: while
  // there are unsaved changes, a duplicate history entry absorbs the first back
  // and asks. Once clean, that entry is passed through on the next back.
  const unsavedRef = useRef(isDirty);
  unsavedRef.current = isDirty;
  const guardEntryRef = useRef(false);
  useEffect(() => {
    if (!isDirty || guardEntryRef.current) return;
    window.history.pushState({ boardGuard: true }, '', window.location.href);
    guardEntryRef.current = true;
  }, [isDirty]);
  useEffect(() => {
    const onPopState = () => {
      if (!guardEntryRef.current) return;
      // The guard entry was popped; the URL is still the editor's.
      guardEntryRef.current = false;
      if (unsavedRef.current && !window.confirm(t('You have unsaved changes. Leave without saving?'))) {
        window.history.pushState({ boardGuard: true }, '', window.location.href);
        guardEntryRef.current = true;
        return;
      }
      window.history.back();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [t]);

  const [closing, setClosing] = useState(false);
  async function handleClose() {
    if (closing) return;
    setClosing(true);
    // Flush pending changes first; only ask when they could not be saved.
    const clean = status === 'conflict' ? !isDirty : await autosave.flush();
    setClosing(false);
    if (!clean && !window.confirm(t('You have unsaved changes. Leave without saving?'))) return;
    // Replace the guard entry rather than stacking the list on top of it.
    onClose({ replace: guardEntryRef.current });
  }

  // Portaled to <body>: the admin layout's containers would otherwise clip and
  // offset a fixed full-screen editor.
  return createPortal(
    <TooltipProvider delayDuration={300}>
      <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="board-editor">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleClose()}
            disabled={closing}
            aria-label={t('Back')}
            data-testid="board-back"
          >
            {closing ? <Spinner className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />}
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
            }}
            maxLength={BOARD_LIMITS.title}
            className="h-9 max-w-xs border-transparent font-medium shadow-none hover:border-input focus-visible:border-input"
            aria-label={t('Title')}
            disabled={!loaded}
            data-testid="board-title-input"
          />
          <SaveStatusText status={status} />
          {status === 'conflict' && !conflictOpen && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConflictOpen(true)}>
              {t('Resolve')}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              onClick={() => setShortcutsOpen(true)}
              aria-label={t('Keyboard shortcuts')}
              data-testid="board-shortcuts"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
            {board && slug && (
              <ShareMenu slug={slug} visibility={visibility} onVisibilityChange={(v) => void changeVisibility(v)} pending={visibilityPending} disabled={!loaded} />
            )}
            <Button
              size="sm"
              className="gap-2"
              onClick={saveNow}
              disabled={!loaded || status === 'saving' || (!isDirty && status !== 'offline')}
              data-testid="board-save"
            >
              {status === 'saving' ? <Spinner className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('Save')}
            </Button>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1">
          {isLoading && (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {isError && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('Failed to load board')}</div>
          )}
          {loaded && (
            <>
              <div className="relative min-w-0 flex-1">
                <BoardCanvas key={canvasKey} thumbnailRef={thumbnailRef} />
                <div className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center">
                  <Toolbar activeTool={activeTool} onSelectTool={setActiveTool} className="pointer-events-auto" />
                </div>
              </div>
              <StylePanel className="hidden lg:flex" />
            </>
          )}
        </div>

        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

        <AlertDialog open={!!restoreSnapshot}>
          <AlertDialogContent data-testid="board-restore">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('Restore unsaved changes?')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('This browser kept changes to this board that were not saved')}
                {restoreSnapshot ? ` (${new Date(restoreSnapshot.savedAt).toLocaleString()})` : ''}.{' '}
                {t('Restore them, or discard them and keep the saved version.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={discardLocal} data-testid="board-restore-discard">
                {t('Discard')}
              </AlertDialogCancel>
              <AlertDialogAction onClick={restoreLocal} data-testid="board-restore-confirm">
                {t('Restore')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
          <AlertDialogContent data-testid="board-conflict">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('This board was saved somewhere else')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('Another tab or device saved this board after you opened it. Keep your version and overwrite theirs, or load the saved version and lose your unsaved changes.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
              <Button variant="outline" onClick={() => void loadLatest()} data-testid="board-conflict-load">
                {t('Load saved version')}
              </Button>
              <AlertDialogAction onClick={() => void overwrite()} data-testid="board-conflict-overwrite">
                {t('Overwrite with mine')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>,
    document.body,
  );
}
