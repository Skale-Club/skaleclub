import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { isReservedSlug } from '@shared/reservedSlugs';
import type { LandingPage } from '@shared/schema';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

interface CreateLandingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

export function CreateLandingDialog({ open, onOpenChange, onCreated }: CreateLandingDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [language, setLanguage] = useState<'en' | 'pt'>('pt');
  const [alternateSlug, setAlternateSlug] = useState('');

  const reset = () => {
    setName('');
    setSlug('');
    setSlugEdited(false);
    setLanguage('pt');
    setAlternateSlug('');
  };

  const effectiveSlug = (slugEdited ? slug : slugify(name)).trim();

  // Client-side slug validation — mirrors the server guard.
  let slugError: string | null = null;
  if (effectiveSlug.length > 0) {
    if (!SLUG_PATTERN.test(effectiveSlug)) {
      slugError = 'Slug must be lowercase letters, digits, and single hyphens between segments.';
    } else if (isReservedSlug(effectiveSlug)) {
      slugError = `"${effectiveSlug}" is a reserved slug — pick a different one.`;
    }
  }

  const createMutation = useMutation({
    mutationFn: async (): Promise<LandingPage> => {
      const res = await apiRequest('POST', '/api/landing-pages', {
        slug: effectiveSlug,
        name: name.trim(),
        sections: [],
        language,
        alternateSlug: alternateSlug.trim() || null,
      });
      return res.json();
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['/api/landing-pages'] });
      toast({ title: 'Landing created', description: `"${created.name}" is ready to edit.` });
      reset();
      onCreated(created.id);
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create landing', description: err.message, variant: 'destructive' });
    },
  });

  const canSubmit =
    name.trim().length > 0 &&
    effectiveSlug.length > 0 &&
    !slugError &&
    !createMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New landing</DialogTitle>
            <DialogDescription>
              Pick a URL slug and a name. You will add sections in the editor next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-landing-name">Name</Label>
              <Input
                id="create-landing-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Websites"
                maxLength={200}
                required
                data-testid="input-create-landing-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-landing-slug">Slug</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/</span>
                <Input
                  id="create-landing-slug"
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlug(slugify(e.target.value));
                    setSlugEdited(true);
                  }}
                  placeholder="websites"
                  maxLength={80}
                  className="pl-7"
                  required
                  data-testid="input-create-landing-slug"
                />
              </div>
              {slugError ? (
                <p className="text-xs text-destructive" data-testid="error-create-landing-slug">
                  {slugError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, digits, and hyphens only. Becomes the public URL.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-landing-language">Language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v === 'en' ? 'en' : 'pt')}>
                <SelectTrigger id="create-landing-language" data-testid="select-create-landing-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="pt">Português (pt-BR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-landing-alternate-slug">Alternate slug (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/</span>
                <Input
                  id="create-landing-alternate-slug"
                  value={alternateSlug}
                  onChange={(e) => setAlternateSlug(e.target.value.toLowerCase())}
                  placeholder="websites-br"
                  maxLength={80}
                  className="pl-7"
                  data-testid="input-create-landing-alternate-slug"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Slug of this page in the other language (powers hreflang).
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={!canSubmit}
              data-testid="button-create-landing-submit"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
