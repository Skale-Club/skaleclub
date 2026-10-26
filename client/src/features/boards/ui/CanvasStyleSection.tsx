import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { LucideIcon } from 'lucide-react';
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Lock,
  Replace,
  Trash2,
  Unlock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { BoardEdge, BoardNode } from '@shared/schema/boards';
import { EDGE_STYLES } from '@shared/schema/boards';
import { FRAME_COLORS, STICKY_COLORS, TEXT_SIZES } from '@shared/boards/canvasDefaults';
import { useBoardStore, useBoardStoreApi, type BoardState } from '../store/boardStore';
import {
  alignSelection,
  distributeSelection,
  duplicateSelection,
  reorderSelection,
  replaceImage,
  setSelectionLocked,
  updateSelectedData,
  updateSelectedEdges,
} from '../canvas/actions';
import { BOARD_IMAGE_ACCEPT } from '../canvas/images';
import { useImageUpload } from '../canvas/useImageUpload';
import { SHAPE_OPTIONS } from './Toolbar';
import { CTA_BLUE, EDGE_NEUTRAL } from '../engine/palette';

const INK_COLORS = ['#1E293B', '#5173D6', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#64748B'] as const;
const FILL_COLORS = ['#FFFFFF', ...STICKY_COLORS.slice(0, 7)] as const;
const STROKE_COLORS = [CTA_BLUE, '#0A162E', '#64748B', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#CBD5E1'] as const;
const EDGE_COLORS = [EDGE_NEUTRAL, '#0A162E', CTA_BLUE, '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'] as const;

const selectSelectedNodes = (s: BoardState): BoardNode[] => {
  const ids = new Set(s.selection.nodeIds);
  return s.document.nodes.filter((n) => ids.has(n.id));
};
const selectSelectedEdges = (s: BoardState): BoardEdge[] => {
  const ids = new Set(s.selection.edgeIds);
  return s.document.edges.filter((e) => ids.has(e.id));
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm">{label}</p>
      {children}
    </div>
  );
}

function Swatches({ colors, value, onPick, testId, allowNone }: { colors: readonly string[]; value?: string; onPick: (color: string | undefined) => void; testId: string; allowNone?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {allowNone && (
        <button
          type="button"
          onClick={() => onPick(undefined)}
          aria-label={t('Default')}
          aria-pressed={!value}
          className={cn('relative h-7 w-7 overflow-hidden border bg-background', !value && 'ring-2 ring-[#5173D6] ring-offset-1 ring-offset-background')}
          style={{ borderRadius: 999 }}
          data-testid={`${testId}-none`}
        >
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 rotate-45 bg-destructive/70" />
        </button>
      )}
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onPick(color)}
          aria-label={color}
          aria-pressed={value === color}
          className={cn('h-7 w-7 border border-black/10 transition-transform hover:scale-110', value === color && 'ring-2 ring-[#5173D6] ring-offset-1 ring-offset-background')}
          style={{ backgroundColor: color, borderRadius: 999 }}
          data-testid={`${testId}-${color.replace(/[^a-z0-9]/gi, '').toLowerCase()}`}
        />
      ))}
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, testId }: { value: T | undefined; options: { id: T; label: string; icon?: LucideIcon }[]; onChange: (value: T) => void; testId: string }) {
  return (
    <div className="grid gap-1 rounded-xl border p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          aria-label={label}
          title={label}
          data-testid={`${testId}-${id}`}
          className={cn(
            'flex items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-xs font-medium transition-colors',
            value === id ? 'bg-[#5173D6] text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : <span className="truncate">{label}</span>}
        </button>
      ))}
    </div>
  );
}

