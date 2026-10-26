import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useStore } from 'zustand';
import { AlertTriangle, ArrowLeft, CloudOff, FileDown, FileJson, FileUp, ImageDown, Keyboard, LayoutTemplate, Loader2 as Spinner, MoreHorizontal, Paintbrush, Play, Save, Shapes, Sparkles } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Input } from '@/components/ui/input';
import { Loader2 } from '@/components/ui/loader';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { isDocumentEmpty, normalizeDocument } from '@shared/boards/document';
import { parseBoardJson, serializeBoardJson } from '@shared/boards/json';
import { BOARD_LIMITS, type Board, type BoardDocument, type BoardVisibility } from '@shared/schema/boards';
import { BoardStoreProvider, getDocumentForSave, useCreateBoardStore, type BoardStore } from './store/boardStore';
import { BoardCanvas, type ThumbnailRenderer } from './engine/BoardCanvas';
import { clearSnapshot, conflictCode, isSnapshotNewer, readSnapshot, useBoardAutosave, type BoardSnapshot, type SaveStatus } from './io/autosave';
import { ToolOptions, Toolbar } from './ui/Toolbar';
import { TemplatePicker } from './ui/TemplatePicker';
import { insertTemplate } from './canvas/actions';
import { StylePanel } from './ui/StylePanel';
import { ShareMenu } from './ui/ShareMenu';
import { ShortcutsDialog } from './ui/ShortcutsDialog';
import { exportOutline, importOutlineText } from './mindmap/actions';
import { AiGenerateDialog, AiSummaryDialog } from './ui/AiDialogs';
import { generateMindmapFromTopic, summarizeBoard } from './ai/aiActions';
import { aiErrorMessage, useBoardsAiEnabled } from './ai/boardsAiApi';
import { downloadBlob, fileNameFor } from './io/exportImage';
import { EmptyBoardError } from './io/exportImage';
import { PresentOverlay } from './present/PresentOverlay';
import { usePresentMode } from './present/usePresentMode';
import { countOutlineItems, parseIndentedText } from '@shared/boards/outline';
import { isTypingTarget } from './canvas/interaction';

interface BoardEditorProps {
  id: string;
  /** Leaves the editor; called with the editor's own history entry current (any guard entry is gone). */
  onClose: () => void;
}

