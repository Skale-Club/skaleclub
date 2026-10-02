import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Box,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  FileImage,
  Info,
  Layers,
  Loader2,
  RotateCcw,
  ScanLine,
  Shapes,
  Upload,
} from 'lucide-react';
import type { SvgUnits } from '@shared/vectorizer/pipeline';
import type { BackgroundMode, BaseShape, DetailLevel, ImageAnalysis, KeyringPosition, MeshPart, Model3DOptions, ModelMode, VectorizeOptions } from '@shared/vectorizer/types';
import { AdminCard, SectionHeader } from '@/components/admin/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ACCEPTED_TYPES, decodeImageFile, type DecodedImage } from './decode';
import { PalettePanel, type PaletteItem } from './PalettePanel';
import { PreviewPanel, type PreviewMode } from './PreviewPanel';
import { DEFAULT_MODEL, PLA_DENSITY, PRINTERS, PROJECTS } from './presets';
import { useVectorizerWorker } from './useVectorizerWorker';
import type { ExportFormat } from './protocol';

const ModelViewer = lazy(() => import('./ModelViewer'));

type Tab = PreviewMode | '3d';

const STAGES: Record<string, string> = {
  start: 'Starting',
  resample: 'Resampling',
  segment: 'Separating colors',
  cleanup: 'Cleaning up for print',
  base: 'Building the base',
  analysis: 'Checking printability',
  trace: 'Tracing curves',
  layers: 'Assembling layers',
};

function itemsFromAnalysis(a: ImageAnalysis): PaletteItem[] {
  return a.colors.map((c, i) => ({ id: i, sources: [c.rgb], color: c.hex, name: c.name, share: c.share }));
}

interface VectorizerSectionProps {
  /** Public page: the page supplies its own title, so only the toolbar shows. */
  embedded?: boolean;
}

