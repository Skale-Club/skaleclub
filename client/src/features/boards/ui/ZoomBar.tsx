import { CircleHelp, Maximize, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useBoardHistory, useBoardStore } from '../store/boardStore';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const FIT_VIEW_OPTIONS = { padding: 0.2, maxZoom: 1.25, duration: 250 } as const;

function BarButton({
  label,
  onClick,
  disabled,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          data-testid={testId}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

// Bottom-left camera controls: undo/redo while editing, then − / zoom %
// (click for 100%) / + / fit. Must render inside the ReactFlowProvider.
export function ZoomBar({ showHistory = true, className, onShowShortcuts }: { showHistory?: boolean; className?: string; onShowShortcuts?: () => void }) {
  const { t } = useTranslation();
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const canUndo = useBoardHistory((h) => h.pastStates.length > 0);
  const canRedo = useBoardHistory((h) => h.futureStates.length > 0);
  const canvasApi = useBoardStore((s) => s.canvasApi);

  return (
    <div
      className={cn('flex items-center gap-0.5 rounded-xl border bg-background/95 p-1 shadow-md backdrop-blur', className)}
      data-testid="board-zoom-bar"
    >
      {showHistory && (
        <>
          <BarButton label={t('Undo')} onClick={undo} disabled={!canUndo} testId="board-undo">
            <Undo2 className="h-4 w-4" />
          </BarButton>
          <BarButton label={t('Redo')} onClick={redo} disabled={!canRedo} testId="board-redo">
            <Redo2 className="h-4 w-4" />
          </BarButton>
          <div className="mx-0.5 h-5 w-px bg-border" />
        </>
      )}
      <BarButton label={t('Zoom out')} onClick={() => void zoomOut({ duration: 150 })} disabled={zoom <= MIN_ZOOM + 0.001} testId="board-zoom-out">
        <Minus className="h-4 w-4" />
      </BarButton>
      <button
        type="button"
        onClick={() => void zoomTo(1, { duration: 150 })}
        className="h-8 min-w-[3.25rem] rounded-lg px-1.5 text-xs font-semibold tabular-nums text-foreground transition-colors hover:bg-muted"
        aria-label={t('Reset zoom to 100%')}
        data-testid="board-zoom-level"
      >
        {Math.round(zoom * 100)}%
      </button>
      <BarButton label={t('Zoom in')} onClick={() => void zoomIn({ duration: 150 })} disabled={zoom >= MAX_ZOOM - 0.001} testId="board-zoom-in">
        <Plus className="h-4 w-4" />
      </BarButton>
      <BarButton label={t('Fit to screen')} onClick={() => (canvasApi ? canvasApi.fitContent() : void fitView(FIT_VIEW_OPTIONS))} testId="board-zoom-fit">
        <Maximize className="h-4 w-4" />
      </BarButton>
      {onShowShortcuts && (
        <>
          <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
          <span className="hidden sm:inline-flex">
            <BarButton label={t('Keyboard shortcuts (?)')} onClick={onShowShortcuts} testId="board-zoom-shortcuts">
              <CircleHelp className="h-4 w-4" />
            </BarButton>
          </span>
        </>
      )}
    </div>
  );
}
