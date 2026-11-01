import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Copy, Lock, PencilLine, Trash2, Unlock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/useTranslation';
import { useBoardStore, useBoardStoreApi } from '../store/boardStore';
import { duplicateSelection, reorderSelection, setSelectionLocked } from './actions';

export interface CanvasContextMenuState {
  kind: 'node' | 'edge';
  id: string;
  /** Viewport (client) coordinates. */
  x: number;
  y: number;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl+';

// Right-click (or long-press) menu for canvas nodes and connectors. Node
// commands apply to the whole selection, which the canvas sets to include the
// node first.
export function CanvasContextMenu({ menu, onClose }: { menu: CanvasContextMenuState | null; onClose: () => void }) {
  const { t } = useTranslation();
  const store = useBoardStoreApi();
  const locked = useBoardStore((s) => (menu?.kind === 'node' ? !!s.document.nodes.find((n) => n.id === menu.id)?.locked : false));
  const exists = useBoardStore((s) =>
    menu ? (menu.kind === 'node' ? s.document.nodes.some((n) => n.id === menu.id) : s.document.edges.some((e) => e.id === menu.id)) : false,
  );
  if (!menu || !exists) return null;

  return (
    <DropdownMenu open onOpenChange={(open) => !open && onClose()}>
      <DropdownMenuTrigger asChild>
        <span aria-hidden className="pointer-events-none fixed h-0 w-0" style={{ left: menu.x, top: menu.y }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl" data-testid="canvas-context-menu" onCloseAutoFocus={(e) => e.preventDefault()}>
        {menu.kind === 'node' ? (
          <>
            <DropdownMenuItem onSelect={() => duplicateSelection(store)} data-testid="canvas-menu-duplicate">
              <Copy className="mr-2 h-4 w-4" />
              {t('Duplicate')}
              <DropdownMenuShortcut>{MOD}D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setSelectionLocked(store, !locked)} data-testid="canvas-menu-lock">
              {locked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
              {locked ? t('Unlock') : t('Lock')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => reorderSelection(store, 'front')} data-testid="canvas-menu-front">
              <ArrowUpToLine className="mr-2 h-4 w-4" />
              {t('Bring to front')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => reorderSelection(store, 'forward')} data-testid="canvas-menu-forward">
              <ArrowUp className="mr-2 h-4 w-4" />
              {t('Bring forward')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => reorderSelection(store, 'backward')} data-testid="canvas-menu-backward">
              <ArrowDown className="mr-2 h-4 w-4" />
              {t('Send backward')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => reorderSelection(store, 'back')} data-testid="canvas-menu-back">
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              {t('Send to back')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => store.getState().removeSelection()}
              disabled={locked}
              className="text-destructive focus:text-destructive"
              data-testid="canvas-menu-delete"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('Delete')}
              <DropdownMenuShortcut>Del</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onSelect={() => store.getState().setEditingEdge(menu.id)} data-testid="canvas-menu-edit-label">
              <PencilLine className="mr-2 h-4 w-4" />
              {t('Edit label')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => store.getState().removeEdges([menu.id])} className="text-destructive focus:text-destructive" data-testid="canvas-menu-delete-edge">
              <Trash2 className="mr-2 h-4 w-4" />
              {t('Delete')}
              <DropdownMenuShortcut>Del</DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
