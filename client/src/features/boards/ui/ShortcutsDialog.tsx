import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/useTranslation';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

// Only shortcuts that work today; later phases append theirs.
export const BOARD_SHORTCUTS: { group: string; items: { keys: string[]; label: string }[] }[] = [
  {
    group: 'Navigate',
    items: [
      { keys: ['Scroll'], label: 'Pan the board' },
      { keys: ['Space', 'Drag'], label: 'Pan the board' },
      { keys: ['Middle mouse'], label: 'Pan the board' },
      { keys: [MOD, 'Scroll'], label: 'Zoom' },
      { keys: ['Pinch'], label: 'Zoom' },
    ],
  },
  {
    group: 'Edit',
    items: [
      { keys: ['V'], label: 'Select tool' },
      { keys: ['Drag'], label: 'Select an area' },
      { keys: ['Shift', 'Click'], label: 'Add to selection' },
      { keys: ['Delete'], label: 'Delete selection' },
      { keys: [MOD, 'Z'], label: 'Undo' },
      { keys: [MOD, 'Shift', 'Z'], label: 'Redo' },
      { keys: [MOD, 'Y'], label: 'Redo' },
    ],
  },
  {
    group: 'Mind map',
    items: [
      { keys: ['M'], label: 'Mind map tool (click to start a map)' },
      { keys: ['Tab'], label: 'Add child topic' },
      { keys: ['Enter'], label: 'Add sibling below' },
      { keys: ['Shift', 'Tab'], label: 'Move up a level' },
      { keys: ['←', '↑', '→', '↓'], label: 'Move between topics' },
      { keys: ['Space'], label: 'Collapse / expand branch' },
      { keys: ['F2'], label: 'Edit text (or just start typing)' },
      { keys: ['Enter'], label: 'Finish editing' },
      { keys: ['Shift', 'Enter'], label: 'New line while editing' },
      { keys: ['Esc'], label: 'Stop editing, keep selection' },
      { keys: ['Delete'], label: 'Delete topic and its branch' },
      { keys: [MOD, 'V'], label: 'Paste indented text as a branch' },
      { keys: ['Drag'], label: 'Drop a topic on another to move it' },
    ],
  },
  {
    group: 'Board',
    items: [
      { keys: [MOD, 'S'], label: 'Save now' },
      { keys: ['?'], label: 'Show keyboard shortcuts' },
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto" data-testid="board-shortcuts-dialog">
        <DialogHeader>
          <DialogTitle>{t('Keyboard shortcuts')}</DialogTitle>
          <DialogDescription>{t('Work faster on the board.')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 sm:grid-cols-2">
          {BOARD_SHORTCUTS.map((group) => (
            <section key={group.group} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t(group.group)}</h3>
              <ul className="space-y-1.5">
                {group.items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span>{t(item.label)}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key) => (
                        <kbd key={key} className="rounded-md border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground">
                          {key}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
