import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import '@/components/whiteboard/excalidrawAssets';
import { Excalidraw, getSceneVersion } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { ArrowLeft, Check, Copy, ExternalLink, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { serializeWhiteboardScene, toInitialData, whiteboardPublicUrl } from '@/components/whiteboard/whiteboardScene';
import type { Whiteboard } from '@shared/schema';

interface WhiteboardEditorProps {
  id: string;
  onClose: () => void;
}

type ChangeArgs = Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>['onChange']>>;

// Anything that changes what a viewer of /w/:slug would see.
function sceneSignature(elements: ChangeArgs[0], appState: ChangeArgs[1], files: ChangeArgs[2]): string {
  return [
    getSceneVersion(elements),
    appState.viewBackgroundColor,
    appState.theme,
    appState.gridModeEnabled,
    Object.keys(files).length,
  ].join('|');
}

export function WhiteboardEditor({ id, onClose }: WhiteboardEditorProps) {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const savedSignatureRef = useRef<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [savedTitle, setSavedTitle] = useState('');
  const [copied, setCopied] = useState(false);

  const { data: board, isLoading, isError } = useQuery<Whiteboard>({
    queryKey: ['/api/whiteboards', id],
    queryFn: () => apiRequest('GET', `/api/whiteboards/${id}`).then((r) => r.json()),
    // The editor owns the scene once loaded; a background refetch must not
    // reset what is on the canvas.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (board) {
      setTitle(board.title);
      setSavedTitle(board.title);
    }
  }, [board]);

  const initialData = useMemo(() => (board ? toInitialData(board.scene) : null), [board]);
  const hasUnsavedChanges = isDirty || title.trim() !== savedTitle;

  const handleChange = useCallback((...[elements, appState, files]: ChangeArgs) => {
    const signature = sceneSignature(elements, appState, files);
    // The first onChange reflects the loaded scene: that is the saved baseline.
    if (savedSignatureRef.current === null) savedSignatureRef.current = signature;
    setIsDirty(signature !== savedSignatureRef.current);
  }, []);

  const save = useCallback(async () => {
    const api = apiRef.current;
    if (!api || isSaving) return;
    const nextTitle = title.trim() || savedTitle;
    setIsSaving(true);
    try {
      const scene = serializeWhiteboardScene(api);
      const response = await apiRequest('PUT', `/api/whiteboards/${id}`, { title: nextTitle, scene });
      const updated = (await response.json()) as Whiteboard;
      savedSignatureRef.current = sceneSignature(
        api.getSceneElementsIncludingDeleted(),
        api.getAppState(),
        api.getFiles(),
      );
      setIsDirty(false);
      setTitle(updated.title);
      setSavedTitle(updated.title);
      queryClient.setQueryData(['/api/whiteboards', id], updated);
      queryClient.invalidateQueries({ queryKey: ['/api/whiteboards', 'list'] });
      toast({ title: t('Whiteboard saved'), description: t('The public link now shows this version.') });
    } catch (err: any) {
      toast({ title: t('Failed to save whiteboard'), description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [id, isSaving, savedTitle, t, title, toast]);

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

  function handleClose() {
    if (hasUnsavedChanges && !window.confirm(t('You have unsaved changes. Leave without saving?'))) return;
    onClose();
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
          disabled={!board}
          data-testid="whiteboard-title-input"
        />
        <span className="hidden text-xs text-muted-foreground sm:inline" data-testid="whiteboard-save-status">
          {isSaving ? t('Saving…') : hasUnsavedChanges ? t('Unsaved changes') : t('All changes saved')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {board && (
            <>
              <Button variant="outline" size="sm" className="gap-2" onClick={copyLink} data-testid="whiteboard-copy-link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="hidden md:inline">{t('Copy link')}</span>
              </Button>
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href={`/w/${board.slug}`} target="_blank" rel="noopener noreferrer" data-testid="whiteboard-open-public">
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden md:inline">{t('Open public page')}</span>
                </a>
              </Button>
            </>
          )}
          <Button
            size="sm"
            className="gap-2"
            onClick={() => void save()}
            disabled={!board || isSaving || !hasUnsavedChanges}
            data-testid="whiteboard-save"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('Save')}
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
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
            initialData={initialData}
            excalidrawAPI={(api) => {
              apiRef.current = api;
            }}
            onChange={handleChange}
            langCode={language === 'pt' ? 'pt-BR' : 'en'}
            name={title}
            UIOptions={{ canvasActions: { loadScene: true, saveToActiveFile: false, toggleTheme: true } }}
            autoFocus
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
