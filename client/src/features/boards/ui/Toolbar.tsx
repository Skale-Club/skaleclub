import type { LucideIcon } from 'lucide-react';
import { Frame, ImageIcon, LayoutTemplate, MousePointer2, Network, PenLine, Spline, Square, StickyNote, Type } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { BoardTool } from '../store/boardStore';

export interface ToolDefinition {
  id: BoardTool;
  label: string;
  icon: LucideIcon;
  /** Single-key shortcut shown in the tooltip (wired once the tool works). */
  shortcut: string;
  /** Later phases flip this on as each tool lands. */
  enabled: boolean;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { id: 'select', label: 'Select', icon: MousePointer2, shortcut: 'V', enabled: true },
  { id: 'mind', label: 'Mind map', icon: Network, shortcut: 'M', enabled: false },
  { id: 'sticky', label: 'Sticky note', icon: StickyNote, shortcut: 'N', enabled: false },
  { id: 'shape', label: 'Shape', icon: Square, shortcut: 'S', enabled: false },
  { id: 'text', label: 'Text', icon: Type, shortcut: 'T', enabled: false },
  { id: 'connector', label: 'Connector', icon: Spline, shortcut: 'C', enabled: false },
  { id: 'pen', label: 'Pen', icon: PenLine, shortcut: 'P', enabled: false },
  { id: 'image', label: 'Image', icon: ImageIcon, shortcut: 'I', enabled: false },
  { id: 'frame', label: 'Frame', icon: Frame, shortcut: 'F', enabled: false },
];

interface ToolbarProps {
  activeTool: BoardTool;
  onSelectTool: (tool: BoardTool) => void;
  tools?: ToolDefinition[];
  /** Opens the template picker (phase 2). */
  onOpenTemplates?: () => void;
  className?: string;
}

function ToolButton({
  label,
  hint,
  icon: Icon,
  active,
  disabled,
  onClick,
  testId,
}: {
  label: string;
  hint: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  testId: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A wrapper keeps the tooltip working on a disabled button. */}
        <span className="inline-flex">
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            aria-pressed={active}
            data-testid={testId}
            data-active={active ? 'true' : undefined}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
              active ? 'bg-[#5173D6] text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              disabled && 'pointer-events-none opacity-40',
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="flex items-center gap-2">
        <span>{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </TooltipContent>
    </Tooltip>
  );
}

// Miro-like vertical tool rail on the left of the editor.
export function Toolbar({ activeTool, onSelectTool, tools = TOOL_DEFINITIONS, onOpenTemplates, className }: ToolbarProps) {
  const { t } = useTranslation();
  return (
    <nav
      className={cn('flex flex-col items-center gap-1 rounded-2xl border bg-background/95 p-1.5 shadow-md backdrop-blur', className)}
      aria-label={t('Board tools')}
      data-testid="board-toolbar"
    >
      {tools.map((tool) => (
        <ToolButton
          key={tool.id}
          label={t(tool.label)}
          hint={tool.enabled ? tool.shortcut : t('Coming soon')}
          icon={tool.icon}
          active={activeTool === tool.id}
          disabled={!tool.enabled}
          onClick={() => onSelectTool(tool.id)}
          testId={`board-tool-${tool.id}`}
        />
      ))}
      <div className="my-1 h-px w-6 bg-border" />
      <ToolButton
        label={t('Templates')}
        hint={onOpenTemplates ? '' : t('Coming soon')}
        icon={LayoutTemplate}
        disabled={!onOpenTemplates}
        onClick={onOpenTemplates}
        testId="board-tool-templates"
      />
    </nav>
  );
}
