import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/components/ui/loader';
import type { FormConfig } from '@shared/schema';

export function ThresholdsForm({
  thresholds,
  onSave,
  isLoading
}: {
  thresholds: FormConfig['thresholds'];
  onSave: (t: FormConfig['thresholds']) => void;
  isLoading: boolean;
}) {
  const [hot, setHot] = useState(thresholds.hot);
  const [warm, setWarm] = useState(thresholds.warm);
  const [cold, setCold] = useState(thresholds.cold);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ hot, warm, cold });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Rating Thresholds</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">
          Set minimum points for each lead rating.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Label className="w-32 text-green-600">HOT (&ge;)</Label>
            <Input type="number" value={hot} onChange={(e) => setHot(Number(e.target.value))} min={0} className="w-24" />
            <span className="text-sm text-muted-foreground">points</span>
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-32 text-amber-600">WARM (&ge;)</Label>
            <Input type="number" value={warm} onChange={(e) => setWarm(Number(e.target.value))} min={0} className="w-24" />
            <span className="text-sm text-muted-foreground">points</span>
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-32 text-blue-600">COLD (&ge;)</Label>
            <Input type="number" value={cold} onChange={(e) => setCold(Number(e.target.value))} min={0} className="w-24" />
            <span className="text-sm text-muted-foreground">points</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leads scoring below {cold} are classified as DISQUALIFIED.
        </p>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="p-3 rounded-xl border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <p className="text-xs text-green-600 dark:text-green-400 font-semibold">HOT</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">&ge; {hot} pts</p>
          </div>
          <div className="p-3 rounded-xl border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">WARM</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">&ge; {warm} pts</p>
          </div>
          <div className="p-3 rounded-xl border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">COLD</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">&ge; {cold} pts</p>
          </div>
          <div className="p-3 rounded-xl border bg-muted">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">DISQUALIFIED</p>
            <p className="text-lg font-bold text-slate-600 dark:text-slate-300">&lt; {cold} pts</p>
          </div>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

