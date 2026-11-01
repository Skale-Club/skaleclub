import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Circle, Diamond, Eraser, Frame, ImageIcon, MousePointer2, Network, PenLine, Plus, RectangleHorizontal, Spline, Square, StickyNote, Triangle, Type } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { STICKY_COLORS } from '@shared/boards/canvasDefaults';
import { PEN_COLORS, PEN_SIZES } from '@shared/boards/strokes';
import type { ShapeNodeData } from '@shared/schema/boards';
import { useBoardStore, type BoardTool } from '../store/boardStore';
import { setToolPrefs, toolPrefsSignal, useSignal } from '../canvas/interaction';

export interface ToolDefinition {
  id: BoardTool;
  label: string;
  icon: LucideIcon;
  /** Single-key shortcut shown in the tooltip. */
  shortcut: string;
  enabled: boolean;
  /** One line under the name in the tooltip. */
  description?: string;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { id: 'select', label: 'Select', icon: MousePointer2, shortcut: 'V', enabled: true, description: 'Select, move and edit' },
  { id: 'mind', label: 'Mind map', icon: Network, shortcut: 'M', enabled: true, description: 'Click the canvas to start a new map' },
  { id: 'sticky', label: 'Sticky note', icon: StickyNote, shortcut: 'N', enabled: true, description: 'Click to place a note' },
  { id: 'shape', label: 'Shape', icon: Square, shortcut: 'S', enabled: true, description: 'Drag to draw, or click' },
  { id: 'text', label: 'Text', icon: Type, shortcut: 'T', enabled: true, description: 'Click to type' },
  { id: 'connector', label: 'Connector', icon: Spline, shortcut: 'C', enabled: true, description: 'Click two items, or drag from a handle' },
  { id: 'pen', label: 'Pen', icon: PenLine, shortcut: 'P', enabled: true, description: 'Draw freehand' },
  { id: 'image', label: 'Image', icon: ImageIcon, shortcut: 'I', enabled: true, description: 'Upload, drop or paste a picture' },
  { id: 'frame', label: 'Frame', icon: Frame, shortcut: 'F', enabled: true, description: 'Drag to draw a container' },
];

export const SHAPE_OPTIONS: { id: ShapeNodeData['shape']; label: string; icon: LucideIcon }[] = [
  { id: 'rect', label: 'Rectangle', icon: RectangleHorizontal },
  { id: 'rounded', label: 'Rounded', icon: Square },
  { id: 'ellipse', label: 'Ellipse', icon: Circle },
  { id: 'diamond', label: 'Diamond', icon: Diamond },
  { id: 'triangle', label: 'Triangle', icon: Triangle },
];

const TOOL_BUTTON_CLASS = 'flex h-10 w-10 items-center justify-center rounded-xl transition-colors';

// Always on the rail; the rest live behind "More tools".
const MORE_TOOL_IDS: BoardTool[] = ['connector', 'image', 'frame'];

type Orientation = 'vertical' | 'horizontal';

interface ToolbarProps {
  activeTool: BoardTool;
  onSelectTool: (tool: BoardTool) => void;
  tools?: ToolDefinition[];
  /** Vertical rail (desktop) or a horizontal, scrollable bar (phones). */
  orientation?: Orientation;
  className?: string;
}

