import { Grid3x3, MousePointerClick, Moon, Square, CircleDot } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { BoardTheme } from '@shared/schema';
import { selectSelectionCount, selectTheme, useBoardStore } from '../store/boardStore';

const BACKGROUNDS: { id: BoardTheme['background']; label: string; icon: typeof Grid3x3 }[] = [
  { id: 'dots', label: 'Dots', icon: CircleDot },
  { id: 'grid', label: 'Grid', icon: Grid3x3 },
  { id: 'plain', label: 'Plain', icon: Square },
];

// Right-hand contextual panel. Phase 0 shows the selection count and the board
// settings; phases 1 and 2 add the style controls for what is selected and the
// mind-map outline.
export function StylePanel({ className }: { className?: string }) {
  const { t } = useTranslation();
  const count = useBoardStore(selectSelectionCount);
  const theme = useBoardStore(selectTheme);
  const setTheme = useBoardStore((s) => s.setTheme);

  return (
    <aside className={cn('flex w-64 flex-col gap-5 overflow-y-auto border-l bg-background p-4', className)} data-testid="board-style-panel">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('Selection')}</h3>
        {count === 0 ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('Select something on the board to style it.')}</span>
          </div>
        ) : (
          <p className="mt-3 text-sm font-medium" data-testid="board-selection-count">
            {count === 1 ? t('1 item selected') : `${count} ${t('items selected')}`}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('Board')}</h3>
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
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="board-dark-mode" className="flex items-center gap-2 text-sm font-normal">
            <Moon className="h-4 w-4 text-muted-foreground" />
            {t('Dark board')}
          </Label>
          <Switch
            id="board-dark-mode"
            checked={!!theme.dark}
            onCheckedChange={(checked) => setTheme({ dark: checked })}
            data-testid="board-dark-toggle"
          />
        </div>
      </section>
    </aside>
  );
}
