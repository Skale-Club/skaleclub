import { lazy, Suspense, useEffect } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from '@/components/ui/loader';
import { usePageSeo } from '@/hooks/use-seo';
import { brandPageTitle } from '@shared/seoTitle';
import type { CompanySettings, PublicBoard } from '@shared/schema';

// React Flow and the board renderers load only on this route.
const BoardCanvasViewer = lazy(() => import('@/features/boards/BoardViewer').then((m) => ({ default: m.BoardViewer })));

function FullScreenLoader() {
  return (
    <div className="h-[100dvh] flex items-center justify-center bg-white">
      <Loader2 className="w-8 h-8 animate-spin text-zinc-400" aria-label="Loading" />
    </div>
  );
}

export default function BoardViewerPage() {
  // Shared by link, not meant to rank (title is set below).
  usePageSeo({ title: '', noindex: true });
  const { slug } = useParams<{ slug: string }>();

  const { data: board, isLoading, isError } = useQuery<PublicBoard>({
    queryKey: [`/api/boards/slug/${slug}`],
    retry: false,
  });
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ['/api/company-settings'] });

  useEffect(() => {
    if (board) document.title = brandPageTitle(board.title, settings?.companyName || 'Skale Club');
  }, [board, settings?.companyName]);

  if (isLoading) return <FullScreenLoader />;

  if (isError || !board) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-zinc-950 px-6" data-testid="board-not-found">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-zinc-400 text-sm uppercase tracking-widest">Board not found</p>
          <h1 className="text-white text-3xl font-semibold">This link may have been removed or made private.</h1>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <BoardCanvasViewer board={board} />
    </Suspense>
  );
}
