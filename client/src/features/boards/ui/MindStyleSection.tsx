import { useEffect, useState } from 'react';
import { AlignHorizontalJustifyCenter, ArrowRightFromLine, Loader2, Network, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { MindNodeData } from '@shared/schema/boards';
import { MIND_LAYOUTS } from '@shared/schema/boards';
import { useBoardStore, useBoardStoreApi } from '../store/boardStore';
import { branchPalette } from '../engine/palette';
import { clearMindData, setMindData } from '../mindmap/actions';
import { getMindForest } from '../mindmap/autoLayout';
import { useBoardsAiEnabled } from '../ai/boardsAiApi';
import { useExpandWithAi } from '../ai/useExpandWithAi';

export const MIND_ICONS = ['💡', '⭐', '🎯', '✅', '❗', '❓', '🚀', '📌', '📈', '💰', '🛠️', '📣', '🧠', '❤️', '⚠️', '🔥', '📅', '👥', '📝', '🔍', '🏁', '🎨', '💬', '🌱'] as const;

const LAYOUT_LABELS: Record<(typeof MIND_LAYOUTS)[number], { label: string; icon: typeof Network }> = {
  balanced: { label: 'Balanced', icon: AlignHorizontalJustifyCenter },
  right: { label: 'Right', icon: ArrowRightFromLine },
  vertical: { label: 'Org chart', icon: Network },
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
  testId,
}: {
  value: T;
  options: { id: T; label: string; icon?: typeof Network }[];
  onChange: (value: T) => void;
  testId: string;
}) {
  return (
    <div className="grid gap-1 rounded-xl border p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          data-testid={`${testId}-${id}`}
          className={cn(
            'flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-xs font-medium transition-colors',
            value === id ? 'bg-[#5173D6] text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{label}</span>
        </button>
      ))}
    </div>
  );
}

function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:' ? url.toString() : null;
  } catch {
    return null;
  }
}

