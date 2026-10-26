import { useState } from 'react';
import { Grid3x3, MousePointerClick, Moon, Square, CircleDot } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { BoardTheme } from '@shared/schema';
import { selectSelectionCount, selectTheme, useBoardStore, type BoardState } from '../store/boardStore';
import { branchPalette } from '../engine/palette';
import { MindStyleSection } from './MindStyleSection';
import { OutlinePanel } from './OutlinePanel';

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

// The one mind node selected (and nothing else), if any.
const selectSingleMindId = (s: BoardState) => {
  if (s.selection.nodeIds.length !== 1 || s.selection.edgeIds.length) return null;
  const node = s.document.nodes.find((n) => n.id === s.selection.nodeIds[0]);
  return node?.data.type === 'mind' ? node.id : null;
};

/** Style controls for the selection, then the board settings. */
export function StylePanelContent() {
  const { t } = useTranslation();
  const count = useBoardStore(selectSelectionCount);
  const mindId = useBoardStore(selectSingleMindId);
  const theme = useBoardStore(selectTheme);
  const setTheme = useBoardStore((s) => s.setTheme);

  return (
    <div className="flex flex-col gap-6">
      {mindId ? (
        <MindStyleSection id={mindId} />
      ) : (
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
      )}

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('Board')}</h3>
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
    </div>
  );
}

// Right-hand side panel: "Style" (what is selected + board settings) and
// "Outline" (the mind map as an indented list).
export function StylePanel({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'style' | 'outline'>('style');
  return (
    <aside className={cn('flex w-72 flex-col border-l bg-background', className)} data-testid="board-style-panel">
      <Tabs value={tab} onValueChange={(value) => setTab(value as 'style' | 'outline')} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b p-3">
          <TabsList className="grid h-9 w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="style" className="rounded-lg text-xs" data-testid="board-panel-tab-style">
              {t('Style')}
            </TabsTrigger>
            <TabsTrigger value="outline" className="rounded-lg text-xs" data-testid="board-panel-tab-outline">
              {t('Outline')}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="style" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
          <StylePanelContent />
        </TabsContent>
        <TabsContent value="outline" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3">
          <OutlinePanel />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