function IconAction({ label, icon: Icon, onClick, disabled, testId, destructive }: { label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean; testId: string; destructive?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          data-testid={testId}
          className={cn(
            'flex h-8 items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-40',
            destructive ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/** A text field that commits on Enter or blur (one undo step per edit, not per key). */
function CommitInput({ value, onCommit, placeholder, testId, multiline }: { value: string; onCommit: (value: string) => void; placeholder?: string; testId: string; multiline?: boolean }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  const props = {
    value: draft,
    placeholder,
    'data-testid': testId,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
        e.preventDefault();
        commit();
        (e.target as HTMLElement).blur();
      } else if (e.key === 'Escape') {
        setDraft(value);
        (e.target as HTMLElement).blur();
      }
    },
  };
  return multiline ? (
    <textarea {...props} rows={2} className="w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
  ) : (
    <Input {...props} className="h-9 rounded-xl" />
  );
}

function ReplaceImageButton({ id }: { id: string }) {
  const { t } = useTranslation();
  const store = useBoardStoreApi();
  const upload = useImageUpload();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        data-testid="board-image-replace"
      >
        <Replace className="h-4 w-4" />
        {busy ? t('Uploading…') : t('Replace image')}
      </button>
      <input
        ref={input}
        type="file"
        accept={BOARD_IMAGE_ACCEPT}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          const image = await upload(file);
          setBusy(false);
          if (image) replaceImage(store, id, image);
        }}
      />
    </>
  );
}

function NodeStyle({ nodes }: { nodes: BoardNode[] }) {
  const { t } = useTranslation();
  const store = useBoardStoreApi();
  const types = new Set(nodes.map((n) => n.data.type));
  const single = nodes.length === 1 ? nodes[0] : null;
  const first = nodes[0];
  const ids = nodes.map((n) => n.id);

  if (types.size === 1 && first.data.type === 'sticky') {
    const data = first.data;
    return (
      <Field label={t('Color')}>
        <Swatches colors={STICKY_COLORS} value={data.color ?? STICKY_COLORS[0]} onPick={(color) => updateSelectedData(store, 'sticky', { color }, ids)} testId="board-style-sticky-color" />
      </Field>
    );
  }
  if (types.size === 1 && first.data.type === 'shape') {
    const data = first.data;
    return (
      <>
        <Field label={t('Shape')}>
          <Segmented value={data.shape} options={SHAPE_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))} onChange={(shape) => updateSelectedData(store, 'shape', { shape }, ids)} testId="board-style-shape-kind" />
        </Field>
        <Field label={t('Fill')}>
          <Swatches colors={FILL_COLORS} value={data.fill} allowNone onPick={(fill) => updateSelectedData(store, 'shape', { fill }, ids)} testId="board-style-shape-fill" />
        </Field>
        <Field label={t('Border')}>
          <Swatches colors={STROKE_COLORS} value={data.stroke ?? CTA_BLUE} onPick={(stroke) => updateSelectedData(store, 'shape', { stroke }, ids)} testId="board-style-shape-stroke" />
        </Field>
        {single?.data.type === 'shape' && (
          <Field label={t('Text')}>
            <CommitInput value={single.data.text ?? ''} placeholder={t('Text inside the shape')} multiline onCommit={(text) => updateSelectedData(store, 'shape', { text }, ids)} testId="board-style-shape-text" />
          </Field>
        )}
      </>
    );
  }
  if (types.size === 1 && first.data.type === 'text') {
    const data = first.data;
    const sizeKey = (Object.entries(TEXT_SIZES).find(([, v]) => v === (data.fontSize ?? TEXT_SIZES.M))?.[0] ?? undefined) as keyof typeof TEXT_SIZES | undefined;
    return (
      <>
        <Field label={t('Size')}>
          <Segmented
            value={sizeKey}
            options={(Object.keys(TEXT_SIZES) as (keyof typeof TEXT_SIZES)[]).map((k) => ({ id: k, label: k }))}
            onChange={(k) => updateSelectedData(store, 'text', { fontSize: TEXT_SIZES[k] }, ids)}
            testId="board-style-text-size"
          />
        </Field>
        <Field label={t('Alignment')}>
          <Segmented
            value={data.align ?? 'left'}
            options={[
              { id: 'left' as const, label: t('Left'), icon: AlignLeft },
              { id: 'center' as const, label: t('Center'), icon: AlignCenter },
              { id: 'right' as const, label: t('Right'), icon: AlignRight },
            ]}
            onChange={(align) => updateSelectedData(store, 'text', { align }, ids)}
            testId="board-style-text-align"
          />
        </Field>
        <Field label={t('Color')}>
          <Swatches colors={INK_COLORS} value={data.color} allowNone onPick={(color) => updateSelectedData(store, 'text', { color }, ids)} testId="board-style-text-color" />
        </Field>
      </>
    );
  }
  if (types.size === 1 && first.data.type === 'frame') {
    const data = first.data;
    return (
      <>
        {single?.data.type === 'frame' && (
          <Field label={t('Title')}>
            <CommitInput value={single.data.title ?? ''} placeholder={t('Frame')} onCommit={(title) => updateSelectedData(store, 'frame', { title: title.trim().slice(0, 200) || 'Frame' }, ids)} testId="board-style-frame-title" />
          </Field>
        )}
        <Field label={t('Background')}>
          <Swatches colors={FRAME_COLORS} value={data.color} allowNone onPick={(color) => updateSelectedData(store, 'frame', { color }, ids)} testId="board-style-frame-color" />
        </Field>
      </>
    );
  }
  if (types.size === 1 && single?.data.type === 'image') {
    return (
      <>
        <Field label={t('Alt text')}>
          <CommitInput value={single.data.alt ?? ''} placeholder={t('Describe the image')} onCommit={(alt) => updateSelectedData(store, 'image', { alt: alt.slice(0, 500) }, ids)} testId="board-style-image-alt" />
        </Field>
        <ReplaceImageButton id={single.id} />
      </>
    );
  }
  // A mix of notes, shapes and frames: one color for all of them.
  const colorable = nodes.filter((n) => n.data.type === 'sticky' || n.data.type === 'shape' || n.data.type === 'frame');
  if (types.size > 1 && colorable.length >= 2) {
    return (
      <Field label={t('Color')}>
        <Swatches
          colors={STICKY_COLORS}
          onPick={(color) => {
            store.getState().beginBatch();
            updateSelectedData(store, 'sticky', { color }, ids);
            updateSelectedData(store, 'shape', { fill: color }, ids);
            updateSelectedData(store, 'frame', { color }, ids);
            store.getState().endBatch();
          }}
          testId="board-style-common-color"
        />
      </Field>
    );
  }
  return null;
}

