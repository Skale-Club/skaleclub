import { useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { absoluteBox, indexNodes, unionBox } from '@shared/boards/canvasOps';
import { BOARD_TEMPLATES, buildTemplate, type BoardTemplateId } from '@shared/boards/templates';

const PREVIEW_W = 160;
const PREVIEW_H = 90;

// A miniature of the template, drawn from the same builder that inserts it.
function TemplatePreview({ id }: { id: BoardTemplateId }) {
  const shapes = useMemo(() => {
    const { nodes } = buildTemplate(id, { newId: (() => { let i = 0; return () => `p${i++}`; })() });
    if (!nodes.length) return null;
    const byId = indexNodes(nodes);
    const boxes = nodes.map((n) => ({ node: n, box: absoluteBox(byId, n) }));
    const all = unionBox(boxes.map((b) => b.box))!;
    const scale = Math.min((PREVIEW_W - 16) / all.w, (PREVIEW_H - 16) / all.h);
    const ox = (PREVIEW_W - all.w * scale) / 2 - all.x * scale;
    const oy = (PREVIEW_H - all.h * scale) / 2 - all.y * scale;
    return boxes.map(({ node, box }) => ({
      id: node.id,
      type: node.data.type,
      color: 'color' in node.data ? node.data.color : undefined,
      x: box.x * scale + ox,
      y: box.y * scale + oy,
      w: box.w * scale,
      h: box.h * scale,
    }));
  }, [id]);

  return (
    <svg viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} className="h-full w-full" aria-hidden>
      <rect width={PREVIEW_W} height={PREVIEW_H} fill="#F8FAFC" />
      {!shapes && (
        <g stroke="#CBD5E1" strokeWidth={1.5} strokeLinecap="round">
          <line x1={PREVIEW_W / 2 - 8} x2={PREVIEW_W / 2 + 8} y1={PREVIEW_H / 2} y2={PREVIEW_H / 2} />
          <line y1={PREVIEW_H / 2 - 8} y2={PREVIEW_H / 2 + 8} x1={PREVIEW_W / 2} x2={PREVIEW_W / 2} />
        </g>
      )}
      {shapes?.map((s) =>
        s.type === 'frame' ? (
          <rect key={s.id} x={s.x} y={s.y} width={s.w} height={s.h} rx={3} fill={s.color ?? 'rgba(148,163,184,0.12)'} stroke="#CBD5E1" strokeWidth={0.75} />
        ) : s.type === 'text' ? (
          <rect key={s.id} x={s.x} y={s.y + s.h * 0.3} width={Math.min(s.w, 40)} height={Math.max(2, s.h * 0.4)} rx={1} fill="#334155" />
        ) : (
          <rect key={s.id} x={s.x} y={s.y} width={s.w} height={s.h} rx={1.5} fill={s.color ?? '#FEF3C7'} stroke="rgba(15,23,42,0.08)" strokeWidth={0.5} />
        ),
      )}
    </svg>
  );
}

/** The template cards (used by the editor's picker and the create dialog). */
export function TemplateGrid({
  value,
  onPick,
  include = BOARD_TEMPLATES.map((t) => t.id),
  className,
}: {
  value?: BoardTemplateId;
  onPick: (id: BoardTemplateId) => void;
  include?: BoardTemplateId[];
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3', className)} role="radiogroup" aria-label={t('Templates')}>
      {BOARD_TEMPLATES.filter((tpl) => include.includes(tpl.id)).map((tpl) => {
        const selected = value === tpl.id;
        return (
          <button
            key={tpl.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(tpl.id)}
            data-testid={`board-template-${tpl.id}`}
            className={cn(
              'group flex flex-col overflow-hidden rounded-xl border text-left transition-colors',
              selected ? 'border-[#5173D6] ring-1 ring-[#5173D6]' : 'hover:border-[#5173D6]/60 hover:bg-muted/40',
            )}
          >
            <span className="aspect-video w-full overflow-hidden border-b bg-muted/30">
              <TemplatePreview id={tpl.id} />
            </span>
            <span className="px-2.5 py-2">
              <span className="block text-sm font-semibold">{t(tpl.label)}</span>
              <span className="block truncate text-xs text-muted-foreground">{t(tpl.description)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// The editor's Template tool: inserts the picked template at the centre of the view.
export function TemplatePicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (id: BoardTemplateId) => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="board-template-picker">
        <DialogHeader>
          <DialogTitle>{t('Templates')}</DialogTitle>
          <DialogDescription>{t('Insert a ready-made layout at the centre of the view.')}</DialogDescription>
        </DialogHeader>
        <TemplateGrid onPick={onPick} />
      </DialogContent>
    </Dialog>
  );
}
