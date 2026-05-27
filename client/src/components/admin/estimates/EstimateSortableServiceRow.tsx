import { GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EstimateServiceItem } from '@shared/schema';

export function EstimateSortableServiceRow({
  id,
  item,
  onChange,
  onRemove,
  knownSections = [],
}: {
  id: number;
  item: EstimateServiceItem;
  onChange: (updated: EstimateServiceItem) => void;
  onRemove: () => void;
  knownSections?: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id,
      transition: { duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 p-3 border rounded-lg bg-card">
      <button
        {...attributes}
        {...listeners}
        className="p-1 cursor-grab hover:bg-muted rounded touch-none mt-1 min-h-[44px] flex items-center"
        type="button"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      <Badge
        variant={item.type === 'catalog' ? 'secondary' : 'outline'}
        className="mt-2 shrink-0 capitalize"
      >
        {item.type}
      </Badge>
      <div className="flex-1 flex flex-col gap-2">
        <Input
          placeholder="Section (optional — e.g. Must Have)"
          value={item.section ?? ''}
          onChange={(e) => onChange({ ...item, section: e.target.value || undefined })}
          list={`section-suggestions-${id}`}
          maxLength={50}
          className="text-xs"
        />
        {knownSections.length > 0 && (
          <datalist id={`section-suggestions-${id}`}>
            {knownSections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        <Input
          placeholder="Service title"
          value={item.title}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
        />
        <Textarea
          placeholder="Brief description"
          rows={2}
          value={item.description}
          onChange={(e) => onChange({ ...item, description: e.target.value })}
        />
        <Input
          placeholder="0.00"
          value={item.price}
          onChange={(e) => onChange({ ...item, price: e.target.value })}
          className="text-right"
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="text-destructive mt-1"
        aria-label="Remove service row"
        onClick={onRemove}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
