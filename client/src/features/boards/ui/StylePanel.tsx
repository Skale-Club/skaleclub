import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { selectSelectionCount, useBoardStore, type BoardState } from '../store/boardStore';
import { MindStyleSection } from './MindStyleSection';
import { OutlinePanel } from './OutlinePanel';
import { CanvasStyleSection } from './CanvasStyleSection';

export type PanelTab = 'style' | 'outline';

// Does the selection hold any canvas item (non-mind node or connector)?
const selectHasCanvasItems = (s: BoardState) => {
  if (s.selection.edgeIds.length) {
    const ids = new Set(s.selection.edgeIds);
    if (s.document.edges.some((e) => ids.has(e.id) && e.kind === 'connector')) return true;
  }
  if (!s.selection.nodeIds.length) return false;
  const ids = new Set(s.selection.nodeIds);
  return s.document.nodes.some((n) => ids.has(n.id) && n.data.type !== 'mind');
};

// The one mind node selected (and nothing else), if any.
const selectSingleMindId = (s: BoardState) => {
  if (s.selection.nodeIds.length !== 1 || s.selection.edgeIds.length) return null;
  const node = s.document.nodes.find((n) => n.id === s.selection.nodeIds[0]);
  return node?.data.type === 'mind' ? node.id : null;
};

/** Style controls for the selection (the board's own settings live in the ⋯ menu). */
export function StylePanelContent() {
  const { t } = useTranslation();
  const count = useBoardStore(selectSelectionCount);
  const mindId = useBoardStore(selectSingleMindId);
  const hasCanvas = useBoardStore(selectHasCanvasItems);

  if (mindId) return <MindStyleSection key={mindId} id={mindId} />;
  if (hasCanvas) return <CanvasStyleSection />;
  if (count === 0) return <p className="text-sm text-muted-foreground">{t('Select something on the board to style it.')}</p>;
  return (
    <p className="text-sm font-medium" data-testid="board-selection-count">
      {count === 1 ? t('1 item selected') : `${count} ${t('items selected')}`}
    </p>
  );
}

// Style (what is selected) and Outline (the mind map as an indented list).
// "card" floats over the canvas's top-right corner and takes no layout width;
// "sheet" fills a bottom/side sheet on small screens.
export function StylePanel({
  tab,
  onTabChange,
  onClose,
  variant = 'card',
  className,
}: {
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  /** Closes the card (card variant only). */
  onClose?: () => void;
  variant?: 'card' | 'sheet';
  className?: string;
}) {
  const { t } = useTranslation();
  const card = variant === 'card';
  const Root = card ? 'aside' : 'div';
  return (
    <Root
      className={cn(
        'flex flex-col bg-background',
        card ? 'absolute right-3 top-3 z-10 max-h-[calc(100%-1.5rem)] w-72 overflow-hidden rounded-2xl border bg-background/95 shadow-md backdrop-blur animate-in fade-in-0 slide-in-from-right-2 duration-150' : 'h-full w-full',
        className,
      )}
      data-testid={card ? 'board-style-panel' : 'board-style-sheet-panel'}
    >
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as PanelTab)} className="flex min-h-0 flex-1 flex-col">
        <div className={cn('flex items-center gap-2 border-b p-3', !card && 'pr-12')}>
          <TabsList className="grid h-9 min-w-0 flex-1 grid-cols-2 rounded-xl">
            <TabsTrigger value="style" className="rounded-lg text-xs" data-testid="board-panel-tab-style">
              {t('Style')}
            </TabsTrigger>
            <TabsTrigger value="outline" className="rounded-lg text-xs" data-testid="board-panel-tab-outline">
              {t('Outline')}
            </TabsTrigger>
          </TabsList>
          {card && onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} aria-label={t('Close panel')} data-testid="board-panel-close">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <TabsContent value="style" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
          <StylePanelContent />
        </TabsContent>
        <TabsContent value="outline" className="mt-0 min-h-0 flex-1 overflow-y-auto p-3">
          <OutlinePanel />
        </TabsContent>
      </Tabs>
    </Root>
  );
}
