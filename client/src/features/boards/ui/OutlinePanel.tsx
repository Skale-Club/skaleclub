import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, ListTree, Network, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { BOARD_LIMITS } from '@shared/schema/boards';
import type { MindForest } from '@shared/boards/layout';
import { useBoardStore, useBoardStoreApi } from '../store/boardStore';
import { getMindForest } from '../mindmap/autoLayout';
import { addChild, exportOutline, selectNode, toggleCollapse } from '../mindmap/actions';
import { computeMindMeta } from '../engine/toFlow';

function OutlineRow({
  id,
  forest,
  depth,
  colors,
  selectedId,
  readOnly,
}: {
  id: string;
  forest: MindForest;
  depth: number;
  colors: Map<string, string | undefined>;
  selectedId: string | null;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const store = useBoardStoreApi();
  const node = forest.nodes.get(id);
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);
  if (!node || node.data.type !== 'mind') return null;
  const data = node.data;
  const kids = forest.children.get(id) ?? [];
  const collapsed = !!data.collapsed && kids.length > 0;
  const selected = selectedId === id;

  const commit = () => {
    setRenaming(false);
    const text = value.slice(0, BOARD_LIMITS.nodeText);
    if (text !== data.text) store.getState().updateNodeData(id, { text });
  };

  return (
    <li role="treeitem" aria-expanded={kids.length ? !collapsed : undefined} aria-selected={selected}>
      <div
        className={cn(
          'group flex h-8 items-center gap-1 rounded-lg pr-1 text-sm transition-colors',
          selected ? 'bg-[#5173D6]/10 text-foreground' : 'text-foreground/90 hover:bg-muted',
        )}
        style={{ paddingLeft: depth * 14 + 2 }}
      >
        {kids.length ? (
          <button
            type="button"
            onClick={() => toggleCollapse(store, id)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label={collapsed ? t('Expand') : t('Collapse')}
            data-testid="outline-toggle"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-150', !collapsed && 'rotate-90')} />
          </button>
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.get(id) ?? 'currentColor', opacity: colors.get(id) ? 1 : 0.4 }} />
          </span>
        )}
        {renaming ? (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setRenaming(false);
            }}
            className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-[#5173D6]/40"
            maxLength={BOARD_LIMITS.nodeText}
            data-testid="outline-rename-input"
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              // Hand the keyboard back to the board (Tab, Enter, arrows act on the topic).
              e.currentTarget.blur();
              selectNode(store, id);
              store.getState().canvasApi?.focusNode(id);
            }}
            onDoubleClick={() => {
              if (readOnly) return;
              setValue(data.text);
              setRenaming(true);
            }}
            className={cn('min-w-0 flex-1 truncate text-left', depth === 0 && 'font-semibold', !data.text.trim() && 'italic text-muted-foreground')}
            title={data.text}
            data-testid="outline-item"
            data-node-id={id}
          >
            {data.icon ? `${data.icon} ` : ''}
            {data.text.trim() || (depth === 0 ? t('Central idea') : t('Topic'))}
          </button>
        )}
        {collapsed && <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{kids.length}</span>}
        {!readOnly && !renaming && (
          <button
            type="button"
            onClick={() => addChild(store, id)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
            aria-label={t('Add child topic')}
            data-testid="outline-add-child"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {kids.length > 0 && !collapsed && (
        <ul role="group">
          {kids.map((kid) => (
            <OutlineRow key={kid} id={kid} forest={forest} depth={depth + 1} colors={colors} selectedId={selectedId} readOnly={readOnly} />
          ))}
        </ul>
      )}
    </li>
  );
}

// The mind map as an indented list: click to select and centre a topic,
// double-click to rename, chevrons fold branches.
export const OutlinePanel = memo(function OutlinePanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const store = useBoardStoreApi();
  const nodes = useBoardStore((s) => s.document.nodes);
  const edges = useBoardStore((s) => s.document.edges);
  const palette = useBoardStore((s) => s.document.theme.palette);
  const readOnly = useBoardStore((s) => s.readOnly);
  const selectedId = useBoardStore((s) => (s.selection.nodeIds.length === 1 ? s.selection.nodeIds[0] : null));
  const [pinnedRoot, setPinnedRoot] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const forest = getMindForest(nodes, edges);
  const colors = useMemo(() => {
    const meta = computeMindMeta(nodes, edges, palette, forest);
    return new Map(Array.from(meta.byId, ([id, m]) => [id, m.branchColor]));
  }, [edges, forest, nodes, palette]);

  const selectedRoot = selectedId ? forest.rootOf.get(selectedId) : undefined;
  const rootId = selectedRoot ?? (pinnedRoot && forest.nodes.has(pinnedRoot) ? pinnedRoot : forest.roots[0]);
  useEffect(() => {
    if (selectedRoot) setPinnedRoot(selectedRoot);
  }, [selectedRoot]);

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(exportOutline(store));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: t('Could not copy'), variant: 'destructive' });
    }
  }

  if (!rootId) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground" data-testid="outline-empty">
        <Network className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{t('No mind map on this board yet. Pick the Mind map tool and click the canvas to start one.')}</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-3" data-testid="outline-panel">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <ListTree className="h-3.5 w-3.5" />
          {t('Outline')}
        </h3>
        <button
          type="button"
          onClick={() => void copyMarkdown()}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          data-testid="outline-copy"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {t('Copy Markdown')}
        </button>
      </div>
      {forest.roots.length > 1 && (
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={t('Maps')}>
          {forest.roots.map((id) => {
            const data = forest.nodes.get(id)?.data;
            const text = data?.type === 'mind' ? data.text.trim() : '';
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPinnedRoot(id);
                  selectNode(store, id);
                  store.getState().canvasApi?.focusNode(id);
                }}
                className={cn(
                  'max-w-full truncate rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                  id === rootId ? 'border-[#5173D6] bg-[#5173D6]/10 text-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
                data-testid="outline-map"
              >
                {text || t('Central idea')}
              </button>
            );
          })}
        </div>
      )}
      <ul role="tree" aria-label={t('Outline')} className="-mx-1 overflow-y-auto">
        <OutlineRow id={rootId} forest={forest} depth={0} colors={colors} selectedId={selectedId} readOnly={readOnly} />
      </ul>
    </div>
  );
});
