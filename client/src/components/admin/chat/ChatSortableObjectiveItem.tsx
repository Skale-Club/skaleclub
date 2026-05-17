import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Switch } from '@/components/ui/switch';
import type { IntakeObjective } from '../shared/types';

export function ChatSortableObjectiveItem({ objective, onToggle }: { objective: IntakeObjective; onToggle: (enabled: boolean) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: objective.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-2 bg-card border rounded-md mb-2">
      <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{objective.label}</p>
        <p className="text-xs text-muted-foreground truncate">{objective.description}</p>
      </div>
      <Switch
        checked={objective.enabled}
        onCheckedChange={onToggle}
      />
    </div>
  );
}

// Legacy `ObjectiveRow` component preserved (was unused in parent prior to split — kept here to avoid
// silent behavior changes if any future code imports it). Internal helper, not exported.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ObjectiveRow({ objective, onToggle }: { objective: IntakeObjective; onToggle: (id: IntakeObjective['id'], enabled: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: objective.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <button
        type="button"
        className="h-8 w-8 inline-flex items-center justify-center rounded-md border hover:bg-muted text-muted-foreground"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">
        <p className="text-sm font-medium dark:text-slate-200">{objective.label}</p>
        <p className="text-xs text-muted-foreground">{objective.description}</p>
      </div>
      <Switch checked={objective.enabled} onCheckedChange={(checked) => onToggle(objective.id, checked)} />
    </div>
  );
}
