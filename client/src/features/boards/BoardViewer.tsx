import { useEffect, useRef, useState } from 'react';
import { Panel } from '@xyflow/react';
import { Check, Link2, Maximize, Moon, Play, Share2, Sun } from 'lucide-react';
import { normalizeDocument } from '@shared/boards/document';
import type { PublicBoard } from '@shared/schema';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { BoardStoreProvider, useCreateBoardStore } from './store/boardStore';
import { BoardCanvas } from './engine/BoardCanvas';
import { PresentOverlay } from './present/PresentOverlay';
import { usePresentMode } from './present/usePresentMode';
import { ShortcutsDialog, VIEWER_SHORTCUTS } from './ui/ShortcutsDialog';
import { isTypingTarget } from './canvas/interaction';

const CHIP = 'flex h-9 w-9 items-center justify-center rounded-xl border bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground';

// Read-only board for /b/:slug: pan and zoom, fit, light/dark toggle, title
// overlay with a "Made with" link, share, present. No toolbar, no selection,
// nothing is saved. On phones the controls collapse into a bottom bar.
export function BoardViewer({ board }: { board: PublicBoard }) {
  const { t } = useTranslation();
  const store = useCreateBoardStore({ document: normalizeDocument(board.document), title: board.title, readOnly: true });
  const [dark, setDark] = useState(() => !!store.getState().document.theme.dark);
  const rootRef = useRef<HTMLDivElement>(null);
  const { active: presenting, start: startPresent, stop: stopPresent } = usePresentMode(rootRef);
  const presentingRef = useRef(presenting);
  presentingRef.current = presenting;
  const isPhone = useMediaQuery('(max-width: 767px)');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canPresent = board.document.nodes.length > 0 || board.document.strokes.length > 0;

  // F fits, P presents, ? lists the keys. (Arrows and Space belong to the map.)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (presentingRef.current || event.defaultPrevented || isTypingTarget(event.target) || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if ((event.altKey && event.shiftKey && event.code === 'KeyP') || (!event.altKey && key === 'p')) {
        if (!canPresent) return;
        event.preventDefault();
        void startPresent();
      } else if (!event.altKey && key === 'f') {
        event.preventDefault();
        store.getState().canvasApi?.fitContent();
      } else if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canPresent, startPresent, store]);

  async function share() {
    const url = `${window.location.origin}/b/${board.slug}`;
    try {
      // Phones have a native share sheet; everywhere else the link is copied.
      if (isPhone && typeof navigator.share === 'function') {
        await navigator.share({ title: board.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      // The share sheet was dismissed, or the clipboard is blocked.
    }
  }

  const fit = () => store.getState().canvasApi?.fitContent();
  const shareLabel = copied ? t('Link copied') : t('Share link');
  const themeLabel = dark ? t('Light mode') : t('Dark mode');

  return (
    <BoardStoreProvider store={store}>
      <div
        ref={rootRef}
        className={cn(presenting ? 'fixed inset-0 z-50' : 'h-[100dvh] w-full', dark ? 'bg-slate-900' : 'bg-white')}
        data-testid="board-viewer"
        data-presenting={presenting ? 'true' : undefined}
      >
        <BoardCanvas
          readOnly
          dark={dark}
          presenting={presenting}
          onShowShortcuts={() => setShortcutsOpen(true)}
          zoomBarClassName={isPhone ? 'hidden' : undefined}
        >
          {!presenting && (
            <>
              <Panel position="top-left">
                <div className="flex items-start gap-2">
                  <div className="max-w-[calc(100vw-2rem)] rounded-xl border bg-background/90 px-3 py-1.5 shadow-sm backdrop-blur md:max-w-[50vw]">
                    <div className="truncate text-sm font-semibold text-foreground" data-testid="board-viewer-title">
                      {board.title}
                    </div>
                    <a
                      href="/"
                      className="block text-[11px] leading-4 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      data-testid="board-viewer-made-with"
                    >
                      {t('Made with Skale Club')}
                    </a>
                  </div>
                  {!isPhone && canPresent && (
                    <button
                      type="button"
                      onClick={() => void startPresent()}
                      className="flex h-[3.0625rem] items-center gap-2 rounded-xl bg-[#5173D6] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#4562c4]"
                      data-testid="board-viewer-present"
                    >
                      <Play className="h-4 w-4" />
                      {t('Present')}
                    </button>
                  )}
                </div>
              </Panel>
              {!isPhone && (
                <Panel position="top-right">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => void share()} className={CHIP} aria-label={shareLabel} title={shareLabel} data-testid="board-viewer-share">
                      {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => setDark((value) => !value)} className={CHIP} aria-label={themeLabel} title={themeLabel} data-testid="board-viewer-theme">
                      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </button>
                  </div>
                </Panel>
              )}
              {isPhone && (
                <Panel position="bottom-center" className="!mb-8">
                  <div className="flex items-center gap-1 rounded-full border bg-background/95 p-1 shadow-lg backdrop-blur" data-testid="board-viewer-bar">
                    {canPresent && (
                      <button
                        type="button"
                        onClick={() => void startPresent()}
                        className="flex h-10 items-center gap-2 rounded-full bg-[#5173D6] px-4 text-sm font-semibold text-white"
                        data-testid="board-viewer-present"
                      >
                        <Play className="h-4 w-4" />
                        {t('Present')}
                      </button>
                    )}
                    <button type="button" onClick={fit} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground" aria-label={t('Fit to screen')} data-testid="board-viewer-fit">
                      <Maximize className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => void share()} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground" aria-label={shareLabel} data-testid="board-viewer-share">
                      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => setDark((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground" aria-label={themeLabel} data-testid="board-viewer-theme">
                      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </button>
                  </div>
                </Panel>
              )}
            </>
          )}
          <PresentOverlay active={presenting} onExit={stopPresent} />
        </BoardCanvas>
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} groups={VIEWER_SHORTCUTS} />
      </div>
    </BoardStoreProvider>
  );
}