function downloadText(filename: string, text: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

// "Import from text": pasted Markdown or an indented list becomes a new map.
function ImportTextDialog({ open, onOpenChange, onImport }: { open: boolean; onOpenChange: (open: boolean) => void; onImport: (text: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const count = text.trim() ? countOutlineItems(parseIndentedText(text)) : 0;
  useEffect(() => {
    if (!open) setText('');
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="board-import-dialog">
        <DialogHeader>
          <DialogTitle>{t('Import from text')}</DialogTitle>
          <DialogDescription>
            {t('Paste a Markdown list or indented text. Each line becomes a topic; indentation makes branches.')}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              // Tab indents instead of leaving the field.
              e.preventDefault();
              const el = e.currentTarget;
              const { selectionStart, selectionEnd } = el;
              const next = `${text.slice(0, selectionStart)}  ${text.slice(selectionEnd)}`;
              setText(next);
              requestAnimationFrame(() => el.setSelectionRange(selectionStart + 2, selectionStart + 2));
            }
          }}
          placeholder={'# Q3 plan\n- Ads\n  - Google\n  - Meta\n- SEO'}
          className="min-h-[220px] rounded-xl font-mono text-sm"
          autoFocus
          data-testid="board-import-textarea"
        />
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">{count ? `${count} ${count === 1 ? t('topic') : t('topics')}` : ''}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={() => onImport(text)} disabled={!count} data-testid="board-import-confirm">
              {t('Import')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const title = useStore(store, (s) => s.title);
  const setTitle = useStore(store, (s) => s.setTitle);
  const activeTool = useStore(store, (s) => s.activeTool);
  const setActiveTool = useStore(store, (s) => s.setActiveTool);
  const thumbnailRef = useRef<ThumbnailRenderer | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const { active: presenting, start: startPresent, stop: stopPresent } = usePresentMode(rootRef);
  const presentingRef = useRef(presenting);
  presentingRef.current = presenting;
  const aiEnabled = useBoardsAiEnabled();

  const [loaded, setLoaded] = useState(false);
  // Remounts the canvas when the saved version is loaded over local edits.
  const [canvasKey, setCanvasKey] = useState(0);
  const [visibility, setVisibility] = useState<BoardVisibility>('private');
  const [slug, setSlug] = useState('');
  const [visibilityPending, setVisibilityPending] = useState(false);
  const [restoreSnapshot, setRestoreSnapshot] = useState<BoardSnapshot | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [styleSheetOpen, setStyleSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ document: BoardDocument; repaired: number } | null>(null);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  // Phones get a bottom toolbar; below lg the style panel is a sheet.
  const isPhone = useMediaQuery('(max-width: 767px)');
  const isWide = useMediaQuery('(min-width: 1024px)');
  const hasSelection = useStore(store, (s) => s.selection.nodeIds.length + s.selection.edgeIds.length > 0);
  // Image export covers the whole board, or just the frame when exactly one is selected.
  const selectedFrameId = useStore(store, (s) => {
    if (s.selection.nodeIds.length !== 1 || s.selection.edgeIds.length) return null;
    const node = s.document.nodes.find((n) => n.id === s.selection.nodeIds[0]);
    return node?.data.type === 'frame' ? node.id : null;
  });
  const selectedFrameTitle = useStore(store, (s) => {
    const node = selectedFrameId ? s.document.nodes.find((n) => n.id === selectedFrameId) : undefined;
    return node?.data.type === 'frame' ? (node.data.title ?? '') : '';
  });
  const selectedFrame = selectedFrameId ? { id: selectedFrameId, title: selectedFrameTitle } : null;
  const canPresent = useStore(store, (s) => s.document.nodes.length > 0 || s.document.strokes.length > 0);

  function exportMarkdown() {
    const markdown = exportOutline(store);
    if (!markdown.trim()) {
      toast({ title: t('There is no mind map to export yet') });
      return;
    }
    downloadText(fileNameFor(store.getState().title, 'md'), markdown);
  }

  function importText(text: string) {
    const rootId = importOutlineText(store, text, t('Imported outline'));
    if (rootId) {
      setImportOpen(false);
      toast({ title: t('Outline imported') });
    }
  }

  async function exportImage(format: 'png' | 'svg') {
    const api = store.getState().canvasApi;
    if (!api || exporting) return;
    setExporting(true);
    try {
      const frame = selectedFrame;
      const blob = await api.renderImage({ format, frameId: frame?.id ?? null });
      const name = frame?.title.trim() ? `${store.getState().title} - ${frame.title.trim()}` : store.getState().title;
      downloadBlob(fileNameFor(name, format), blob);
    } catch (err) {
      if (err instanceof EmptyBoardError) toast({ title: t('There is nothing to export yet') });
      else toast({ title: t('Could not export the image'), description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }

  function exportJson() {
    const json = serializeBoardJson(getDocumentForSave(store.getState()));
    downloadBlob(fileNameFor(store.getState().title, 'json'), new Blob([json], { type: 'application/json;charset=utf-8' }));
  }

  function handleExport(kind: 'png' | 'svg' | 'json') {
    if (kind === 'json') exportJson();
    else void exportImage(kind);
  }

  // The imported document replaces the board as one undoable edit (Ctrl+Z brings the old one back).
  function applyImport(imported: { document: BoardDocument; repaired: number }) {
    store.getState().setDocument(imported.document);
    requestAnimationFrame(() => store.getState().canvasApi?.fitContent({ duration: 0 }));
    toast({
      title: t('Board imported'),
      description: imported.repaired ? t('Some broken items in the file were dropped. Undo brings the previous board back.') : t('Undo brings the previous board back.'),
    });
  }

  async function importJsonFile(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: t('Could not import the file'), description: t('The file is too large.'), variant: 'destructive' });
      return;
    }
    const parsed = parseBoardJson(await file.text());
    if (!parsed.ok) {
      toast({ title: t('Could not import the file'), description: t(parsed.error), variant: 'destructive' });
      return;
    }
    if (isDocumentEmpty(store.getState().document)) applyImport(parsed);
    else setPendingImport(parsed);
  }

  async function summarize() {
    setSummary(null);
    setSummaryOpen(true);
    setSummaryLoading(true);
    try {
      const text = await summarizeBoard(store, language === 'pt' ? 'pt' : 'en');
      if (text === null) {
        setSummaryOpen(false);
        toast({ title: t('There is nothing to summarize yet') });
      } else {
        setSummary(text);
      }
    } catch (err) {
      setSummaryOpen(false);
      toast({ title: t('Could not summarize the board'), description: t(aiErrorMessage(err)), variant: 'destructive' });
    } finally {
      setSummaryLoading(false);
    }
  }

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

  // An explicit save also sends the card thumbnail now instead of waiting for the throttle.
  const saveNow = useCallback(() => {
    void autosave
      .save()
      .then(() => autosave.flushThumbnail())
      .catch(() => undefined);
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
    // Saved against the version the snapshot was based on: if the board was
    // saved elsewhere since, the conflict dialog asks instead of overwriting.
    if (restoreSnapshot.baseVersion !== null) autosave.setBaseVersion(restoreSnapshot.baseVersion);
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
        toast({ title: updated.visibility === 'link' ? t('Link sharing is on') : t('Board is private') });
      } else {
        // Nothing was sent (a conflict is waiting to be resolved, or saving is
        // paused): the stored visibility did not change.
        setVisibility(previous);
        toast({
          title: t('Could not change sharing'),
          description: status === 'conflict' ? t('Resolve the save conflict first.') : t('Try again in a moment.'),
          variant: 'destructive',
        });
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
      if (presentingRef.current) return;
      if (event.altKey && event.shiftKey && event.code === 'KeyP' && !(event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void startPresent();
        return;
      }
      if (event.key === '?' && !isTypingTarget(event.target)) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [startPresent, saveNow]);

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
    if (!clean && !window.confirm(t('You have unsaved changes. Leave without saving?'))) {
      setClosing(false);
      return;
    }
    // Step back over the guard entry first, so leaving never stacks the list on
    // top of an editor entry (browser Back would reopen the editor).
    if (guardEntryRef.current) {
      guardEntryRef.current = false;
      await new Promise<void>((resolve) => {
        const done = () => {
          window.clearTimeout(timer);
          window.removeEventListener('popstate', done);
          resolve();
        };
        const timer = window.setTimeout(done, 1_000);
        window.addEventListener('popstate', done);
        window.history.back();
      });
    }
    setClosing(false);
    onClose();
  }

  // Portaled to <body>: the admin layout's containers would otherwise clip and
  // offset a fixed full-screen editor.
  return createPortal(
    <TooltipProvider delayDuration={300}>
      <div ref={rootRef} className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="board-editor" data-presenting={presenting ? 'true' : undefined}>
        <header className={cn('h-14 shrink-0 items-center gap-2 border-b px-3', presenting ? 'hidden' : 'flex')}>
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
            onBlur={() => {
              // A board always has a title: a cleared field shows the saved one again.
              const s = store.getState();
              if (!s.title.trim()) setTitle(s.savedTitle);
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
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void startPresent()}
              disabled={!loaded || !canPresent}
              aria-label={t('Present')}
              data-testid="board-present"
            >
              <Play className="h-4 w-4" />
              <span className="hidden md:inline">{t('Present')}</span>
            </Button>
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
              <ShareMenu
                slug={slug}
                visibility={visibility}
                onVisibilityChange={(v) => void changeVisibility(v)}
                pending={visibilityPending}
                disabled={!loaded}
                onExport={handleExport}
                exporting={exporting}
                frameSelected={!!selectedFrame}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={!loaded} aria-label={t('More')} data-testid="board-more">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-xl" data-testid="board-more-menu">
                <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('Mind map')}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={exportMarkdown} data-testid="board-export-markdown">
                  <FileDown className="mr-2 h-4 w-4" />
                  {t('Export outline (Markdown)')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setImportOpen(true)} data-testid="board-import-text">
                  <FileUp className="mr-2 h-4 w-4" />
                  {t('Import from text')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {selectedFrame ? t('Export (selected frame)') : t('Export')}
                </DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => void exportImage('png')} disabled={exporting} data-testid="board-export-png">
                  <ImageDown className="mr-2 h-4 w-4" />
                  {t('Export as PNG')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportImage('svg')} disabled={exporting} data-testid="board-export-svg">
                  <Shapes className="mr-2 h-4 w-4" />
                  {t('Export as SVG')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={exportJson} data-testid="board-export-json">
                  <FileJson className="mr-2 h-4 w-4" />
                  {t('Export as JSON')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => jsonInputRef.current?.click()} data-testid="board-import-json">
                  <FileUp className="mr-2 h-4 w-4" />
                  {t('Import JSON')}
                </DropdownMenuItem>
                {aiEnabled && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('AI')}</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => setAiGenerateOpen(true)} data-testid="board-more-ai-generate">
                      <Sparkles className="mr-2 h-4 w-4 text-[#5173D6]" />
                      {t('Generate mind map from a topic')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void summarize()} data-testid="board-more-ai-summarize">
                      <Sparkles className="mr-2 h-4 w-4 text-[#5173D6]" />
                      {t('Summarize board')}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void startPresent()} disabled={!canPresent} data-testid="board-more-present">
                  <Play className="mr-2 h-4 w-4" />
                  {t('Present')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTemplatesOpen(true)} data-testid="board-more-templates">
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  {t('Insert template')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
                  <Keyboard className="mr-2 h-4 w-4" />
                  {t('Keyboard shortcuts')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                <BoardCanvas
                  key={canvasKey}
                  thumbnailRef={thumbnailRef}
                  zoomBarClassName={isPhone ? '!mb-[84px]' : undefined}
                  onShowShortcuts={() => setShortcutsOpen(true)}
                  presenting={presenting}
                >
                  <PresentOverlay active={presenting} onExit={stopPresent} />
                </BoardCanvas>
                {presenting ? null : isPhone ? (
                  <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-col items-center gap-2">
                    <ToolOptions orientation="horizontal" className="pointer-events-auto max-w-full" />
                    <Toolbar
                      activeTool={activeTool}
                      onSelectTool={setActiveTool}
                      onOpenTemplates={() => setTemplatesOpen(true)}
                      onOpenAi={aiEnabled ? () => setAiGenerateOpen(true) : undefined}
                      orientation="horizontal"
                      className="pointer-events-auto max-w-full"
                    />
                  </div>
                ) : (
                  <div className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center gap-2">
                    <Toolbar activeTool={activeTool} onSelectTool={setActiveTool} onOpenTemplates={() => setTemplatesOpen(true)} onOpenAi={aiEnabled ? () => setAiGenerateOpen(true) : undefined} className="pointer-events-auto max-h-full overflow-y-auto" />
                    <ToolOptions className="pointer-events-auto" />
                  </div>
                )}
                {!isWide && !presenting && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn('absolute right-3 top-3 z-10 gap-2 rounded-xl bg-background/95 shadow-md backdrop-blur', hasSelection && 'border-[#5173D6] text-[#5173D6]')}
                    onClick={() => setStyleSheetOpen(true)}
                    data-testid="board-style-sheet-open"
                  >
                    <Paintbrush className="h-4 w-4" />
                    {t('Style')}
                  </Button>
                )}
              </div>
              {isWide && !presenting && <StylePanel />}
              {!isWide && !presenting && (
                <Sheet open={styleSheetOpen} onOpenChange={setStyleSheetOpen}>
                  <SheetContent
                    side={isPhone ? 'bottom' : 'right'}
                    className={cn('p-0', isPhone ? 'h-[62vh] rounded-t-2xl' : 'w-80')}
                    data-testid="board-style-sheet"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <SheetTitle className="sr-only">{t('Style')}</SheetTitle>
                    <SheetDescription className="sr-only">{t('Style the selection and the board')}</SheetDescription>
                    <StylePanel variant="sheet" />
                  </SheetContent>
                </Sheet>
              )}
            </>
          )}
        </div>

        <input
          ref={jsonInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          data-testid="board-import-json-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importJsonFile(file);
          }}
        />
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        <AiGenerateDialog
          open={aiGenerateOpen}
          onOpenChange={setAiGenerateOpen}
          onGenerate={(input) => generateMindmapFromTopic(store, input)}
        />
        <AiSummaryDialog open={summaryOpen} onOpenChange={setSummaryOpen} loading={summaryLoading} summary={summary} />
        <AlertDialog open={!!pendingImport} onOpenChange={(open) => !open && setPendingImport(null)}>
          <AlertDialogContent data-testid="board-import-json-confirm-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('Replace this board?')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('Importing the file replaces everything on this board. You can undo it right after with Ctrl+Z.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingImport) applyImport(pendingImport);
                  setPendingImport(null);
                }}
                data-testid="board-import-json-confirm"
              >
                {t('Replace')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <ImportTextDialog open={importOpen} onOpenChange={setImportOpen} onImport={importText} />
        <TemplatePicker
          open={templatesOpen}
          onOpenChange={setTemplatesOpen}
          onPick={(templateId) => {
            setTemplatesOpen(false);
            setActiveTool('select');
            insertTemplate(store, templateId);
          }}
        />

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
