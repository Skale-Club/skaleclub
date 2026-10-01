import { Eye, EyeOff, Merge, Minus, Plus, Sparkles } from 'lucide-react';
import type { Rgb } from '@shared/vectorizer/color';
import type { BackgroundMode } from '@shared/vectorizer/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface PaletteItem {
  id: number;
  sources: Rgb[];
  color: string;
  name: string;
  share: number;
}

interface PalettePanelProps {
  items: PaletteItem[];
  autoCount: number;
  colorCount: number | null;
  onColorCount: (count: number | null) => void;
  backgroundId: number | null;
  transparentBackground: boolean;
  backgroundMode: BackgroundMode;
  onBackground: (id: number | null) => void;
  onBackgroundMode: (mode: BackgroundMode) => void;
  onChange: (items: PaletteItem[]) => void;
  slots: number;
  busy: boolean;
}

export function PalettePanel({
  items,
  autoCount,
  colorCount,
  onColorCount,
  backgroundId,
  transparentBackground,
  backgroundMode,
  onBackground,
  onBackgroundMode,
  onChange,
  slots,
  busy,
}: PalettePanelProps) {
  const current = colorCount ?? autoCount;
  const printed = items.filter((it) => it.id !== backgroundId || backgroundMode === 'keep').length;
  const update = (id: number, patch: Partial<PaletteItem>) => onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const merge = (from: number, into: number) => {
    const src = items.find((it) => it.id === from);
    if (!src) return;
    onChange(
      items
        .filter((it) => it.id !== from)
        .map((it) => (it.id === into ? { ...it, sources: [...it.sources, ...src.sources], share: it.share + src.share } : it)),
    );
    if (backgroundId === from) onBackground(into);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Number of colors</p>
          <p className="text-xs text-muted-foreground">
            Detected <strong>{autoCount}</strong> {autoCount === 1 ? 'color' : 'colors'} from the flat areas (anti-aliasing ignored).
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={busy || current <= 1} onClick={() => onColorCount(current - 1)} aria-label="Fewer colors">
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-8 text-center text-lg font-semibold tabular-nums" data-testid="vectorizer-color-count">{current}</span>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={busy || current >= 16} onClick={() => onColorCount(current + 1)} aria-label="More colors">
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={colorCount === null ? 'secondary' : 'ghost'} className="ml-1 gap-1" disabled={busy} onClick={() => onColorCount(null)}>
            <Sparkles className="h-3.5 w-3.5" /> Auto
          </Button>
        </div>
      </div>

      {printed > slots && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          {printed} printed colors but the selected printer has {slots} {slots === 1 ? 'slot' : 'slots'}. Merge colors, reduce the count, or plan manual filament swaps.
        </div>
      )}

      <ul className="space-y-2">
        {items.map((it) => {
          const isBg = it.id === backgroundId;
          const removed = isBg && backgroundMode !== 'keep';
          return (
            <li key={it.id} className={cn('flex items-center gap-2 rounded-lg border p-2', removed && 'opacity-60')} data-testid={`vectorizer-color-${it.id}`}>
              <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md border shadow-inner" title="Filament color">
                <span className="absolute inset-0" style={{ background: it.color }} />
                <input type="color" value={it.color} onChange={(e) => update(it.id, { color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <div className="min-w-0 flex-1">
                <Input value={it.name} onChange={(e) => update(it.id, { name: e.target.value })} className="h-8 text-sm" aria-label="Color name" />
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono uppercase">{it.color}</span>
                  <span>·</span>
                  <span>{(it.share * 100).toFixed(it.share < 0.01 ? 2 : 1)}%</span>
                  {it.sources.length > 1 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{it.sources.length} merged</Badge>}
                  {isBg && <Badge variant="outline" className="h-4 px-1 text-[10px]">background</Badge>}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                title={isBg ? 'Background: click to print it' : 'Treat as background (not printed)'}
                onClick={() => {
                  if (isBg) onBackground(null);
                  else {
                    onBackground(it.id);
                    if (backgroundMode === 'keep') onBackgroundMode('remove');
                  }
                }}
              >
                {removed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={items.length < 2} title="Merge into another color">
                    <Merge className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Merge {it.name} into…</DropdownMenuLabel>
                  {items
                    .filter((o) => o.id !== it.id)
                    .map((o) => (
                      <DropdownMenuItem key={o.id} onClick={() => merge(it.id, o.id)} className="gap-2">
                        <span className="h-3.5 w-3.5 rounded-sm border" style={{ background: o.color }} />
                        {o.name}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>

      {transparentBackground ? (
        <p className="text-xs text-muted-foreground">Transparent background detected — only the artwork is traced.</p>
      ) : backgroundId !== null ? (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {([
            ['remove', 'Remove everywhere'],
            ['remove-connected', 'Only outside the logo'],
            ['keep', 'Print it'],
          ] as Array<[BackgroundMode, string]>).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => onBackgroundMode(mode)}
              className={cn(
                'rounded-full border px-2.5 py-1 transition-colors',
                backgroundMode === mode ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