function ToolButton({
  label,
  hint,
  description,
  icon: Icon,
  active,
  disabled,
  onClick,
  testId,
  side,
}: {
  label: string;
  hint: string;
  description?: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  testId: string;
  side: 'right' | 'top';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A wrapper keeps the tooltip working on a disabled button. */}
        <span className="inline-flex shrink-0">
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-pressed={active}
            data-testid={testId}
            data-active={active ? 'true' : undefined}
            className={cn(
              TOOL_BUTTON_CLASS,
              active ? 'bg-[#5173D6] text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              disabled && 'pointer-events-none opacity-40',
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[220px]">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          {hint && <kbd className="rounded border bg-muted px-1 font-sans text-[10px] text-muted-foreground">{hint}</kbd>}
        </div>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

// "More tools": the occasional tools in a popover. The button wears the active
// tool's icon and style while one of them is on, so it is never a mystery.
function MoreTools({ tools, activeTool, onSelectTool, side }: { tools: ToolDefinition[]; activeTool: BoardTool; onSelectTool: (tool: BoardTool) => void; side: 'right' | 'top' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const activeMore = tools.find((tool) => tool.id === activeTool);
  const Icon = activeMore?.icon ?? Plus;
  const label = t('More tools');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A wrapper keeps the tooltip from fighting the popover for the button's ref. */}
          <span className="inline-flex shrink-0">
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={label}
                aria-pressed={!!activeMore}
                data-testid="board-tool-more"
                data-active={activeMore ? 'true' : undefined}
                data-tool={activeMore?.id}
                className={cn(TOOL_BUTTON_CLASS, activeMore ? 'bg-[#5173D6] text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground', open && !activeMore && 'bg-muted text-foreground')}
              >
                <Icon className="h-[18px] w-[18px]" />
              </button>
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent side={side}>{activeMore ? `${label}: ${t(activeMore.label)}` : label}</TooltipContent>
      </Tooltip>
      <PopoverContent
        side={side}
        align={side === 'right' ? 'start' : 'center'}
        sideOffset={10}
        className="w-64 rounded-2xl p-1.5"
        data-testid="board-tool-more-menu"
        // The tool keys are global: don't park focus (and a tooltip) on the button.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {tools.map((tool) => {
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onSelectTool(active ? 'select' : tool.id);
              }}
              disabled={!tool.enabled}
              aria-pressed={active}
              data-testid={`board-tool-${tool.id}`}
              data-active={active ? 'true' : undefined}
              className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors', active ? 'bg-[#5173D6] text-white' : 'hover:bg-muted', !tool.enabled && 'pointer-events-none opacity-40')}
            >
              <tool.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{t(tool.label)}</span>
                {(tool.enabled ? tool.description : 'Coming soon') && (
                  <span className={cn('block truncate text-xs', active ? 'text-white/80' : 'text-muted-foreground')}>{t(tool.enabled ? tool.description! : 'Coming soon')}</span>
                )}
              </span>
              {tool.enabled && <kbd className={cn('rounded border px-1 font-sans text-[10px]', active ? 'border-white/40 text-white/90' : 'bg-muted text-muted-foreground')}>{tool.shortcut}</kbd>}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// Miro-like tool rail: vertical on the left of the editor, a horizontal
// scrollable bar at the bottom on phones.
export function Toolbar({ activeTool, onSelectTool, tools = TOOL_DEFINITIONS, orientation = 'vertical', className }: ToolbarProps) {
  const { t } = useTranslation();
  const vertical = orientation === 'vertical';
  const side = vertical ? 'right' : 'top';
  const primary = tools.filter((tool) => !MORE_TOOL_IDS.includes(tool.id));
  const more = tools.filter((tool) => MORE_TOOL_IDS.includes(tool.id));
  return (
    <nav
      className={cn(
        'flex items-center gap-1 rounded-2xl border bg-background/95 p-1.5 shadow-md backdrop-blur',
        vertical ? 'flex-col' : 'flex-row overflow-x-auto overscroll-x-contain [scrollbar-width:none]',
        className,
      )}
      aria-label={t('Board tools')}
      aria-orientation={orientation}
      data-testid="board-toolbar"
      data-orientation={orientation}
    >
      {primary.map((tool) => (
        <ToolButton
          key={tool.id}
          label={t(tool.label)}
          hint={tool.enabled ? tool.shortcut : ''}
          description={tool.enabled ? (tool.description ? t(tool.description) : undefined) : t('Coming soon')}
          icon={tool.icon}
          active={activeTool === tool.id}
          disabled={!tool.enabled}
          onClick={() => onSelectTool(activeTool === tool.id && tool.id !== 'select' ? 'select' : tool.id)}
          testId={`board-tool-${tool.id}`}
          side={side}
        />
      ))}
      {more.length > 0 && <MoreTools tools={more} activeTool={activeTool} onSelectTool={onSelectTool} side={side} />}
    </nav>
  );
}

function Swatch({ color, active, onClick, label, testId }: { color: string; active: boolean; onClick: () => void; label: string; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      data-testid={testId}
      className={cn('h-6 w-6 shrink-0 border border-black/10 transition-transform hover:scale-110', active && 'ring-2 ring-[#5173D6] ring-offset-2 ring-offset-background')}
      style={{ backgroundColor: color, borderRadius: 999 }}
    />
  );
}

/** Options for the active tool (pen color/size/eraser, shape kind, sticky color), next to the rail. */
export function ToolOptions({ orientation = 'vertical', className }: { orientation?: Orientation; className?: string }) {
  const { t } = useTranslation();
  const tool = useBoardStore((s) => s.activeTool);
  const pen = useBoardStore((s) => s.pen);
  const setPen = useBoardStore((s) => s.setPenOptions);
  const prefs = useSignal(toolPrefsSignal);
  if (tool !== 'pen' && tool !== 'shape' && tool !== 'sticky') return null;
  const vertical = orientation === 'vertical';
  return (
    <div
      className={cn('flex items-center gap-1.5 rounded-2xl border bg-background/95 p-2 shadow-md backdrop-blur', vertical ? 'flex-col' : 'flex-row overflow-x-auto', className)}
      data-testid="board-tool-options"
    >
      {tool === 'pen' && (
        <>
          {PEN_COLORS.map((color) => (
            <Swatch key={color} color={color} active={pen.mode === 'draw' && pen.color === color} onClick={() => setPen({ color, mode: 'draw' })} label={color} testId={`board-pen-color-${color.slice(1)}`} />
          ))}
          <div className={cn('shrink-0 bg-border', vertical ? 'my-0.5 h-px w-5' : 'mx-0.5 h-5 w-px')} />
          {PEN_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setPen({ size, mode: 'draw' })}
              aria-label={`${t('Size')} ${size}`}
              aria-pressed={pen.size === size}
              data-testid={`board-pen-size-${size}`}
              className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', pen.size === size ? 'bg-[#5173D6]/15' : 'hover:bg-muted')}
            >
              <span className="bg-foreground" style={{ width: Math.min(18, size + 2), height: Math.min(18, size + 2), borderRadius: 999 }} />
            </button>
          ))}
          <div className={cn('shrink-0 bg-border', vertical ? 'my-0.5 h-px w-5' : 'mx-0.5 h-5 w-px')} />
          <button
            type="button"
            onClick={() => setPen({ mode: pen.mode === 'erase' ? 'draw' : 'erase' })}
            aria-label={t('Eraser')}
            aria-pressed={pen.mode === 'erase'}
            title={t('Eraser: click a stroke to remove it')}
            data-testid="board-pen-eraser"
            className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', pen.mode === 'erase' ? 'bg-[#5173D6] text-white' : 'text-muted-foreground hover:bg-muted')}
          >
            <Eraser className="h-4 w-4" />
          </button>
        </>
      )}
      {tool === 'shape' &&
        SHAPE_OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setToolPrefs({ shapeKind: id })}
            aria-label={t(label)}
            aria-pressed={prefs.shapeKind === id}
            data-testid={`board-shape-kind-${id}`}
            className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', prefs.shapeKind === id ? 'bg-[#5173D6] text-white' : 'text-muted-foreground hover:bg-muted')}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      {tool === 'sticky' &&
        STICKY_COLORS.map((color) => (
          <Swatch key={color} color={color} active={prefs.stickyColor === color} onClick={() => setToolPrefs({ stickyColor: color })} label={color} testId={`board-sticky-color-${color.slice(1)}`} />
        ))}
    </div>
  );
}
