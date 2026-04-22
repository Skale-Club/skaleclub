import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Copy,
  ExternalLink,
  Eye,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react';
import {
  DndContext, closestCenter, type DragEndEvent,
  MouseSensor, TouchSensor, useSensor, useSensors
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogClose, DialogContent,
  DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import { AdminCard, EmptyState, SectionHeader } from './shared';
import { PageThumbnail } from '@/components/ui/PageThumbnail';
import type { Estimate, EstimateWithStats, EstimateServiceItem, CatalogServiceItem } from '@shared/schema';
import type { PortfolioService } from '@shared/schema';

// ──────────────────────────────────────────────────────────
// SortableServiceRow sub-component
// ──────────────────────────────────────────────────────────

function SortableServiceRow({
  id,
  item,
  onChange,
  onRemove,
}: {
  id: number;
  item: EstimateServiceItem;
  onChange: (updated: EstimateServiceItem) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id,
      transition: { duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 p-3 border rounded-lg bg-card">
      <button
        {...attributes}
        {...listeners}
        className="p-1 cursor-grab hover:bg-muted rounded touch-none mt-1 min-h-[44px] flex items-center"
        type="button"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      <Badge
        variant={item.type === 'catalog' ? 'secondary' : 'outline'}
        className="mt-2 shrink-0 capitalize"
      >
        {item.type}
      </Badge>
      <div className="flex-1 flex flex-col gap-2">
        <Input
          placeholder="Service title"
          value={item.title}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
        />
        <Textarea
          placeholder="Brief description"
          rows={2}
          value={item.description}
          onChange={(e) => onChange({ ...item, description: e.target.value })}
        />
        <Input
          placeholder="0.00"
          value={item.price}
          onChange={(e) => onChange({ ...item, price: e.target.value })}
          className="text-right"
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="text-destructive mt-1"
        aria-label="Remove service row"
        onClick={onRemove}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// EstimateDialogForm sub-component
// ──────────────────────────────────────────────────────────

function EstimateDialogForm({
  editingEstimate,
  onSave,
  isPending,
}: {
  editingEstimate: Estimate | null;
  onSave: (companyName: string, contactName: string, note: string | null, services: EstimateServiceItem[], accessCode: string | null) => void;
  isPending: boolean;
}) {
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
        <DialogTitle>{editingEstimate ? 'Edit Estimate' : 'New Estimate'}</DialogTitle>
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
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                placeholder="Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactName">Contact name</Label>
              <Input
                id="contactName"
                placeholder="John Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
          </div>
          {!atLeastOne && (
            <p className="text-xs text-destructive">At least one of company or contact name is required.</p>
          )}
        <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              placeholder="Any context about this proposal..."
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accessCode">Access code (optional)</Label>
            <Input
              id="accessCode"
              type="text"
              placeholder="e.g. 20260419"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Leave blank to disable gate</p>
          </div>
        </div>

        <hr className="border-t" />

        {/* Services section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Services</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCatalogPicker((v) => !v)}
              >
                Add from catalog
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCustomRow}
              >
                Add custom row
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
                  <SortableServiceRow
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
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {editingEstimate ? 'Save Changes' : 'Create Estimate'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// EstimatesSection — main export
// ──────────────────────────────────────────────────────────

export function EstimatesSection() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Estimate | null>(null);

  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const { data: queryData, isLoading } = useQuery<{ data: EstimateWithStats[], total: number }>({
    queryKey: ['/api/estimates', page],
    queryFn: () => fetch(`/api/estimates?limit=${ITEMS_PER_PAGE}&offset=${offset}`).then(r => r.json()),
  });

  const estimates = queryData?.data ?? [];
  const totalItems = queryData?.total ?? 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const createMutation = useMutation({
    mutationFn: async (data: { clientName: string; companyName: string; contactName: string; note: string | null; services: EstimateServiceItem[]; accessCode: string | null }) => {
      const res = await apiRequest('POST', '/api/estimates', data);
      return res.json() as Promise<Estimate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      setIsDialogOpen(false);
      toast({ title: 'Estimate created' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create estimate', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; clientName: string; companyName: string; contactName: string; note: string | null; services: EstimateServiceItem[]; accessCode: string | null }) => {
      const res = await apiRequest('PUT', `/api/estimates/${data.id}`, {
        clientName: data.clientName,
        companyName: data.companyName,
        contactName: data.contactName,
        note: data.note,
        services: data.services,
        accessCode: data.accessCode,
      });
      return res.json() as Promise<Estimate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      setIsDialogOpen(false);
      toast({ title: 'Estimate updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to update estimate', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/estimates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      toast({ title: 'Estimate deleted' });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to delete estimate', description: err.message, variant: 'destructive' });
    },
  });

  const handleCopyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/e/${slug}`);
      toast({ title: 'Link copied', description: 'Share this link with your client.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy the URL manually.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Estimates"
        description="Create and manage client proposals — each generates a shareable link"
        icon={<Receipt className="w-5 h-5" />}
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditingEstimate(null);
              setIsDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Estimate
          </Button>
        }
      />

      <AdminCard>
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : estimates.length === 0 ? (
          <EmptyState
            icon={<Receipt />}
            title="No estimates yet"
            description="Create your first estimate to generate a shareable proposal link."
          />
        ) : (
          <div className="space-y-3">
            {estimates.map((est) => (
              <div
                key={est.id}
                className="flex items-center gap-3 border rounded-lg p-4 bg-card"
              >
                <PageThumbnail url={`/e/${est.slug}?preview=1`} />
                <span className="font-semibold text-sm flex-1 truncate min-w-0">
                  {est.companyName?.trim() || est.contactName?.trim() || est.clientName}
                </span>
                <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                  <Layers className="w-3 h-3" />
                  {est.services.length}
                </Badge>
                <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                  <Eye className="w-3 h-3" />
                  {est.viewCount ?? 0}
                </Badge>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open estimate"
                    title="Open estimate"
                    onClick={() => window.open(`/e/${est.slug}`, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Copy estimate link"
                    title="Copy estimate link"
                    onClick={() => handleCopyLink(est.slug)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit estimate"
                    title="Edit estimate"
                    onClick={() => {
                      setEditingEstimate(est);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete estimate"
                    title="Delete estimate"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(est)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {totalPages > 1 && (
              <div className="pt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={page === p}
                          onClick={() => setPage(p)}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
      </AdminCard>

      {/* Delete confirmation AlertDialog */}
      {deleteTarget && (
        <AlertDialog open={true} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete estimate?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the estimate for {deleteTarget.clientName}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <EstimateDialogForm
            key={editingEstimate?.id ?? 'new'}
            editingEstimate={editingEstimate}
            onSave={(companyName, contactName, note, services, accessCode) => {
              const clientName = companyName || contactName;
              const servicesWithOrder = services.map((s, i) => ({ ...s, order: i }));
              if (editingEstimate) {
                updateMutation.mutate({ id: editingEstimate.id, clientName, companyName, contactName, note, services: servicesWithOrder, accessCode });
              } else {
                createMutation.mutate({ clientName, companyName, contactName, note, services: servicesWithOrder, accessCode });
              }
            }}
            isPending={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

