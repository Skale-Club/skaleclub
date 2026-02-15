import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { GripVertical, HelpCircle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Faq } from '@shared/schema';
function SortableFaqItem({ faq, onEdit, onDelete }: { faq: Faq; onEdit: (faq: Faq) => void; onDelete: (id: number) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: faq.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 rounded-lg bg-muted transition-all group relative"
      data-testid={`faq-item-${faq.id}`}
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground p-1"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-base line-clamp-1">{faq.question}</h3>
          </div>
          <p className="text-muted-foreground text-xs line-clamp-2">{faq.answer}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(faq)}
            data-testid={`button-edit-faq-${faq.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-delete-faq-${faq.id}`}>
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(faq.id)}
                  variant="destructive"
                >
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

export function FaqsSection() {
  const { toast } = useToast();
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: faqs, isLoading } = useQuery<Faq[]>({
    queryKey: ['/api/faqs']
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createFaq = useMutation({
    mutationFn: async (data: { question: string; answer: string; order: number }) => {
      return apiRequest('POST', '/api/faqs', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs'] });
      toast({ title: 'FAQ created successfully' });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create FAQ', description: error.message, variant: 'destructive' });
    }
  });

  const updateFaq = useMutation({
    mutationFn: async (data: { id: number; question: string; answer: string; order: number }) => {
      return apiRequest('PUT', `/api/faqs/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs'] });
      toast({ title: 'FAQ updated successfully' });
      setEditingFaq(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update FAQ', description: error.message, variant: 'destructive' });
    }
  });

  const deleteFaq = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/faqs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs'] });
      toast({ title: 'FAQ deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete FAQ', description: error.message, variant: 'destructive' });
    }
  });

  const reorderFaqs = useMutation({
    mutationFn: async (newOrder: { id: number; order: number }[]) => {
      return Promise.all(
        newOrder.map(item => apiRequest('PUT', `/api/faqs/${item.id}`, { order: item.order }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs'] });
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && faqs) {
      const oldIndex = faqs.findIndex((f) => f.id === active.id);
      const newIndex = faqs.findIndex((f) => f.id === over.id);

      const newFaqs = arrayMove(faqs, oldIndex, newIndex);
      const updates = newFaqs.map((faq, index) => ({
        id: faq.id,
        order: index
      }));

      reorderFaqs.mutate(updates);
    }
  };

  if (isLoading && !faqs) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">FAQs</h1>
          <p className="text-muted-foreground">Manage frequently asked questions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingFaq(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-faq">
              <Plus className="w-4 h-4 mr-2" />
              Add FAQ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <FaqForm 
              faq={editingFaq}
              onSubmit={(data) => {
                if (editingFaq) {
                  updateFaq.mutate({ ...data, id: editingFaq.id });
                } else {
                  createFaq.mutate(data);
                }
              }}
              isLoading={createFaq.isPending || updateFaq.isPending}
              nextOrder={faqs?.length || 0}
            />
          </DialogContent>
        </Dialog>
      </div>

      {faqs?.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-lg">
          <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No FAQs yet</h3>
          <p className="text-muted-foreground mb-4">Create FAQs to help your customers find answers quickly</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={faqs?.map(f => f.id) || []}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-2">
              {faqs?.map((faq) => (
                <SortableFaqItem
                  key={faq.id}
                  faq={faq}
                  onEdit={(f) => { setEditingFaq(f); setIsDialogOpen(true); }}
                  onDelete={(id) => deleteFaq.mutate(id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function FaqForm({ faq, onSubmit, isLoading, nextOrder }: { 
  faq: Faq | null; 
  onSubmit: (data: { question: string; answer: string; order: number }) => void;
  isLoading: boolean;
  nextOrder: number;
}) {
  const [question, setQuestion] = useState(faq?.question || '');
  const [answer, setAnswer] = useState(faq?.answer || '');
  const [order, setOrder] = useState(faq?.order ?? nextOrder);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ question, answer, order });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{faq ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="faq-question">Question</Label>
          <Input 
            id="faq-question" 
            value={question} 
            onChange={(e) => setQuestion(e.target.value)} 
            required 
            placeholder="e.g., How do I book a service?"
            data-testid="input-faq-question" 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="faq-answer">Answer</Label>
          <Textarea 
            id="faq-answer" 
            value={answer} 
            onChange={(e) => setAnswer(e.target.value)} 
            required
            placeholder="Provide a helpful answer..."
            rows={4}
            data-testid="input-faq-answer" 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="faq-order">Display Order</Label>
          <Input 
            id="faq-order" 
            type="number"
            value={order} 
            onChange={(e) => setOrder(Number(e.target.value))} 
            min={0}
            data-testid="input-faq-order" 
          />
          <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading} data-testid="button-save-faq">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {faq ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

