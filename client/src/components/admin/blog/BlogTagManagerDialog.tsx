import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type BlogTagManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTags: string[];
  editingTag: string | null;
  editingTagValue: string;
  isDeletingTag: boolean;
  isRenamingTag: boolean;
  onEditingTagValueChange: (v: string) => void;
  onStartEdit: (tag: string) => void;
  onSubmitEdit: () => void;
  onCancelEdit: () => void;
  onRequestDelete: (tag: string) => void;
};

export function BlogTagManagerDialog({
  open,
  onOpenChange,
  availableTags,
  editingTag,
  editingTagValue,
  isDeletingTag,
  isRenamingTag,
  onEditingTagValueChange,
  onStartEdit,
  onSubmitEdit,
  onCancelEdit,
  onRequestDelete,
}: BlogTagManagerDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-0">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {availableTags.length > 0 ? (
            availableTags.map((tag) => (
              <div
                key={tag}
                className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2"
                onDoubleClick={() => onStartEdit(tag)}
              >
                {editingTag === tag ? (
                  <Input
                    value={editingTagValue}
                    onChange={(e) => onEditingTagValueChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onSubmitEdit();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        onCancelEdit();
                      }
                    }}
                    onBlur={onSubmitEdit}
                    autoFocus
                    className="h-8 border-0 bg-transparent px-0 text-sm"
                    data-testid={`input-tag-edit-${tag}`}
                  />
                ) : (
                  <span className="text-sm font-medium">{tag}</span>
                )}
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onStartEdit(tag)}
                    disabled={isDeletingTag || isRenamingTag}
                    data-testid={`button-tag-edit-${tag}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRequestDelete(tag)}
                    disabled={isDeletingTag || editingTag === tag || isRenamingTag}
                    data-testid={`button-tag-delete-${tag}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No tags available.</p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