function EdgeStyle({ edges }: { edges: BoardEdge[] }) {
  const { t } = useTranslation();
  const store = useBoardStoreApi();
  const data = edges[0].data ?? {};
  const ids = edges.map((e) => e.id);
  const set = (patch: NonNullable<BoardEdge['data']>) => updateSelectedEdges(store, patch, ids);
  return (
    <>
      <Field label={t('Line')}>
        <Segmented
          value={data.style ?? 'curve'}
          options={EDGE_STYLES.map((id) => ({ id, label: t(id === 'curve' ? 'Curved' : id === 'straight' ? 'Straight' : 'Step') }))}
          onChange={(style) => set({ style })}
          testId="board-style-edge-line"
        />
      </Field>
      <div className="space-y-2.5">
        {(
          [
            ['arrowStart', t('Arrow at start'), !!data.arrowStart],
            ['arrowEnd', t('Arrow at end'), data.arrowEnd !== false],
            ['dashed', t('Dashed'), !!data.dashed],
          ] as const
        ).map(([key, label, checked]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <Label htmlFor={`board-edge-${key}`} className="text-sm font-normal">
              {label}
            </Label>
            <Switch id={`board-edge-${key}`} checked={checked} onCheckedChange={(value) => set({ [key]: value })} data-testid={`board-style-edge-${key}`} />
          </div>
        ))}
      </div>
      <Field label={t('Color')}>
        <Swatches colors={EDGE_COLORS} value={data.color ?? EDGE_NEUTRAL} onPick={(color) => set({ color })} testId="board-style-edge-color" />
      </Field>
      {edges.length === 1 && (
        <Field label={t('Label')}>
          <CommitInput value={data.label ?? ''} placeholder={t('Double-click the line to edit')} onCommit={(label) => set({ label: label.trim().slice(0, 500) || undefined })} testId="board-style-edge-label" />
        </Field>
      )}
    </>
  );
}

