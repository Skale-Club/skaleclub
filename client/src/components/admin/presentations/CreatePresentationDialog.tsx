import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/components/ui/loader';
import { useTranslation } from '@/hooks/useTranslation';
import { normalizePresentationSlug } from './presentationSlug';

export type CreatePresentationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onCreate: (data: { title: string; slug: string }) => void;
};

export function CreatePresentationDialog({
  open,
  onOpenChange,
  isPending,
  onCreate,
}: CreatePresentationDialogProps) {
  const { t } = useTranslation();
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newSlugEdited, setNewSlugEdited] = useState(false);

  useEffect(() => {
    if (!newSlugEdited) {
      setNewSlug(normalizePresentationSlug(newTitle));
    }
  }, [newTitle, newSlugEdited]);

  function handleOpenChange(o: boolean) {
    onOpenChange(o);
    if (!o) {
      setNewTitle('');
      setNewSlug('');
      setNewSlugEdited(false);
    }
  }

  function submit() {
    onCreate({ title: newTitle.trim(), slug: newSlug.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm border-0">
        <DialogHeader>
          <DialogTitle>{t('New Presentation')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-title" className="text-xs">{t('Title')}</Label>
            <Input
              id="new-title"
              autoFocus
              placeholder="e.g. Acme Corp Q2 2025"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim() && newSlug.trim() && !isPending) {
                  submit();
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-slug" className="text-xs">{t('Slug')}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/p/</span>
              <Input
                id="new-slug"
                placeholder="acme-corp-q2-2025"
                value={newSlug}
                onChange={(e) => {
                  setNewSlug(normalizePresentationSlug(e.target.value));
                  setNewSlugEdited(true);
                }}
                className="pl-9"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTitle.trim() && newSlug.trim() && !isPending) {
                    submit();
                  }
                }}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>{t('Cancel')}</Button>
          <Button
            onClick={submit}
            disabled={!newTitle.trim() || !newSlug.trim() || isPending}
            className="gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
