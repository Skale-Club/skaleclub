import { useCallback, useState } from 'react';
import { CircleDot, Grid3x3, Map as MapIcon, Moon, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { BoardTheme } from '@shared/schema';
import { selectTheme, useBoardStore } from '../store/boardStore';
import { branchPalette } from '../engine/palette';

const BACKGROUNDS: { id: BoardTheme['background']; label: string; icon: typeof Grid3x3 }[] = [
  { id: 'dots', label: 'Dots', icon: CircleDot },
  { id: 'grid', label: 'Grid', icon: Grid3x3 },
  { id: 'plain', label: 'Plain', icon: Square },
];

const PALETTES: { id: BoardTheme['palette']; label: string }[] = [
  { id: 'brand', label: 'Brand' },
  { id: 'pastel', label: 'Pastel' },
  { id: 'mono', label: 'Mono' },
];

const MINIMAP_KEY = 'skale:board-minimap';

// The minimap is a per-browser convenience (off by default), not part of the board.
export function useMinimapPreference(): [boolean, (value: boolean) => void] {
  const [minimap, setMinimapState] = useState(() => {
    try {
      return window.localStorage.getItem(MINIMAP_KEY) === '1';
    } catch {
      return false;
    }
  });
  const setMinimap = useCallback((value: boolean) => {
    setMinimapState(value);
    try {
      window.localStorage.setItem(MINIMAP_KEY, value ? '1' : '0');
    } catch {
      // Storage blocked: the choice lasts for this session only.
    }
  }, []);
  return [minimap, setMinimap];
}

function SwitchRow({ id, icon: Icon, label, checked, onCheckedChange, testId }: { id: string; icon: typeof Moon; label: string; checked: boolean; onCheckedChange: (checked: boolean) => void; testId: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={id} className="flex items-center gap-2 text-sm font-normal">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} data-testid={testId} />
    </div>
  );
}

// Board-wide look and behavior, opened from the ⋯ menu.
export function BoardSettingsDialog({
  open,
  onOpenChange,
  minimap,
  onMinimapChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  minimap: boolean;
  onMinimapChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const theme = useBoardStore(selectTheme);
  const setTheme = useBoardStore((s) => s.setTheme);
  const snap = useBoardStore((s) => s.snapToGrid);
  const setSnap = useBoardStore((s) => s.setSnapToGrid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="board-settings-dialog">
        <DialogHeader>
          <DialogTitle>{t('Board settings')}</DialogTitle>
          <DialogDescription>{t('How this board looks and behaves.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm">{t('Branch colors')}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {PALETTES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme({ palette: id })}
                  aria-pressed={theme.palette === id}
                  data-testid={`board-palette-${id}`}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-xs transition-colors',
                    theme.palette === id ? 'border-[#5173D6] bg-[#5173D6]/10 text-foreground' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span className="flex -space-x-1">
                    {branchPalette(id).slice(0, 4).map((color) => (
                      <span key={color} className="h-3 w-3 rounded-full ring-1 ring-background" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm">{t('Background')}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {BACKGROUNDS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme({ background: id })}
                  aria-pressed={theme.background === id}
                  data-testid={`board-background-${id}`}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs transition-colors',
                    theme.background === id ? 'border-[#5173D6] bg-[#5173D6]/10 text-foreground' : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3 border-t pt-4">
            <SwitchRow id="board-dark-mode" icon={Moon} label={t('Dark board')} checked={!!theme.dark} onCheckedChange={(dark) => setTheme({ dark })} testId="board-dark-toggle" />
            <SwitchRow id="board-snap" icon={Grid3x3} label={t('Snap to grid')} checked={snap} onCheckedChange={setSnap} testId="board-snap-toggle" />
            <SwitchRow id="board-minimap" icon={MapIcon} label={t('Show minimap')} checked={minimap} onCheckedChange={onMinimapChange} testId="board-minimap-toggle" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
