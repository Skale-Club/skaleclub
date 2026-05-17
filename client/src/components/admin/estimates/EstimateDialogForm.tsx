import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DndContext, closestCenter, type DragEndEvent,
  MouseSensor, TouchSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DialogClose, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';
import { useTranslation } from '@/hooks/useTranslation';
import { EstimateSortableServiceRow } from './EstimateSortableServiceRow';
import type { CatalogServiceItem, Estimate, EstimateServiceItem, PortfolioService } from '@shared/schema';

export function EstimateDialogForm({
  editingEstimate,
  onSave,
  isPending,
}: {
  editingEstimate: Estimate | null;
  onSave: (companyName: string, contactName: string, note: string | null, services: EstimateServiceItem[], accessCode: string | null) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState(editingEstimate?.companyName ?? '');
  const [contactName, setContactName] = useState(editingEstimate?.contactName ?? '');
  const [note, setNote] = useState(editingEstimate?.note ?? '');
  const [accessCode, setAccessCode] = useState(editingEstimate?.accessCode ?? '');
  const atLeastOne = !!(companyName.trim() || contactName.trim());
  const [services, setServices] = useState<EstimateServiceItem[]>(
    editingEstimate?.services ?? []
  );
  // showCatalogPicker: create mode = true (show checklist by default); edit mode = false (hide until "Add from catalog")
  const [showCatalogPicker, setShowCatalogPicker] = useState(!editingEstimate);

  const { data: catalogServices = [] } = useQuery<PortfolioService[]>({
    queryKey: ['/api/portfolio-services'],
  });

  // Derived from current services list — which catalog source IDs are already added
  const checkedSourceIds = new Set(
    services
      .filter((s): s is CatalogServiceItem => s.type === 'catalog')
      .map((s) => s.sourceId)
  );

  const handleCatalogToggle = (catalogService: PortfolioService, checked: boolean) => {
    if (checked) {
      setServices((prev) => [
        ...prev,
        {
          type: 'catalog' as const,
          sourceId: catalogService.id,
          title: catalogService.title,
          description: catalogService.description ?? '',
          price: catalogService.price ?? '',
          features: catalogService.features ?? [],
          order: prev.length,
        },
      ]);
    } else {
      setServices((prev) =>
        prev.filter((s) => !(s.type === 'catalog' && s.sourceId === catalogService.id))
      );
    }
  };

  const handleAddCustomRow = () => {
    setServices((prev) => [
      ...prev,
      {
        type: 'custom' as const,
        title: '',
        description: '',
        price: '',
        features: [],
        order: prev.length,
      },
    ]);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    setServices((prev) => arrayMove(prev, oldIndex, newIndex));
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editingEstimate ? t('Edit Estimate') : t('New Estimate')}</DialogTitle>
      </DialogHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!atLeastOne) return;
          onSave(companyName.trim(), contactName.trim(), note || null, services, accessCode || null);
        }}
        className="flex flex-col gap-5 mt-2"
      >
        {/* Client info section */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companyName">{t('Company name')}</Label>
              <Input
                id="companyName"
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactName">{t('Contact name')}</Label>
              <Input
                id="contactName"
                placeholder="John Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
          </div>
          {!atLeastOne && (
            <p className="text-xs text-destructive">{t('At least one of company or contact name is required.')}</p>
          )}
        <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">{t('Note (optional)')}</Label>
            <Textarea
              id="note"
              placeholder="Any context about this proposal..."
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accessCode">{t('Access code (optional)')}</Label>
            <Input
              id="accessCode"
              type="text"
              placeholder="e.g. 20260419"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('Leave blank to disable gate')}</p>
          </div>
        </div>

        <hr className="border-t" />

        {/* Services section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">{t('Services')}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCatalogPicker((v) => !v)}
              >
                {t('Add from catalog')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomRow}
              >
                {t('Add custom row')}
              </Button>
            </div>
          </div>

          {showCatalogPicker && (
            <div className="max-h-48 overflow-y-auto border rounded-md p-3 flex flex-col gap-2">
              {catalogServices.map((svc) => (
                <label key={svc.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={checkedSourceIds.has(svc.id)}
                    onCheckedChange={(checked) => handleCatalogToggle(svc, !!checked)}
                  />
                  <span className="text-sm flex-1">{svc.title}</span>
                  {svc.price && (
                    <Badge variant="outline" className="text-xs">{svc.price}</Badge>
                  )}
                </label>
              ))}
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={services.map((_, i) => i)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {services.map((item, i) => (
                  <EstimateSortableServiceRow
                    key={i}
                    id={i}
                    item={item}
                    onChange={(updated) =>
                      setServices((prev) => prev.map((s, idx) => (idx === i ? updated : s)))
                    }
                    onRemove={() =>
                      setServices((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{t('Cancel')}</Button>
          </DialogClose>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {editingEstimate ? t('Save Changes') : t('Create Estimate')}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
