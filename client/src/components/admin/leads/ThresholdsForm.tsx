import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
            <Label className="w-32 text-green-600">QUENTE (?)</Label>
            <Input type="number" value={hot} onChange={(e) => setHot(Number(e.target.value))} min={0} className="w-24" />
            <span className="text-sm text-muted-foreground">pontos</span>
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-32 text-amber-600">MORNO (?)</Label>
            <Input type="number" value={warm} onChange={(e) => setWarm(Number(e.target.value))} min={0} className="w-24" />
            <span className="text-sm text-muted-foreground">pontos</span>
          </div>
          <div className="flex items-center gap-4">
            <Label className="w-32 text-blue-600">FRIO (?)</Label>
            <Input type="number" value={cold} onChange={(e) => setCold(Number(e.target.value))} min={0} className="w-24" />
            <span className="text-sm text-muted-foreground">pontos</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leads com score abaixo de {cold} são classificados como DESQUALIFICADO.
        </p>
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