function Arrange({ nodes }: { nodes: BoardNode[] }) {
  const { t } = useTranslation();
  const store = useBoardStoreApi();
  const allLocked = nodes.every((n) => n.locked);
  const movable = nodes.filter((n) => !n.locked).length;
  return (
    <section className="space-y-3" data-testid="board-arrange">
      <SectionTitle>{t('Arrange')}</SectionTitle>
      <div className="grid grid-cols-3 gap-1.5">
        <IconAction label={t('Duplicate')} icon={Copy} onClick={() => duplicateSelection(store)} testId="board-arrange-duplicate" />
        <IconAction label={allLocked ? t('Unlock') : t('Lock')} icon={allLocked ? Unlock : Lock} onClick={() => setSelectionLocked(store, !allLocked)} testId="board-arrange-lock" />
        <IconAction label={t('Delete')} icon={Trash2} onClick={() => store.getState().removeSelection()} disabled={allLocked} testId="board-arrange-delete" destructive />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <IconAction label={t('Bring to front')} icon={ArrowUpToLine} onClick={() => reorderSelection(store, 'front')} testId="board-arrange-front" />
        <IconAction label={t('Bring forward')} icon={ArrowUp} onClick={() => reorderSelection(store, 'forward')} testId="board-arrange-forward" />
        <IconAction label={t('Send backward')} icon={ArrowDown} onClick={() => reorderSelection(store, 'backward')} testId="board-arrange-backward" />
        <IconAction label={t('Send to back')} icon={ArrowDownToLine} onClick={() => reorderSelection(store, 'back')} testId="board-arrange-back" />
      </div>
      {movable >= 2 && (
        <>
          <div className="grid grid-cols-6 gap-1.5">
            <IconAction label={t('Align left')} icon={AlignStartVertical} onClick={() => alignSelection(store, 'left')} testId="board-align-left" />
            <IconAction label={t('Align center')} icon={AlignCenterVertical} onClick={() => alignSelection(store, 'center')} testId="board-align-center" />
            <IconAction label={t('Align right')} icon={AlignEndVertical} onClick={() => alignSelection(store, 'right')} testId="board-align-right" />
            <IconAction label={t('Align top')} icon={AlignStartHorizontal} onClick={() => alignSelection(store, 'top')} testId="board-align-top" />
            <IconAction label={t('Align middle')} icon={AlignCenterHorizontal} onClick={() => alignSelection(store, 'middle')} testId="board-align-middle" />
            <IconAction label={t('Align bottom')} icon={AlignEndHorizontal} onClick={() => alignSelection(store, 'bottom')} testId="board-align-bottom" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <IconAction label={t('Distribute horizontally')} icon={AlignHorizontalDistributeCenter} onClick={() => distributeSelection(store, 'horizontal')} disabled={movable < 3} testId="board-distribute-horizontal" />
            <IconAction label={t('Distribute vertically')} icon={AlignVerticalDistributeCenter} onClick={() => distributeSelection(store, 'vertical')} disabled={movable < 3} testId="board-distribute-vertical" />
          </div>
        </>
      )}
    </section>
  );
}

const TYPE_LABELS: Record<string, string> = { sticky: 'Sticky note', shape: 'Shape', text: 'Text', frame: 'Frame', image: 'Image', mind: 'Topic' };

/** Style and arrangement for canvas items (null when the selection has none). */
export function CanvasStyleSection() {
  const { t } = useTranslation();
  const nodes = useBoardStore(useShallow(selectSelectedNodes));
  const edges = useBoardStore(useShallow(selectSelectedEdges));
  const canvasNodes = nodes.filter((n) => n.data.type !== 'mind');
  const connectors = edges.filter((e) => e.kind === 'connector');
  if (!canvasNodes.length && !connectors.length) return null;
  const types = new Set(canvasNodes.map((n) => n.data.type));
  const heading =
    canvasNodes.length && !connectors.length
      ? canvasNodes.length === 1
        ? t(TYPE_LABELS[canvasNodes[0].data.type])
        : types.size === 1
          ? `${canvasNodes.length} × ${t(TYPE_LABELS[canvasNodes[0].data.type])}`
          : `${canvasNodes.length} ${t('items selected')}`
      : connectors.length === 1
        ? t('Connector')
        : `${connectors.length} ${t('connectors')}`;
  return (
    <div className="flex flex-col gap-6" data-testid="board-canvas-style">
      <section className="space-y-4">
        <SectionTitle>{heading}</SectionTitle>
        {canvasNodes.length > 0 && <NodeStyle nodes={canvasNodes} />}
        {connectors.length > 0 && !canvasNodes.length && <EdgeStyle edges={connectors} />}
      </section>
      {canvasNodes.length > 0 && <Arrange nodes={canvasNodes} />}
    </div>
  );
}
