import { useState } from 'react';
import { Panel } from '@xyflow/react';
import { Moon, Sun } from 'lucide-react';
import { normalizeDocument } from '@shared/boards/document';
import type { PublicBoard } from '@shared/schema';
import { cn } from '@/lib/utils';
import { BoardStoreProvider, useCreateBoardStore } from './store/boardStore';
import { BoardCanvas } from './engine/BoardCanvas';

// Read-only board for /b/:slug: pan and zoom, fit, light/dark toggle, title
// overlay. No toolbar, no selection, nothing is saved.
export function BoardViewer({ board }: { board: PublicBoard }) {
  const store = useCreateBoardStore({ document: normalizeDocument(board.document), title: board.title, readOnly: true });
  const [dark, setDark] = useState(() => !!store.getState().document.theme.dark);

  return (
    <BoardStoreProvider store={store}>
      <div className={cn('h-[100dvh] w-full', dark ? 'bg-slate-900' : 'bg-white')} data-testid="board-viewer">
        <BoardCanvas readOnly dark={dark}>
          <Panel position="top-left">
            <div
              className="pointer-events-none max-w-[60vw] truncate rounded-xl border bg-background/90 px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm backdrop-blur"
              data-testid="board-viewer-title"
            >
              {board.title}
            </div>
          </Panel>
          <Panel position="top-right">
            <button
              type="button"
              onClick={() => setDark((value) => !value)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
              aria-label={dark ? 'Light mode' : 'Dark mode'}
              data-testid="board-viewer-theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </Panel>
        </BoardCanvas>
      </div>
    </BoardStoreProvider>
  );
}