export function VectorizerSection({ embedded = false }: VectorizerSectionProps = {}) {
  const { toast } = useToast();
  const { state: vzState, load, analyze, vectorize, meshes: fetchMeshes, exportFile, svgText } = useVectorizerWorker();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [image, setImage] = useState<DecodedImage | null>(null);
  const [fileName, setFileName] = useState('logo');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [colorCount, setColorCount] = useState<number | null>(null);
  const [items, setItems] = useState<PaletteItem[]>([]);
  const [backgroundId, setBackgroundId] = useState<number | null>(null);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('remove');

  const [projectId, setProjectId] = useState('logo');
  const [printerId, setPrinterId] = useState('bambu-ams');
  const [widthMm, setWidthMm] = useState(80);
  const [nozzleMm, setNozzleMm] = useState(0.4);
  const [minFeatureMm, setMinFeatureMm] = useState(0.4);
  const [minIslandMm2, setMinIslandMm2] = useState(0.15);
  const [thickenThin, setThickenThin] = useState(false);
  const [detail, setDetail] = useState<DetailLevel>('standard');
  const [accuracy, setAccuracy] = useState(0.5);
  const [cornerAngle, setCornerAngle] = useState(40);
  const [detectShapes, setDetectShapes] = useState(true);
  const [model, setModel] = useState<Model3DOptions>(DEFAULT_MODEL);
  const [baseColorId, setBaseColorId] = useState<number | -1>(-1);
  const [heights, setHeights] = useState<Record<number, number>>({});

  const [print3d, setPrint3d] = useState(false);
  const [svgUnits, setSvgUnits] = useState<SvgUnits>('mm');
  const [separateShapes, setSeparateShapes] = useState(true);
  const [copied, setCopied] = useState(false);

  const [tab, setTab] = useState<Tab>('compare');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [meshes, setMeshes] = useState<MeshPart[] | null>(null);
  const [explode, setExplode] = useState(0);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const printer = PRINTERS.find((p) => p.id === printerId) ?? PRINTERS[0];
  const result = vzState.result;
  const hasBase = print3d && model.mode !== 'extrude' && model.baseShape !== 'none';

  // ── Loading ──────────────────────────────────────────────────────────────
  const loadFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({ title: 'Unsupported file', description: 'Use PNG, JPG, WebP, GIF, BMP, AVIF or SVG.', variant: 'destructive' });
        return;
      }
      setLoading(true);
      try {
        const decoded = await decodeImageFile(file);
        setImage((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return decoded;
        });
        setFileName(file.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 60) || 'logo');
        const a = await load(decoded);
        setAnalysis(a);
        setColorCount(null);
        setItems(itemsFromAnalysis(a));
        setBackgroundId(a.backgroundIndex);
        setBackgroundMode('remove');
        setBaseColorId(-1);
        setHeights({});
        setHidden(new Set());
        setMeshes(null);
      } catch (err) {
        toast({ title: 'Could not read the image', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    },
    [toast, load],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        void loadFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadFile]);

  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeColorCount = async (count: number | null) => {
    setColorCount(count);
    const a = await analyze(count);
    setAnalysis((prev) => (prev ? { ...a, autoColorCount: prev.autoColorCount } : a));
    setItems(itemsFromAnalysis(a));
    setBackgroundId(a.backgroundIndex);
    setBaseColorId(-1);
    setHeights({});
  };

  const applyProject = (id: string) => {
    const p = PROJECTS.find((x) => x.id === id);
    if (!p) return;
    setProjectId(id);
    setWidthMm(p.widthMm);
    setModel((m) => ({ ...m, ...p.model, keyring: { ...m.keyring, ...p.model.keyring } }));
  };

  const applyPrinter = (id: string) => {
    const p = PRINTERS.find((x) => x.id === id);
    if (!p) return;
    setPrinterId(id);
    setNozzleMm(p.nozzleMm);
    setMinFeatureMm(p.nozzleMm);
  };

  // ── Options → worker (debounced; the worker coalesces too) ───────────────
  const options = useMemo<VectorizeOptions | null>(() => {
    if (!analysis || items.length === 0) return null;
    const bgIndex = backgroundId === null ? null : items.findIndex((it) => it.id === backgroundId);
    const baseIndex = baseColorId === -1 ? -1 : items.findIndex((it) => it.id === baseColorId);
    return {
      palette: items.map((it) => ({ sources: it.sources, color: it.color, name: it.name })),
      backgroundIndex: bgIndex !== null && bgIndex >= 0 ? bgIndex : null,
      backgroundMode,
      widthMm: Math.max(1, widthMm || 1),
      nozzleMm,
      minFeatureMm,
      minIslandMm2,
      thickenThin: print3d && thickenThin,
      detail,
      accuracy,
      cornerAngle,
      detectShapes,
      printChecks: print3d,
      // Without 3D printing the model is just the artwork: no base, no keyring.
      model: print3d
        ? { ...model, basePaletteIndex: baseIndex, heightsMm: items.map((it) => heights[it.id] ?? 1) }
        : { ...DEFAULT_MODEL, heightsMm: items.map(() => 1) },
    };
  }, [analysis, items, backgroundId, backgroundMode, widthMm, nozzleMm, minFeatureMm, minIslandMm2, thickenThin, detail, accuracy, cornerAngle, detectShapes, print3d, model, baseColorId, heights]);

  useEffect(() => {
    if (!print3d && (tab === 'check' || tab === '3d')) setTab('compare');
  }, [print3d, tab]);

  useEffect(() => {
    if (!options) return;
    const t = window.setTimeout(() => vectorize(options), 250);
    return () => window.clearTimeout(t);
  }, [options, vectorize]);

  // Meshes for the 3D tab, refreshed whenever a new result lands.
  useEffect(() => {
    setMeshes(null);
  }, [result]);
  useEffect(() => {
    if (tab !== '3d' || !result || meshes || vzState.busy) return;
    let cancelled = false;
    fetchMeshes().then((parts) => !cancelled && setMeshes(parts)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tab, result, meshes, vzState.busy, fetchMeshes]);

  const doExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      const name = await exportFile(format, fileName || 'logo', { units: svgUnits, separateShapes });
      toast({ title: 'Downloaded', description: name });
    } catch (err) {
      toast({ title: 'Export failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  const copySvg = async () => {
    try {
      const text = await svgText({ units: svgUnits, separateShapes });
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      toast({ title: 'Could not copy', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  // Pixel size of the artwork in the source image (for the px export).
  const pxSize =
    result && image
      ? { w: Math.round(result.art.source.width * image.width), h: Math.round(result.art.source.height * image.height) }
      : null;

  const toggleLayer = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const reset = () => {
    if (image) URL.revokeObjectURL(image.url);
    setImage(null);
    setAnalysis(null);
    setItems([]);
  };

  // ── Upload screen ────────────────────────────────────────────────────────
  if (!image || !analysis) {
    return (
      <div className="space-y-6">
        {!embedded && <Header />}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void loadFile(f);
          }}
          onClick={() => fileInput.current?.click()}
          className={cn(
            'flex min-h-[340px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60 hover:bg-muted/40',
          )}
          data-testid="vectorizer-dropzone"
        >
          {loading ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <Upload className="h-10 w-10 text-primary" />}
          <div>
            <p className="text-lg font-semibold">Drop a logo here, click to choose, or paste (Ctrl/⌘ + V)</p>
            <p className="mt-1 text-sm text-muted-foreground">PNG, JPG, WebP, GIF, BMP, AVIF or SVG. Processed in your browser — nothing is uploaded.</p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
              e.target.value = '';
            }}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Feature icon={<Shapes className="h-5 w-5" />} title="Counts the real colors">
            Learns the palette only from flat areas, so anti-aliased edges never add phantom shades.
          </Feature>
          <Feature icon={<ScanLine className="h-5 w-5" />} title="Clean, editable curves">
            Real corners, straight lines and perfect circles with few nodes. Neighbouring colors share one exact border — no gaps, no overlaps.
          </Feature>
          <Feature icon={<FileImage className="h-5 w-5" />} title="Opens right everywhere">
            SVG at real size for Fusion 360, Illustrator and Inkscape, or pixel size for Figma. 3D printing (3MF / STL) is one switch away.
          </Feature>
        </div>
      </div>
    );
  }

  // ── Workspace ────────────────────────────────────────────────────────────
  const printedLayers = result?.layers ?? [];
  const totalGrams = printedLayers.reduce((s, l) => s + l.volumeMm3 * PLA_DENSITY, 0);
  const warnings = [
    ...(analysis.photographic
      ? [{ level: 'warn' as const, message: 'This looks like a photo or has gradients — it will be posterized into flat colors.' }]
      : []),
    ...(analysis.lowResolution
      ? [{ level: 'info' as const, message: `Small source image (${analysis.width}×${analysis.height}px). Edges are reconstructed with sub-pixel fitting; a larger original gives even better results.` }]
      : []),
    ...(result?.warnings ?? []),
  ];

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex justify-end">
          <Button variant="outline" className="gap-2" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> New image
          </Button>
        </div>
      ) : (
        <Header
          action={
            <Button variant="outline" className="gap-2" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> New image
            </Button>
          }
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]">
        {/* Left: preview + report */}
        <div className={cn('space-y-4 xl:sticky xl:self-start', embedded ? 'xl:top-28' : 'xl:top-0')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
              {([
                ['compare', 'Compare'],
                ['vector', 'Vector'],
                ['outline', 'Nodes'],
                ...(print3d
                  ? ([
                      ['check', 'Print check'],
                      ['3d', '3D'],
                    ] as Array<[Tab, string]>)
                  : []),
              ] as Array<[Tab, string]>).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn('rounded-md px-3 py-1.5 font-medium transition-colors', tab === id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                  data-testid={`vectorizer-tab-${id}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex h-6 items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              {vzState.busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  {STAGES[vzState.stage ?? 'start'] ?? 'Working'}…
                </>
              ) : result ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  Done in {(Object.values(result.stats.timings).reduce((a, b) => a + b, 0) / 1000).toFixed(1)}s
                </>
              ) : null}
            </div>
          </div>

          {result && result.layers.length > 0 ? (
            tab === '3d' ? (
              <div className="space-y-3">
                <div className="relative h-[58vh] min-h-[360px] overflow-hidden rounded-xl border bg-gradient-to-b from-muted/30 to-muted">
                  {meshes ? (
                    <Suspense fallback={<CenterSpinner />}>
                      <ModelViewer parts={meshes} hidden={hidden} explode={explode} />
                    </Suspense>
                  ) : (
                    <CenterSpinner />
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="shrink-0">Explode view</span>
                  <Slider value={[explode]} min={0} max={1} step={0.05} onValueChange={([v]) => setExplode(v)} className="max-w-xs" />
                  <span className="ml-auto">Drag to orbit · scroll to zoom</span>
                </div>
              </div>
            ) : (
              <PreviewPanel result={result} imageUrl={image.url} mode={tab} hiddenLayers={hidden} includeBase={hasBase} />
            )
          ) : (
            <div className="flex h-[58vh] min-h-[360px] items-center justify-center rounded-xl border">
              {vzState.error || (result && result.layers.length === 0) ? (
                <p className="max-w-sm text-center text-sm text-destructive">{vzState.error ?? result?.warnings[0]?.message}</p>
              ) : (
                <CenterSpinner />
              )}
            </div>
          )}

          {result && result.layers.length > 0 && (
            <AdminCard padding="compact" className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="h-4 w-4" /> {print3d ? 'Layers & print report' : 'Vector summary'}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Stat label="Artwork" value={`${result.widthMm.toFixed(1)} × ${result.heightMm.toFixed(1)} mm`} />
                {print3d ? (
                  <Stat label="Model" value={`${result.modelWidthMm.toFixed(1)} × ${result.modelHeightMm.toFixed(1)} × ${result.modelDepthMm.toFixed(1)} mm`} />
                ) : (
                  <Stat label="Colors" value={`${result.layers.length}`} />
                )}
                <Stat label="Shapes" value={`${result.stats.regionCount}`} />
                {print3d ? (
                  <Stat label="Filament (solid)" value={`≈ ${totalGrams.toFixed(1)} g PLA`} />
                ) : (
                  <Stat label="Nodes" value={`${result.stats.segmentCount} (${result.stats.lineCount} lines, ${result.stats.circleCount} circles)`} />
                )}
              </div>
              <ul className="divide-y rounded-lg border">
                {printedLayers.map((l) => (
                  <li key={l.key} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <button
                      type="button"
                      onClick={() => toggleLayer(l.key)}
                      className={cn('h-5 w-5 shrink-0 rounded border shadow-inner', hidden.has(l.key) && 'opacity-25')}
                      style={{ background: l.color }}
                      title={hidden.has(l.key) ? 'Show layer' : 'Hide layer'}
                    />
                    <span className={cn('min-w-0 flex-1 truncate font-medium', hidden.has(l.key) && 'text-muted-foreground line-through')}>{l.name}</span>
                    <span className="hidden text-muted-foreground sm:inline">{l.regionCount} {l.regionCount === 1 ? 'shape' : 'shapes'}</span>
                    <span className="font-mono uppercase text-muted-foreground">{l.color}</span>
                    {print3d && (
                      <>
                        <span className="text-muted-foreground">z {l.zMin.toFixed(1)}–{l.zMax.toFixed(1)}</span>
                        <span className="w-14 text-right tabular-nums">{(l.volumeMm3 * PLA_DENSITY).toFixed(2)} g</span>
                        {l.thinAreaMm2 > 0.05 && l.thinAreaMm2 > l.areaMm2 * 0.003 ? (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Has thin details" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" aria-label="Printable" />
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {warnings.length > 0 && (
                <ul className="space-y-1.5">
                  {warnings.map((w, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      {w.level === 'info' ? (
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
                      ) : (
                        <AlertTriangle className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', w.level === 'error' ? 'text-destructive' : 'text-amber-500')} />
                      )}
                      <span className="text-muted-foreground">{w.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          )}
        </div>

        {/* Right: controls */}
        <div className="space-y-4">
          <Panel title="1. Colors" icon={<Shapes className="h-4 w-4" />}>
            <PalettePanel
              items={items}
              autoCount={analysis.autoColorCount}
              colorCount={colorCount}
              onColorCount={(c) => void changeColorCount(c)}
              backgroundId={backgroundId}
              transparentBackground={analysis.transparentBackground}
              backgroundMode={backgroundMode}
              onBackground={setBackgroundId}
              onBackgroundMode={setBackgroundMode}
              onChange={setItems}
              slots={printer.slots}
              busy={vzState.busy && !result}
            />
          </Panel>

          <Panel title="2. SVG" icon={<FileImage className="h-4 w-4" />}>
            <Field label="Size and units">
              <Segmented<SvgUnits>
                value={svgUnits}
                onChange={setSvgUnits}
                options={[
                  ['mm', 'Real size (mm)'],
                  ['px', 'Pixels'],
                ]}
              />
            </Field>
            {svgUnits === 'mm' ? (
              <div className="grid grid-cols-2 items-end gap-3">
                <Field label="Artwork width (mm)">
                  <Input type="number" min={5} max={2000} step={1} value={widthMm} onChange={(e) => setWidthMm(Number(e.target.value))} data-testid="vectorizer-width" />
                </Field>
                <p className="pb-2 text-xs text-muted-foreground">
                  Height {result ? `${result.heightMm.toFixed(1)} mm` : '—'}. Opens at this exact size in Fusion 360, Illustrator, Inkscape and laser / CNC software.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Same pixel size as your image{pxSize ? ` (${pxSize.w} × ${pxSize.h} px)` : ''}, for Figma and the web. Vectors scale to any size without losing quality.
              </p>
            )}
            <ToggleRow
              id="vz-separate"
              label="One path per shape"
              hint="Each letter / shape is its own path, grouped by color — easy to edit. Off: one compound path per color."
              checked={separateShapes}
              onChange={setSeparateShapes}
            />
            <Field label="File name">
              <Input value={fileName} onChange={(e) => setFileName(e.target.value.replace(/[^\w-]+/g, '-'))} />
            </Field>
            <div className="grid gap-2">
              <ExportButton icon={<Download className="h-4 w-4" />} title="Download SVG" hint="One group per color, colors never overlap or leave gaps." primary onClick={() => doExport('svg')} busy={exporting === 'svg'} disabled={!result || vzState.busy} />
              <ExportButton icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} title={copied ? 'Copied — paste into Figma or Illustrator' : 'Copy SVG code'} hint="Paste straight onto a Figma or Illustrator canvas." onClick={copySvg} busy={false} disabled={!result || vzState.busy} />
              <div className="grid grid-cols-2 gap-2">
                <ExportButton small icon={<FileArchive className="h-4 w-4" />} title="One SVG per color (ZIP)" onClick={() => doExport('layers-zip')} busy={exporting === 'layers-zip'} disabled={!result || vzState.busy} />
                <ExportButton small icon={<Layers className="h-4 w-4" />} title="Stacked layers SVG" onClick={() => doExport('svg-stacked')} busy={exporting === 'svg-stacked'} disabled={!result || vzState.busy} />
              </div>
            </div>
          </Panel>

          <Panel title="3. Tracing quality" icon={<ScanLine className="h-4 w-4" />}>
            <Field label="Detail level">
              <Segmented<DetailLevel>
                value={detail}
                onChange={setDetail}
                options={[
                  ['standard', 'Standard'],
                  ['high', 'High'],
                  ['ultra', 'Ultra'],
                ]}
              />
            </Field>
            <RangeField label="Curves" left="Smoother" right="Closer to pixels" value={accuracy} min={0} max={1} step={0.05} onChange={setAccuracy} />
            <RangeField label="Corners" left="More corners" right="Rounder" value={cornerAngle} min={20} max={90} step={5} onChange={setCornerAngle} display={`${cornerAngle}°`} />
            <div className="grid grid-cols-2 items-end gap-3">
              <Field label="Ignore specks under (mm²)">
                <NumberInput value={minIslandMm2} min={0} max={10} step={0.05} onChange={setMinIslandMm2} />
              </Field>
              <p className="pb-2 text-xs text-muted-foreground">Dust, JPEG noise and stray pixels merge into the surrounding color.</p>
            </div>
            <ToggleRow id="vz-shapes" label="Perfect circles" hint="Replace round outlines with exact circles." checked={detectShapes} onChange={setDetectShapes} />
          </Panel>

          <Panel
            title="4. 3D printing (optional)"
            icon={<Box className="h-4 w-4" />}
            action={<Switch checked={print3d} onCheckedChange={setPrint3d} aria-label="3D printing" data-testid="vectorizer-3d-toggle" />}
          >
            {!print3d ? (
              <p className="text-xs text-muted-foreground">
                Turn on to add a base or keyring, check details against your nozzle and export a multi-color 3MF / STL.
              </p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PROJECTS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyProject(p.id)}
                      className={cn('rounded-lg border p-3 text-left transition-colors', projectId === p.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')}
                      data-testid={`vectorizer-project-${p.id}`}
                    >
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                    </button>
                  ))}
                </div>
                <div className="grid gap-3">
                  <Field label="Printer">
                    <Select value={printerId} onValueChange={applyPrinter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRINTERS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Style">
                  <Segmented<ModelMode>
                    value={model.mode}
                    onChange={(mode) => setModel((m) => ({ ...m, mode }))}
                    options={[
                      ['extrude', 'Colors only'],
                      ['flat', 'Flat inlay'],
                      ['relief', 'Raised relief'],
                    ]}
                  />
                </Field>
                {model.mode !== 'extrude' && (
                  <>
                    <Field label="Base shape">
                      <Segmented<BaseShape>
                        value={model.baseShape}
                        onChange={(baseShape) => setModel((m) => ({ ...m, baseShape }))}
                        options={[
                          ['none', 'None'],
                          ['contour', 'Outline'],
                          ['rounded', 'Rounded'],
                          ['rect', 'Rectangle'],
                          ['circle', 'Circle'],
                        ]}
                      />
                    </Field>
                    {hasBase && (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <Field label="Margin (mm)">
                            <NumberInput value={model.baseMarginMm} min={0} max={50} step={0.5} onChange={(v) => setModel((m) => ({ ...m, baseMarginMm: v }))} />
                          </Field>
                          <Field label="Thickness (mm)">
                            <NumberInput value={model.baseThicknessMm} min={0.4} max={20} step={0.2} onChange={(v) => setModel((m) => ({ ...m, baseThicknessMm: v }))} />
                          </Field>
                          {model.mode === 'flat' ? (
                            <Field label="Inlay depth (mm)">
                              <NumberInput value={model.inlayDepthMm} min={0.2} max={model.baseThicknessMm} step={0.2} onChange={(v) => setModel((m) => ({ ...m, inlayDepthMm: v }))} />
                            </Field>
                          ) : model.baseShape === 'rounded' ? (
                            <Field label="Corner radius (mm)">
                              <NumberInput value={model.cornerRadiusMm} min={0} max={50} step={0.5} onChange={(v) => setModel((m) => ({ ...m, cornerRadiusMm: v }))} />
                            </Field>
                          ) : (
                            <div />
                          )}
                        </div>
                        <Field label="Base color">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {items.map((it) => (
                              <button
                                key={it.id}
                                type="button"
                                title={it.name}
                                onClick={() => setBaseColorId(it.id)}
                                className={cn('h-7 w-7 rounded-md border shadow-inner', baseColorId === it.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
                                style={{ background: it.color }}
                              />
                            ))}
                            <label
                              className={cn('relative h-7 w-14 cursor-pointer overflow-hidden rounded-md border text-[10px] leading-7 text-center', baseColorId === -1 && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
                              style={{ background: model.baseCustomColor }}
                              title="Other filament color"
                              onClick={() => setBaseColorId(-1)}
                            >
                              <span className="rounded bg-background/80 px-1">other</span>
                              <input
                                type="color"
                                value={model.baseCustomColor}
                                onChange={(e) => setModel((m) => ({ ...m, baseCustomColor: e.target.value }))}
                                className="absolute inset-0 cursor-pointer opacity-0"
                              />
                            </label>
                          </div>
                        </Field>
                        <div className="space-y-3 rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="vz-keyring" className="text-sm">Keyring hole</Label>
                            <Switch id="vz-keyring" checked={model.keyring.enabled} onCheckedChange={(enabled) => setModel((m) => ({ ...m, keyring: { ...m.keyring, enabled } }))} />
                          </div>
                          {model.keyring.enabled && (
                            <div className="grid grid-cols-3 gap-3">
                              <Field label="Position">
                                <Select value={model.keyring.position} onValueChange={(position) => setModel((m) => ({ ...m, keyring: { ...m.keyring, position: position as KeyringPosition } }))}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(['top-left', 'top', 'top-right', 'left', 'right', 'bottom'] as KeyringPosition[]).map((p) => (
                                      <SelectItem key={p} value={p}>
                                        {p.replace('-', ' ')}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </Field>
                              <Field label="Hole Ø (mm)">
                                <NumberInput value={model.keyring.holeDiameterMm} min={1.5} max={15} step={0.5} onChange={(v) => setModel((m) => ({ ...m, keyring: { ...m.keyring, holeDiameterMm: v } }))} />
                              </Field>
                              <Field label="Ring (mm)">
                                <NumberInput value={model.keyring.ringWidthMm} min={1} max={10} step={0.5} onChange={(v) => setModel((m) => ({ ...m, keyring: { ...m.keyring, ringWidthMm: v } }))} />
                              </Field>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}
                {model.mode !== 'flat' && (
                  <Field label={model.mode === 'relief' ? 'Height above the base, per color (mm)' : 'Height per color (mm)'}>
                    <div className="grid grid-cols-2 gap-2">
                      {items
                        .filter((it) => it.id !== backgroundId || backgroundMode === 'keep')
                        .map((it) => (
                          <div key={it.id} className="flex items-center gap-2">
                            <span className="h-5 w-5 shrink-0 rounded border" style={{ background: it.color }} />
                            <span className="min-w-0 flex-1 truncate text-xs">{it.name}</span>
                            <NumberInput className="h-8 w-20" value={heights[it.id] ?? 1} min={0.2} max={20} step={0.2} onChange={(v) => setHeights((h) => ({ ...h, [it.id]: v }))} />
                          </div>
                        ))}
                    </div>
                  </Field>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nozzle (mm)">
                    <NumberInput value={nozzleMm} min={0.1} max={1.2} step={0.05} onChange={setNozzleMm} />
                  </Field>
                  <Field label="Min. printable detail (mm)">
                    <NumberInput value={minFeatureMm} min={0.1} max={3} step={0.05} onChange={setMinFeatureMm} />
                  </Field>
                </div>
                <ToggleRow id="vz-thicken" label="Thicken fine details" hint="Grows lines thinner than the minimum into the background so they print." checked={thickenThin} onChange={setThickenThin} />
                <div className="grid gap-2">
                  <ExportButton icon={<Box className="h-4 w-4" />} title="3MF — multi-color, ready to slice" hint="One part per filament with colors assigned (Bambu Studio, OrcaSlicer, PrusaSlicer)." primary onClick={() => doExport('3mf')} busy={exporting === '3mf'} disabled={!result || vzState.busy} />
                  <div className="grid grid-cols-2 gap-2">
                    <ExportButton small icon={<FileArchive className="h-4 w-4" />} title="STL per color (ZIP)" onClick={() => doExport('stl-zip')} busy={exporting === 'stl-zip'} disabled={!result || vzState.busy} />
                    <ExportButton small icon={<FileImage className="h-4 w-4" />} title="SVG with base" onClick={() => doExport('svg-base')} busy={exporting === 'svg-base'} disabled={!result || vzState.busy || !hasBase} />
                  </div>
                </div>
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ── Small building blocks ──────────────────────────────────────────────────

function Header({ action }: { action?: ReactNode }) {
  return (
    <SectionHeader
      title="Logo Vectorizer"
      description="Convert PNG / JPEG logos into clean, editable SVG for Figma, Illustrator and Fusion 360 — plus print-ready 3MF."
      icon={<Shapes className="w-5 h-5" />}
      action={action}
    />
  );
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <AdminCard tone="muted" className="space-y-2">
      <div className="flex items-center gap-2 font-medium">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{children}</p>
    </AdminCard>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <AdminCard padding="compact" className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </AdminCard>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, min, max, step, className }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number; className?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={text}
      min={min}
      max={max}
      step={step}
      className={className}
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn('flex-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors', value === id ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function RangeField({ label, left, right, value, min, max, step, onChange, display }: { label: string; left: string; right: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display?: string }) {
  // Commit on release so a drag triggers one trace, not dozens.
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        {display && <span className="tabular-nums">{display}</span>}
      </div>
      <Slider value={[local]} min={min} max={max} step={step} onValueChange={([v]) => setLocal(v)} onValueCommit={([v]) => onChange(v)} />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function ToggleRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Label htmlFor={id} className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function ExportButton({ icon, title, hint, onClick, busy, disabled, primary, small }: { icon: ReactNode; title: string; hint?: string; onClick: () => void; busy: boolean; disabled: boolean; primary?: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        'flex items-center gap-3 rounded-lg border text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        small ? 'px-3 py-2' : 'px-3 py-2.5',
        primary ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-muted/60',
      )}
    >
      <span className="shrink-0">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}</span>
      <span className="min-w-0">
        <span className={cn('block font-medium', small ? 'text-xs' : 'text-sm')}>{title}</span>
        {hint && <span className={cn('block text-xs', primary ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{hint}</span>}
      </span>
    </button>
  );
}

function CenterSpinner() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