// Style controls for one selected mind node: color, icon, task, note, link,
// plus the root's layout and a first-level branch's side.
export function MindStyleSection({ id }: { id: string }) {
  const { t } = useTranslation();
  const store = useBoardStoreApi();
  const node = useBoardStore((s) => s.document.nodes.find((n) => n.id === id));
  const palette = useBoardStore((s) => s.document.theme.palette);
  const aiEnabled = useBoardsAiEnabled();
  const aiBusy = useBoardStore((s) => s.aiBusyNodeId !== null);
  const aiBusyHere = useBoardStore((s) => s.aiBusyNodeId === id);
  const expandWithAi = useExpandWithAi();
  const position = useBoardStore((s) => {
    const forest = getMindForest(s.document.nodes, s.document.edges);
    const parent = forest.parent.get(id);
    const rootId = forest.rootOf.get(id);
    const rootLayout = rootId ? ((forest.nodes.get(rootId)?.data as MindNodeData | undefined)?.layout ?? 'balanced') : 'balanced';
    return `${forest.depth.get(id) ?? 0}|${parent === undefined ? '' : parent}|${rootLayout}`;
  });
  const [depthText, , rootLayout] = position.split('|');
  const depth = Number(depthText);
  const data = node?.data.type === 'mind' ? node.data : null;

  const [note, setNote] = useState(data?.note ?? '');
  const [link, setLink] = useState(data?.link ?? '');
  const [linkError, setLinkError] = useState(false);
  useEffect(() => setNote(data?.note ?? ''), [data?.note, id]);
  useEffect(() => {
    setLink(data?.link ?? '');
    setLinkError(false);
  }, [data?.link, id]);

  if (!data) return null;

  const commitNote = () => {
    const value = note.slice(0, 5_000);
    if (value.trim()) {
      if (value !== data.note) setMindData(store, id, { note: value });
    } else clearMindData(store, id, ['note']);
  };
  const commitLink = () => {
    if (!link.trim()) {
      setLinkError(false);
      clearMindData(store, id, ['link']);
      return;
    }
    const url = normalizeUrl(link);
    if (!url) {
      setLinkError(true);
      return;
    }
    setLinkError(false);
    setLink(url);
    if (url !== data.link) setMindData(store, id, { link: url });
  };

  return (
    <section className="space-y-4" data-testid="mind-style-section">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{depth === 0 ? t('Central topic') : t('Topic')}</h3>

      {aiEnabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2 rounded-xl"
          onClick={() => void expandWithAi(id)}
          disabled={aiBusy}
          data-testid="mind-style-ai-expand"
        >
          {aiBusyHere ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-[#5173D6]" />}
          {aiBusyHere ? t('Thinking…') : t('Expand with AI')}
        </Button>
      )}

      <div>
        <p className="mb-2 text-sm">{t('Color')}</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => clearMindData(store, id, ['color'])}
            aria-pressed={!data.color}
            aria-label={t('Automatic color')}
            title={t('Automatic')}
            data-testid="mind-color-auto"
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full border bg-gradient-to-br from-white to-slate-200 text-[10px] font-semibold text-slate-500',
              !data.color && 'ring-2 ring-[#5173D6] ring-offset-2 ring-offset-background',
            )}
          >
            A
          </button>
          {branchPalette(palette).map((color, i) => (
            <button
              key={color}
              type="button"
              onClick={() => setMindData(store, id, { color })}
              aria-pressed={data.color === color}
              aria-label={color}
              data-testid={`mind-color-${i}`}
              className={cn('h-7 w-7 rounded-full shadow-sm transition-transform hover:scale-110', data.color === color && 'ring-2 ring-[#5173D6] ring-offset-2 ring-offset-background')}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm">{t('Icon')}</p>
          {data.icon && (
            <button type="button" onClick={() => clearMindData(store, id, ['icon'])} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid="mind-icon-clear">
              <X className="h-3 w-3" />
              {t('Remove')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-8 gap-1">
          {MIND_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => setMindData(store, id, { icon })}
              aria-pressed={data.icon === icon}
              data-testid="mind-icon-option"
              className={cn('flex h-7 items-center justify-center rounded-lg text-base transition-colors hover:bg-muted', data.icon === icon && 'bg-[#5173D6]/15 ring-1 ring-[#5173D6]')}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="mind-task" className="text-sm font-normal">
          {t('Task checkbox')}
        </Label>
        <Switch
          id="mind-task"
          checked={!!data.task}
          onCheckedChange={(checked) => (checked ? setMindData(store, id, { task: { done: false } }) : clearMindData(store, id, ['task']))}
          data-testid="mind-task-toggle"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mind-note" className="text-sm font-normal">
          {t('Note')}
        </Label>
        <Textarea
          id="mind-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commitNote}
          placeholder={t('Add details shown on hover')}
          className="min-h-[72px] resize-y rounded-xl text-sm"
          maxLength={5_000}
          data-testid="mind-note-input"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mind-link" className="text-sm font-normal">
          {t('Link')}
        </Label>
        <Input
          id="mind-link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onBlur={commitLink}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          placeholder="https://"
          className={cn('h-9 rounded-xl text-sm', linkError && 'border-destructive focus-visible:ring-destructive')}
          aria-invalid={linkError}
          data-testid="mind-link-input"
        />
        {linkError && <p className="text-xs text-destructive">{t('Enter a valid web address.')}</p>}
      </div>

      {depth === 0 && (
        <div>
          <p className="mb-2 text-sm">{t('Layout')}</p>
          <Segmented
            value={data.layout ?? 'balanced'}
            options={MIND_LAYOUTS.map((kind) => ({ id: kind, label: t(LAYOUT_LABELS[kind].label), icon: LAYOUT_LABELS[kind].icon }))}
            onChange={(layout) => setMindData(store, id, { layout })}
            testId="mind-layout"
          />
        </div>
      )}

      {depth === 1 && rootLayout === 'balanced' && (
        <div>
          <p className="mb-2 text-sm">{t('Side')}</p>
          <Segmented
            value={data.side ?? 'auto'}
            options={[
              { id: 'left', label: t('Left') },
              { id: 'auto', label: t('Auto') },
              { id: 'right', label: t('Right') },
            ]}
            onChange={(side) => (side === 'auto' ? clearMindData(store, id, ['side']) : setMindData(store, id, { side }))}
            testId="mind-side"
          />
        </div>
      )}
    </section>
  );
}
