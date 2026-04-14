import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FormQuestion } from '@shared/schema';

export function SortableQuestionItem({
  question,
  onEdit,
  onDelete,
  typeBadge,
  maxPoints
}: {
  question: FormQuestion;
  onEdit: (q: FormQuestion) => void;
  onDelete: (id: string) => void;
  typeBadge: string;
  maxPoints: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-1 text-muted-foreground hover:text-foreground">
          <GripVertical className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{question.order}</span>
            <Badge variant="outline" className="text-xs">{typeBadge}</Badge>
            {maxPoints > 0 && (
              <Badge variant="secondary" className="text-xs">{maxPoints} pts max</Badge>
            )}
            {question.required && (
              <Badge variant="default" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Obrigatória</Badge>
            )}
          </div>
          <h3 className="font-semibold text-foreground truncate">{question.title}</h3>
          {question.type === 'select' && question.options && (
            <p className="text-xs text-muted-foreground mt-1">
              {question.options.length} opções: {question.options.slice(0, 3).map(o => o.label).join(', ')}{question.options.length > 3 ? '...' : ''}
            </p>
          )}
          {question.placeholder && question.type !== 'select' && (
            <p className="text-xs text-muted-foreground mt-1">Placeholder: {question.placeholder}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(question)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete question?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The question will be removed from the form.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(question.id)} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
