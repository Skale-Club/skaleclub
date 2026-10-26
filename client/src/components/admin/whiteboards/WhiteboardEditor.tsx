import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import '@/components/whiteboard/excalidrawAssets';
import { Excalidraw, MainMenu, WelcomeScreen, getSceneVersion } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import '@/components/whiteboard/whiteboardEditor.css';
import { ArrowLeft, Check, Copy, ExternalLink, Save, Share2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Loader2 } from '@/components/ui/loader';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { apiRequest, HttpError, queryClient } from '@/lib/queryClient';
import { createWhiteboardThumbnail, serializeWhiteboardScene, toInitialData, waitForImageFiles, whiteboardPublicUrl } from '@/components/whiteboard/whiteboardScene';
import type { Whiteboard } from '@shared/schema';

interface WhiteboardEditorProps {
  /** The board to edit, or null for a new one that has no record until its first save. */
  id: string | null;
  /** Called once the first save has created the board, so the URL can move to its id. */
  onCreated?: (id: string) => void;
  /** `replace` when the editor left a guard entry in history (see below). */
  onClose: (opts?: { replace?: boolean }) => void;
}

// The body of a 409 the server sends when the board was saved elsewhere.
function isVersionConflict(err: unknown): boolean {
  if (!(err instanceof HttpError) || err.status !== 409) return false;
  try {
    return JSON.parse(err.message.slice(err.message.indexOf(':') + 1)).code === 'version_conflict';
  } catch {
    return false;
  }
}

