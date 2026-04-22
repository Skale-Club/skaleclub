import { useState, useEffect, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import type { Form } from '@shared/schema';

interface NewFormDialogProps {
  onCreated?: (form: Form) => void;
}

// Slugify helper: lowercase, remove non-alphanumeric, collapse spaces to hyphens
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function NewFormDialog({ onCreated }: NewFormDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');

  // Auto-suggest slug from name unless the admin has typed one explicitly
  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name));
  }, [name, slugEdited]);

  const reset = () => {
    setName('');
    setSlug('');
    setSlugEdited(false);
    setDescription('');
  };

  const createMutation = useMutation({
    mutationFn: async (): Promise<Form> => {
      const res = await apiRequest('POST', '/api/forms', {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        // Empty starter form — admin fills questions in the editor
        config: {
          questions: [],
          maxScore: 0,
          thresholds: { hot: 70, warm: 50, cold: 30 },
        },
      });
      return res.json();
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['/api/forms'] });
      toast({ title: 'Form created', description: `"${created.name}" is ready to edit.` });
      setOpen(false);
      reset();
      onCreated?.(created);
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create form', description: err.message, variant: 'destructive' });
    },
  });

  const canSubmit = name.trim().length > 0 && slug.trim().length > 0 && !createMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Form
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Form</DialogTitle>
            <DialogDescription>Name the form and pick a URL slug. You&apos;ll add questions in the next step.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="form-name">Name</Label>
              <Input
                id="form-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Contact Us"
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-slug">Slug</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/f/</span>
                <Input
                  id="form-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(slugify(e.target.value));
                    setSlugEdited(true);
                  }}
                  placeholder="contact-us"
                  maxLength={80}
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Lowercase letters, digits, and hyphens only. This becomes the public URL.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-description">Description (optional)</Label>
              <Textarea
                id="form-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this form for?"
                rows={2}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

