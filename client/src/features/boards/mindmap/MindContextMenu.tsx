import { ChevronsDownUp, ChevronsUpDown, CornerDownRight, ListPlus, Palette, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useBoardStore, useBoardStoreApi } from '../store/boardStore';
import { branchPalette } from '../engine/palette';
import { addChild, addSibling, clearMindData, removeSubtree, setMindData, toggleCollapse } from './actions';
import { getMindForest } from './autoLayout';

export interface MindContextMenuState {
  nodeId: string;
  /** Viewport (client) coordinates of the right-click. */
  x: number;
  y: number;
}

// Right-click menu on a mind node: add child / sibling, fold, color, delete.
export function MindContextMenu({ menu, onClose }: { menu: MindContextMenuState | null; onClose: () => void }) {
  const { t } = useTranslation();
  const store = useBoardStoreApi();
  const palette = useBoardStore((s) => s.document.theme.palette);
  const node = useBoardStore((s) => (menu ? s.document.nodes.find((n) => n.id === menu.nodeId) : undefined));
  const hasChildren = useBoardStore((s) => (menu ? (getMindForest(s.document.nodes, s.document.edges).children.get(menu.nodeId)?.length ?? 0) > 0 : false));
  if (!menu || !node || node.data.type !== 'mind') return null;
  const id = node.id;
  const collapsed = !!node.data.collapsed;
  const current = node.data.color;

  return (
    <DropdownMenu open onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuTrigger asChild>
        <span aria-hidden className="pointer-events-none fixed h-0 w-0" style={{ left: menu.x, top: menu.y }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl" data-testid="mind-context-menu" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuItem onSelect={() => addChild(store, id)} data-testid="mind-menu-add-child">
          <CornerDownRight className="mr-2 h-4 w-4" />
          {t('Add child')}
          <DropdownMenuShortcut>Tab</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => addSibling(store, id)} data-testid="mind-menu-add-sibling">
          <ListPlus className="mr-2 h-4 w-4" />
          {t('Add sibling')}
          <DropdownMenuShortcut>Enter</DropdownMenuShortcut>
        </DropdownMenuItem>
        {hasChildren && (
          <DropdownMenuItem onSelect={() => toggleCollapse(store, id)} data-testid="mind-menu-collapse">
            {collapsed ? <ChevronsUpDown className="mr-2 h-4 w-4" /> : <ChevronsDownUp className="mr-2 h-4 w-4" />}
            {collapsed ? t('Expand') : t('Collapse')}
            <DropdownMenuShortcut>Space</DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="mind-menu-color">
            <Palette className="mr-2 h-4 w-4" />
            {t('Change color')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="rounded-xl p-2">
            <div className="grid grid-cols-4 gap-1.5">
              {branchPalette(palette).map((color) => (
                <DropdownMenuItem
                  key={color}
                  onSelect={() => setMindData(store, id, { color })}
                  className={cn('h-7 w-7 justify-center rounded-full p-0 focus:ring-2 focus:ring-offset-1', current === color && 'ring-2 ring-offset-1 ring-foreground')}
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => clearMindData(store, id, ['color'])}>{t('Automatic')}</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => removeSubtree(store, id)} className="text-destructive focus:text-destructive" data-testid="mind-menu-delete">
          <Trash2 className="mr-2 h-4 w-4" />
          {t('Delete')}
          <DropdownMenuShortcut>Del</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
