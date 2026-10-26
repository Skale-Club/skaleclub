import { useCallback, useEffect, useRef, useState } from 'react';
import { Panel, useReactFlow, useStoreApi as useFlowStoreApi } from '@xyflow/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { buildPresentSteps, type PresentStep } from '@shared/boards/present';
import { useTranslation } from '@/hooks/useTranslation';
import { useBoardStoreApi } from '../store/boardStore';
import { frameBox } from '../engine/camera';

export const PRESENT_CAMERA_MS = 400;
const SWIPE_PX = 48;

interface PresentOverlayProps {
  active: boolean;
  onExit: () => void;
}

// The slideshow: while `active`, steps through the board's frames (or a mind
// map's branches), moving the camera with a 400 ms animation. Space, the arrows,
// a click or a swipe advance; Escape leaves. Render it inside <BoardCanvas>.
export function PresentOverlay({ active, onExit }: PresentOverlayProps) {
  const { t } = useTranslation();
  const store = useBoardStoreApi();
  const reactFlow = useReactFlow();
  const flowStore = useFlowStoreApi();
  const [steps, setSteps] = useState<PresentStep[]>([]);
  const [index, setIndex] = useState(0);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const count = steps.length;

  // Slides are built once when the presentation starts: edits are not possible meanwhile.
  useEffect(() => {
    if (!active) {
      setSteps([]);
      setIndex(0);
      return;
    }
    const state = store.getState();
    state.clearSelection();
    state.setEditingNode(null);
    state.setActiveTool('select');
    setSteps(buildPresentSteps(state.document, state.measured));
    setIndex(0);
    return () => store.getState().setPresentFocus(null);
  }, [active, store]);

  const step = steps[index];
  const next = useCallback(() => setIndex((i) => Math.min(Math.max(count - 1, 0), i + 1)), [count]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const frameStep = useCallback(
    (duration: number) => {
      if (!step) return;
      store.getState().setPresentFocus(step.focusIds);
      frameBox(reactFlow, flowStore.getState(), step.box, { padding: step.kind === 'frame' ? 0.06 : 0.14, maxZoom: 2, duration });
    },
    [flowStore, reactFlow, step, store],
  );

  // A new slide: animate there. (Waits a frame so the chrome has left and the canvas has its final size.)
  useEffect(() => {
    if (!active || !step) return;
    const frame = requestAnimationFrame(() => frameStep(PRESENT_CAMERA_MS));
    return () => cancelAnimationFrame(frame);
  }, [active, step, frameStep]);

  // Full screen / window resizes: keep the slide framed, without animation.
  useEffect(() => {
    if (!active) return;
    let timer = 0;
    const refit = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => frameStep(0), 120);
    };
    window.addEventListener('resize', refit);
    document.addEventListener('fullscreenchange', refit);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', refit);
      document.removeEventListener('fullscreenchange', refit);
    };
  }, [active, frameStep]);

  // Keys never reach the editor underneath while presenting.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const mod = event.ctrlKey || event.metaKey || event.altKey;
      if (key === 'Escape') {
        event.preventDefault();
        exitRef.current();
      } else if (!mod && (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown' || key === ' ' || key === 'Enter')) {
        event.preventDefault();
        next();
      } else if (!mod && (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp' || key === 'Backspace')) {
        event.preventDefault();
        prev();
      } else if (!mod && key === 'Home') {
        event.preventDefault();
        setIndex(0);
      } else if (!mod && key === 'End') {
        event.preventDefault();
        setIndex(Math.max(count - 1, 0));
      }
      // Whatever the key, the editor underneath (tool keys, undo, delete) never sees it.
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [active, count, next, prev]);

  const pointer = useRef<{ x: number; y: number } | null>(null);
  if (!active) return null;

  return (
    <>
      <div
        className="absolute inset-0 z-[4] cursor-pointer touch-none select-none"
        data-testid="present-surface"
        onPointerDown={(e) => {
          pointer.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = pointer.current;
          pointer.current = null;
          if (!start || e.button > 0) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
          else if (Math.hypot(dx, dy) < 10) next();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          prev();
        }}
      />
      <Panel position="bottom-center" className="!mb-5">
        <div
          className="flex items-center gap-1 rounded-full border bg-background/90 px-1.5 py-1 text-foreground shadow-lg backdrop-blur"
          data-testid="present-controls"
        >
          <button
            type="button"
            onClick={prev}
            disabled={index <= 0}
            aria-label={t('Previous slide')}
            data-testid="present-prev"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums" data-testid="present-counter" aria-live="polite">
            {count ? `${index + 1} / ${count}` : '0 / 0'}
          </span>
          <button
            type="button"
            onClick={next}
            disabled={index >= count - 1}
            aria-label={t('Next slide')}
            data-testid="present-next"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="mx-1 h-5 w-px bg-border" />
          <button
            type="button"
            onClick={onExit}
            aria-label={t('Exit presentation')}
            data-testid="present-exit"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </Panel>
    </>
  );
}
