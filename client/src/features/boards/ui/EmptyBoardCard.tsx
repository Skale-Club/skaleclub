import { FileText, LayoutTemplate, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';

// A blank board's way in: a compact card near the top so the canvas itself stays
// free for the first click. The wrapper lets pointer events through.
export function EmptyBoardCard({ isPhone, onTemplate, onAi, onImport }: { isPhone: boolean; onTemplate: () => void; onAi?: () => void; onImport: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-none absolute inset-x-3 top-4 z-10 flex justify-center">
      <div
        className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border bg-background/95 px-3 py-2 shadow-md backdrop-blur"
        data-testid="board-empty-state"
      >
        <span className="px-1 text-sm font-medium">{t('Start with')}</span>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={onTemplate} data-testid="board-empty-template">
          <LayoutTemplate className="h-4 w-4" />
          {t('Template')}
        </Button>
        {onAi && (
          <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={onAi} data-testid="board-empty-ai">
            <Sparkles className="h-4 w-4 text-[#5173D6]" />
            {t('Generate with AI')}
          </Button>
        )}
        <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={onImport} data-testid="board-empty-import">
          <FileText className="h-4 w-4" />
          {t('Paste text')}
        </Button>
        <span className="px-1 text-xs text-muted-foreground">{isPhone ? t('or pick a tool below') : t('or pick a tool on the left')}</span>
      </div>
    </div>
  );
}
