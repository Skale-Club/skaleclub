import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/components/ui/loader';
import { useTranslation } from '@/hooks/useTranslation';
import type { Estimate } from '@shared/schema';

type EstimateAccessCodeDialogProps = {
  estimate: Estimate | null;
  value: string;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (id: number, accessCode: string | null) => void;
  isPending: boolean;
};

export function EstimateAccessCodeDialog({
  estimate,
  value,
  onValueChange,
  onClose,
  onSubmit,
  isPending,
}: EstimateAccessCodeDialogProps) {
  const { t } = useTranslation();

  if (!estimate) return null;

  return (
    <Dialog open={!!estimate} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Password Protection')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(estimate.id, value || null);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="accessCode">{t('Access code (optional)')}</Label>
            <Input
              id="accessCode"
              type="text"
              placeholder="e.g. 20260419"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{t('Leave blank to remove password protection')}</p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">{t('Cancel')}</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
