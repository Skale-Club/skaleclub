import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import '@/components/whiteboard/excalidrawAssets';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { Loader2 } from '@/components/ui/loader';
import { usePageSeo } from '@/hooks/use-seo';
import { useTranslation } from '@/hooks/useTranslation';
import { toInitialData } from '@/components/whiteboard/whiteboardScene';
import { brandPageTitle } from '@shared/seoTitle';
import type { CompanySettings, WhiteboardScene } from '@shared/schema';

interface PublicWhiteboard {
  id: string;
  slug: string;
  title: string;
  scene: WhiteboardScene;
  updatedAt: string | null;
}

export default function WhiteboardViewer() {
  // Shared from video descriptions, not meant to rank (title is set below).
  usePageSeo({ title: '', noindex: true });
  const { slug } = useParams<{ slug: string }>();
  const { language } = useTranslation();

  const { data: board, isLoading, isError } = useQuery<PublicWhiteboard>({
    queryKey: [`/api/whiteboards/slug/${slug}`],
    retry: false,
  });
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ['/api/company-settings'] });

  useEffect(() => {
    if (board) document.title = brandPageTitle(board.title, settings?.companyName || 'Skale Club');
  }, [board, settings?.companyName]);

  const initialData = useMemo(() => (board ? toInitialData(board.scene) : null), [board]);

  // Open with the whole drawing in view (a phone included), never zoomed past 100%.
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const fittedRef = useRef(false);
  const fitOnFirstContent = useCallback((elements: readonly unknown[]) => {
    if (fittedRef.current || elements.length === 0 || !apiRef.current) return;
    fittedRef.current = true;
    apiRef.current.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.9, maxZoom: 1, animate: false });
  }, []);

  if (isLoading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" aria-label="Loading" />
      </div>
    );
  }

  if (isError || !board || !initialData) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-zinc-950 px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-zinc-400 text-sm uppercase tracking-widest">Whiteboard not found</p>
          <h1 className="text-white text-3xl font-semibold">This link may have been removed.</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full" data-testid="whiteboard-viewer">
      <Excalidraw
        initialData={initialData}
        viewModeEnabled
        excalidrawAPI={(api) => {
          apiRef.current = api;
        }}
        onChange={fitOnFirstContent}
        langCode={language === 'pt' ? 'pt-BR' : 'en'}
        name={board.title}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            clearCanvas: false,
            changeViewBackgroundColor: false,
            export: false,
            saveAsImage: true,
            toggleTheme: true,
          },
        }}
        renderTopRightUI={(_isMobile, appState) => (
          <div
            className={`pointer-events-none max-w-[50vw] truncate rounded-lg px-3 py-1.5 text-sm font-semibold shadow-sm backdrop-blur ${
              appState.theme === 'dark' ? 'bg-zinc-900/80 text-zinc-100' : 'bg-white/80 text-zinc-900'
            }`}
          >
            {board.title}
          </div>
        )}
      />
    </div>
  );
}
