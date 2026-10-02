import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import type { LayerResult, VectorizeResult } from '@shared/vectorizer/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PreviewMode = 'compare' | 'vector' | 'outline' | 'check';

interface PreviewPanelProps {
  result: VectorizeResult;
  imageUrl: string;
  mode: PreviewMode;
  hiddenLayers: Set<string>;
  includeBase: boolean;
}

/** Zoom with the wheel or buttons, drag to pan. */
function usePanZoom() {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      setView((v) => {
        const scale = Math.min(40, Math.max(0.5, v.scale * Math.exp(-e.deltaY * 0.0015)));
        const k = scale / v.scale;
        return { scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const d = drag.current;
      if (!d) return;
      setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
    },
    onPointerUp: () => {
      drag.current = null;
    },
  };
  const zoom = (factor: number) => setView((v) => ({ scale: Math.min(40, Math.max(0.5, v.scale * factor)), x: v.x * factor, y: v.y * factor }));
  const reset = () => setView({ scale: 1, x: 0, y: 0 });
  return { ref, view, handlers, zoom, reset };
}

/** Segment end points of a path, for the node view. */
function pathNodes(d: string): Array<{ x: number; y: number; kind: 'M' | 'L' | 'C' }> {
  const out: Array<{ x: number; y: number; kind: 'M' | 'L' | 'C' }> = [];
  const re = /([MLC])([^MLCZ]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const nums = m[2].trim().split(/[ ,]+/).map(Number);
    out.push({ x: nums[nums.length - 2], y: nums[nums.length - 1], kind: m[1] as 'M' | 'L' | 'C' });
  }
  return out;
}

const CHECKER =
  'bg-[length:16px_16px] bg-[linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%),linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%)] bg-[position:0_0,8px_8px]';

export function PreviewPanel({ result, imageUrl, mode, hiddenLayers, includeBase }: PreviewPanelProps) {
  const { ref, view, handlers, zoom, reset } = usePanZoom();
  const [split, setSplit] = useState(50);
  const vb = result.viewBox;
  const overlayUrl = useOverlayUrl(result);

  const visible = result.layers.filter((l) => !hiddenLayers.has(l.key) && (includeBase || !l.isBase));
  const strokeW = Math.max(vb.width, vb.height) / 900;

  // Original image placed so its artwork lines up with the vector artwork.
  const src = result.art.source;
  const fullW = result.art.mm.width / src.width;
  const fullH = result.art.mm.height / src.height;
  const imgStyle = {
    left: `${((result.art.mm.x - src.x * fullW) / vb.width) * 100}%`,
    top: `${((result.art.mm.y - src.y * fullH) / vb.height) * 100}%`,
    width: `${(fullW / vb.width) * 100}%`,
    height: `${(fullH / vb.height) * 100}%`,
  };

  const nodes = useMemo(
    () => (mode === 'outline' ? visible.flatMap((l) => pathNodes(l.d)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, result, hiddenLayers, includeBase],
  );

  const vectorSvg = (children?: ReactNode) => (
    <svg viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`} className="absolute inset-0 h-full w-full" shapeRendering="geometricPrecision">
      {visible.map((l: LayerResult) =>
        mode === 'outline' ? (
          <path key={l.key} d={l.d} fill={l.color} fillOpacity={0.35} stroke="currentColor" strokeWidth={strokeW / view.scale} />
        ) : (
          <path key={l.key} d={l.d} fill={l.color} />
        ),
      )}
      {children}
    </svg>
  );

  return (
    <div className="relative">
      <div
        ref={ref}
        {...handlers}
        className={cn('relative h-[58vh] min-h-[360px] cursor-grab overflow-hidden rounded-xl border bg-background active:cursor-grabbing', CHECKER)}
        data-testid="vectorizer-preview"
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: `min(92%, calc(52vh * ${vb.width / vb.height}))`,
            aspectRatio: `${vb.width} / ${vb.height}`,
            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: 'center',
          }}
        >
          {mode === 'compare' && (
            <img src={imageUrl} alt="Original" draggable={false} className="absolute max-w-none select-none" style={imgStyle} />
          )}
          {mode === 'compare' ? (
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
              {vectorSvg()}
            </div>
          ) : (
            vectorSvg(
              mode === 'outline' ? (
                <g>
                  {nodes.map((n, i) => (
                    <circle
                      key={i}
                      cx={n.x}
                      cy={n.y}
                      r={(strokeW * 2.6) / view.scale}
                      fill={n.kind === 'L' ? '#16a34a' : n.kind === 'M' ? '#2563eb' : '#e11d48'}
                      stroke="#fff"
                      strokeWidth={(strokeW * 0.8) / view.scale}
                    />
                  ))}
                </g>
              ) : undefined,
            )
          )}
          {mode === 'check' && overlayUrl && (
            <img src={overlayUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full [image-rendering:pixelated]" />
          )}
          {mode === 'compare' && (
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary shadow" style={{ left: `${split}%` }} />
          )}
        </div>

        <div className="absolute right-3 top-3 flex flex-col gap-1" data-no-pan>
          <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => zoom(1.4)} aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => zoom(1 / 1.4)} aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="secondary" className="h-8 w-8" onClick={reset} aria-label="Fit">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-background/85 px-2 py-1 text-xs text-muted-foreground shadow-sm">
          {result.modelWidthMm.toFixed(1)} × {result.modelHeightMm.toFixed(1)} mm · {Math.round(view.scale * 100)}%
        </div>
        {mode === 'compare' && (
          <div className="pointer-events-none absolute bottom-3 right-3 flex gap-2 text-xs font-medium">
            <span className="rounded bg-background/85 px-2 py-1 shadow-sm">Original</span>
            <span className="rounded bg-primary px-2 py-1 text-primary-foreground shadow-sm">Vector</span>
          </div>
        )}
      </div>
      {mode === 'compare' && (
        <input
          type="range"
          min={0}
          max={100}
          value={split}
          onChange={(e) => setSplit(Number(e.target.value))}
          className="mt-3 w-full accent-[hsl(var(--primary))]"
          aria-label="Compare original and vector"
          data-testid="vectorizer-compare-slider"
        />
      )}
      {mode === 'check' && (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-500 align-middle" />
          Red = details thinner than the minimum feature size. They may not print, or print broken.
          {!overlayUrl && ' Nothing is too thin — every detail is printable.'}
        </p>
      )}
      {mode === 'outline' && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-green-600 align-middle" />straight line</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-rose-600 align-middle" />curve</span>
          <span>
            {result.stats.segmentCount} segments · {result.stats.lineCount} lines · {result.stats.curveCount} curves · {result.stats.circleCount} perfect circles
          </span>
        </p>
      )}
    </div>
  );
}

function useOverlayUrl(result: VectorizeResult): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const o = result.overlay;
    if (!o) {
      setUrl(null);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = o.width;
    canvas.height = o.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(o.data), o.width, o.height), 0, 0);
    setUrl(canvas.toDataURL('image/png'));
  }, [result]);
  return url;
}