// "Whiteboard 26/10 14:30": what a new board is called when saved without a name.
function defaultWhiteboardName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `Whiteboard ${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

type ChangeArgs = Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>['onChange']>>;

// Anything that changes what a viewer of /w/:slug would see. The editor's
// theme follows the app and is not part of the board, so it is left out.
function sceneSignature(elements: ChangeArgs[0], appState: ChangeArgs[1], files: ChangeArgs[2]): string {
  return [
    getSceneVersion(elements),
    appState.viewBackgroundColor,
    appState.gridModeEnabled,
    Object.keys(files).length,
  ].join('|');
}

export function WhiteboardEditor({ id, onCreated, onClose }: WhiteboardEditorProps) {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  // False once the editor is gone: a request still in flight must not bring the
  // board back or save a canvas that was discarded.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const savedSignatureRef = useRef<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // null until a new board's first save creates it. Later changes of the `id`
  // prop (the URL moving to the created board) are ignored: this editor already
  // holds that board's canvas.
  const [boardId, setBoardId] = useState<string | null>(id);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [namePlaceholder, setNamePlaceholder] = useState('');
  const [title, setTitle] = useState('');
  const [savedTitle, setSavedTitle] = useState('');
  const [copied, setCopied] = useState(false);
  // The stored version this editor's content is based on (sent with each save).
  const baseVersionRef = useRef<number | null>(null);
  const [conflict, setConflict] = useState(false);
  // Remounts Excalidraw when the latest saved version is loaded over local edits.
  const [sceneKey, setSceneKey] = useState(0);
  // Bumped with sceneKey but synchronously: the instance being replaced can
  // still fire onChange before it unmounts, and must not set the new baseline.
  const sceneKeyRef = useRef(0);

  const { data: board, isLoading, isError } = useQuery<Whiteboard>({
    queryKey: ['/api/whiteboards', boardId],
    queryFn: () => apiRequest('GET', `/api/whiteboards/${boardId}`).then((r) => r.json()),
    enabled: boardId !== null,
    // The editor owns the scene once loaded; a background refetch must not
    // reset what is on the canvas.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Seed the title once: later cache updates (after a save) must not overwrite
  // what is being typed. A new board has no title to load.
  const titleSeededRef = useRef(id === null);
  useEffect(() => {
    if (board && !titleSeededRef.current) {
      titleSeededRef.current = true;
      setTitle(board.title);
      setSavedTitle(board.title);
      baseVersionRef.current = board.version;
    }
  }, [board]);

  const initialData = useMemo(
    () => (board ? toInitialData(board.scene) : boardId === null ? toInitialData(null) : null),
    [board, boardId],
  );
  const hasUnsavedChanges = isDirty || title.trim() !== savedTitle;
  // The board's own look (what /w/:slug opens with) is kept as saved: the editor
  // chrome follows the app theme, and that must not change the stored board.
  const boardTheme: 'light' | 'dark' = board?.scene.appState?.theme === 'dark' ? 'dark' : 'light';
  const boardThemeRef = useRef(boardTheme);
  boardThemeRef.current = boardTheme;

  const handleChange = useCallback((key: number, ...[elements, appState, files]: ChangeArgs) => {
    if (key !== sceneKeyRef.current) return;
    const signature = sceneSignature(elements, appState, files);
    // The first onChange reflects the loaded scene: that is the saved baseline.
    if (savedSignatureRef.current === null) savedSignatureRef.current = signature;
    setIsDirty(signature !== savedSignatureRef.current);
  }, []);

  // Stores the canvas on board `targetId`. `overwrite` saves even if another tab
  // or device saved since this one loaded.
  const persist = useCallback(async (targetId: string, nextTitle: string, overwrite: boolean) => {
    const api = apiRef.current;
    if (!api) return;
    setIsSaving(true);
    const currentSignature = () =>
      sceneSignature(api.getSceneElementsIncludingDeleted(), api.getAppState(), api.getFiles());
    try {
      await waitForImageFiles(api);
      if (!mountedRef.current) return;
      // Snapshot first: anything drawn while the request is in flight stays unsaved.
      const scene = serializeWhiteboardScene(api, boardThemeRef.current);
      const sentSignature = currentSignature();
      // A failed thumbnail never blocks the save; the card keeps the old one.
      const thumbnailUrl = await createWhiteboardThumbnail(scene).catch((err) => {
        console.warn('Failed to render whiteboard thumbnail', err);
        return undefined;
      });
      const response = await apiRequest('PUT', `/api/whiteboards/${targetId}`, {
        title: nextTitle,
        scene,
        thumbnailUrl,
        baseVersion: overwrite ? undefined : (baseVersionRef.current ?? undefined),
      });
      const updated = (await response.json()) as Whiteboard;
      baseVersionRef.current = updated.version;
      setConflict(false);
      savedSignatureRef.current = sentSignature;
      setIsDirty(currentSignature() !== sentSignature);
      setSavedTitle(updated.title);
      queryClient.setQueryData(['/api/whiteboards', targetId], updated);
      queryClient.invalidateQueries({ queryKey: ['/api/whiteboards', 'list'] });
      toast({ title: t('Whiteboard saved'), description: t('The public link now shows this version.') });
    } catch (err: any) {
      if (isVersionConflict(err)) {
        setConflict(true);
      } else {
        toast({ title: t('Failed to save whiteboard'), description: err.message, variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  }, [t, toast]);

  // A new board has no record yet: its first save asks for a name, creates the
  // board, then stores the canvas on it like any other save.
  const save = useCallback(async ({ overwrite = false }: { overwrite?: boolean } = {}) => {
    if (!apiRef.current || isSaving) return;
    if (boardId === null) {
      // Ctrl/Cmd+S with the name dialog open confirms it.
      if (nameDialogOpen) {
        confirmName();
        return;
      }
      if (!hasUnsavedChanges) return;
      setNameInput(title);
      setNamePlaceholder(defaultWhiteboardName());
      setNameDialogOpen(true);
      return;
    }
    await persist(boardId, title.trim() || savedTitle, overwrite);
  }, [boardId, confirmName, hasUnsavedChanges, isSaving, nameDialogOpen, persist, savedTitle, title]);

  // Only the top-bar title as it was when the name was confirmed is replaced by
  // the name: something typed since then stays.
  async function createAndSave(name: string, titleAtConfirm: string) {
    setIsSaving(true);
    let created: Whiteboard;
    try {
      created = (await apiRequest('POST', '/api/whiteboards', { title: name }).then((r) => r.json())) as Whiteboard;
    } catch (err: any) {
      creatingRef.current = false;
      setIsSaving(false);
      // Keep the name for a retry.
      setTitle((current) => (current === titleAtConfirm ? name : current));
      toast({ title: t('Failed to create whiteboard'), description: err.message, variant: 'destructive' });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['/api/whiteboards', 'list'] });
    // Left while the board was being created: it stays empty, and the drawing
    // that was discarded is not saved into it.
    if (!mountedRef.current) return;
    // From here the board exists: a failed save below is retried as a normal
    // save of this id, and the canvas keeps what was drawn.
    baseVersionRef.current = created.version;
    queryClient.setQueryData(['/api/whiteboards', created.id], created);
    setBoardId(created.id);
    setTitle((current) => (current === titleAtConfirm ? created.title : current));
    setSavedTitle(created.title);
    onCreated?.(created.id);
    guardUrlRef.current = window.location.href;
    await persist(created.id, created.title, false);
  }

  // Synchronous guard: the dialog stays mounted through its exit animation, so a
  // double click or Enter would otherwise create two boards.
  const creatingRef = useRef(false);
  function confirmName() {
    if (creatingRef.current) return;
    creatingRef.current = true;
    const name = nameInput.trim() || defaultWhiteboardName();
    setNameDialogOpen(false);
    void createAndSave(name, title);
  }

  // Drops local edits and shows what was saved elsewhere.
  const loadLatest = useCallback(async () => {
    try {
      const latest = (await apiRequest('GET', `/api/whiteboards/${boardId}`).then((r) => r.json())) as Whiteboard;
      queryClient.setQueryData(['/api/whiteboards', boardId], latest);
      baseVersionRef.current = latest.version;
      sceneKeyRef.current += 1;
      savedSignatureRef.current = null;
      setIsDirty(false);
      setTitle(latest.title);
      setSavedTitle(latest.title);
      setConflict(false);
      setSceneKey(sceneKeyRef.current);
    } catch (err: any) {
      toast({ title: t('Failed to load whiteboard'), description: err.message, variant: 'destructive' });
    }
  }, [boardId, t, toast]);

  // A dropped scene file would replace the whole board (Excalidraw ignores
  // `loadScene: false` for drops), so those are stopped before Excalidraw sees
  // them. Images, which Excalidraw inserts, pass through.
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const onDrop = (event: DragEvent) => {
      // Excalidraw only reads the first dropped file.
      const file = event.dataTransfer?.files.item(0);
      if (!file || !(/\.(excalidraw|json)$/i.test(file.name) || /^application\/(vnd\.excalidraw\+)?json$/.test(file.type))) return;
      event.preventDefault();
      event.stopPropagation();
    };
    wrap.addEventListener('drop', onDrop, true);
    return () => wrap.removeEventListener('drop', onDrop, true);
  }, []);

  // Ctrl/Cmd+S saves to the server instead of Excalidraw's "save to file".
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        event.stopPropagation();
        void save();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [save]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  // Browser back (or a swipe) would unmount the editor with no warning: while
  // there are unsaved changes, a duplicate history entry absorbs the first back
  // and asks. Once clean, that entry is passed through on the next back.
  const unsavedRef = useRef(hasUnsavedChanges);
  unsavedRef.current = hasUnsavedChanges;
  const guardEntryRef = useRef(false);
  // Set once a new board is created: guard entries then carry the board's URL, not the /new one
  // that browser back passes through.
  const guardUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hasUnsavedChanges || guardEntryRef.current) return;
    window.history.pushState({ whiteboardGuard: true }, '', window.location.href);
    guardEntryRef.current = true;
  }, [hasUnsavedChanges]);
  useEffect(() => {
    const onPopState = () => {
      if (!guardEntryRef.current) return;
      // The guard entry was popped; the URL is still the editor's.
      guardEntryRef.current = false;
      if (unsavedRef.current && !window.confirm(t('You have unsaved changes. Leave without saving?'))) {
        window.history.pushState({ whiteboardGuard: true }, '', guardUrlRef.current ?? window.location.href);
        guardEntryRef.current = true;
        return;
      }
      window.history.back();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [t]);

  function handleClose() {
    if (hasUnsavedChanges && !window.confirm(t('You have unsaved changes. Leave without saving?'))) return;
    // Replace the guard entry rather than stacking the list on top of it.
    onClose({ replace: guardEntryRef.current });
  }

  async function copyLink() {
    if (!board) return;
    try {
      await navigator.clipboard.writeText(whiteboardPublicUrl(board.slug));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: t('Could not copy link'), variant: 'destructive' });
    }
  }

  // Portaled to <body>: the admin layout's containers would otherwise clip and
  // offset a fixed full-screen editor.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="whiteboard-editor">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="icon" onClick={handleClose} aria-label={t('Back')} data-testid="whiteboard-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="h-9 max-w-xs font-medium"
          aria-label={t('Title')}
          disabled={boardId !== null && !board}
          data-testid="whiteboard-title-input"
        />
        <span className="hidden text-xs text-muted-foreground sm:inline" data-testid="whiteboard-save-status">
          {isSaving
            ? t('Saving…')
            : hasUnsavedChanges
              ? t('Unsaved changes')
              : boardId === null
                ? t('Not saved yet')
                : t('All changes saved')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {board && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" aria-label={t('Share')} data-testid="whiteboard-share">
                  <Share2 className="h-4 w-4" />
                  <span className="hidden md:inline">{t('Share')}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 rounded-xl p-4" data-testid="whiteboard-share-menu">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">{t('Share this whiteboard')}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('Anyone with the link sees the last saved version.')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={whiteboardPublicUrl(board.slug)}
                      className="h-9 text-xs"
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label={t('Public link')}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={copyLink}
                      aria-label={t('Copy link')}
                      data-testid="whiteboard-copy-link"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                    <a href={`/w/${board.slug}`} target="_blank" rel="noopener noreferrer" data-testid="whiteboard-open-public">
                      <ExternalLink className="h-4 w-4" />
                      {t('Open public page')}
                    </a>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button
            size="sm"
            className="gap-2"
            onClick={() => void save()}
            disabled={(boardId !== null && !board) || isSaving || !hasUnsavedChanges}
            data-testid="whiteboard-save"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('Save')}
          </Button>
        </div>
      </div>

      <div ref={canvasWrapRef} className="whiteboard-editor-canvas relative min-h-0 flex-1">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {isError && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t('Failed to load whiteboard')}
          </div>
        )}
        {initialData && (
          <Excalidraw
            key={sceneKey}
            initialData={initialData}
            excalidrawAPI={(api) => {
              apiRef.current = api;
            }}
            onChange={(...args) => handleChange(sceneKey, ...args)}
            langCode={language === 'pt' ? 'pt-BR' : 'en'}
            name={title}
            theme={resolvedTheme}
            // Only Export image, canvas background and Help stay in the menu; the
            // flags also switch off the matching shortcuts.
            UIOptions={{
              canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                export: false,
                clearCanvas: false,
                toggleTheme: false,
                saveAsImage: true,
                changeViewBackgroundColor: true,
              },
            }}
            autoFocus
          >
            <MainMenu>
              <MainMenu.DefaultItems.SaveAsImage />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
              <MainMenu.DefaultItems.Help />
            </MainMenu>
            <WelcomeScreen>
              <WelcomeScreen.Hints.MenuHint>{t('Export image, canvas color')}</WelcomeScreen.Hints.MenuHint>
              <WelcomeScreen.Hints.ToolbarHint>{t('Pick a tool and start drawing')}</WelcomeScreen.Hints.ToolbarHint>
              <WelcomeScreen.Center>
                <WelcomeScreen.Center.Heading>{t('Start drawing')}</WelcomeScreen.Center.Heading>
                <p className="text-sm text-muted-foreground">{t('Pick a tool above or press 1–9')}</p>
              </WelcomeScreen.Center>
            </WelcomeScreen>
          </Excalidraw>
        )}
      </div>

      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent data-testid="whiteboard-name-dialog">
          <DialogHeader>
            <DialogTitle>{t('Name your whiteboard')}</DialogTitle>
            <DialogDescription>{t('You can change it later.')}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmName();
            }}
          >
            <Input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={namePlaceholder}
              maxLength={200}
              data-testid="whiteboard-name-input"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setNameDialogOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button type="submit" disabled={isSaving} data-testid="whiteboard-name-confirm">
                {t('Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={conflict} onOpenChange={setConflict}>
        <AlertDialogContent data-testid="whiteboard-conflict">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('This board was saved somewhere else')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Another tab or device saved this whiteboard after you opened it. Keep your version and overwrite theirs, or load the saved version and lose your unsaved changes.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <Button variant="outline" onClick={() => void loadLatest()} data-testid="whiteboard-conflict-load">
              {t('Load saved version')}
            </Button>
            <AlertDialogAction onClick={() => void save({ overwrite: true })} data-testid="whiteboard-conflict-overwrite">
              {t('Overwrite with mine')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>,
    document.body,
  );
}
