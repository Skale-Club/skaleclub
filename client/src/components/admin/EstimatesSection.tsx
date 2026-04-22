import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Copy,
  ExternalLink,
  Eye,
  GripVertical,
  Layers,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Search,
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
import { useDebounce } from '@/hooks/useDebounce';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import { AdminCard, EmptyState, SectionHeader } from './shared';
import { PageThumbnail } from '@/components/ui/PageThumbnail';
import {
  createEstimateThumbnailDataUrl,
  getEstimateThumbnailSignature,
} from '@/lib/thumbnails';
import type { Estimate, EstimateWithStats, EstimateServiceItem, CatalogServiceItem } from '@shared/schema';
import type { PortfolioService } from '@shared/schema';

function normalizeEstimateSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [editingAccessCodeEstimate, setEditingAccessCodeEstimate] = useState<Estimate | null>(null);
  const [accessCodeValue, setAccessCodeValue] = useState('');
  const [editingSlugId, setEditingSlugId] = useState<number | null>(null);
  const [slugValue, setSlugValue] = useState('');
  const skipSlugBlurRef = useRef(false);
  const thumbnailJobsRef = useRef(new Set<string>());

  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const { data: queryData, isLoading } = useQuery<{ data: EstimateWithStats[], total: number }>({
    queryKey: ['/api/estimates', page, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('limit', ITEMS_PER_PAGE.toString());
      params.append('offset', offset.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);
      return fetch(`/api/estimates?${params.toString()}`).then(r => r.json());
    },
  });

  const estimates = queryData?.data ?? [];
  const totalItems = queryData?.total ?? 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  useEffect(() => {
    estimates.forEach((estimate) => {
      const thumbnailSignature = getEstimateThumbnailSignature(estimate);
      if (estimate.thumbnailUrl && estimate.thumbnailSignature === thumbnailSignature) return;

      const jobKey = `${estimate.id}:${thumbnailSignature}`;
      if (thumbnailJobsRef.current.has(jobKey)) return;
      thumbnailJobsRef.current.add(jobKey);

      void (async () => {
        try {
          const thumbnailUrl = await createEstimateThumbnailDataUrl(estimate);
          await apiRequest('PUT', `/api/estimates/${estimate.id}/thumbnail`, {
            thumbnailUrl,
            thumbnailSignature,
          });
          const applyThumbnail = (current: { data: EstimateWithStats[]; total: number } | undefined) =>
            current
              ? {
                  ...current,
                  data: current.data.map((row) =>
                    row.id === estimate.id
                      ? { ...row, thumbnailUrl, thumbnailSignature }
                      : row,
                  ),
                }
              : current;

          queryClient.setQueryData<{ data: EstimateWithStats[]; total: number }>(
            ['/api/estimates', page, debouncedSearch],
            applyThumbnail,
          );
          queryClient.setQueriesData<{ data: EstimateWithStats[]; total: number }>(
            { queryKey: ['/api/estimates'] },
            applyThumbnail,
          );
        } catch (err) {
          console.warn('Failed to cache estimate thumbnail', err);
        } finally {
          thumbnailJobsRef.current.delete(jobKey);
        }
      })();
    });
  }, [debouncedSearch, estimates, page]);

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

  const updateAccessCodeMutation = useMutation({
    mutationFn: async (data: { id: number; accessCode: string | null }) => {
      const res = await apiRequest('PUT', `/api/estimates/${data.id}`, { accessCode: data.accessCode });
      return res.json() as Promise<Estimate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      setEditingAccessCodeEstimate(null);
      setAccessCodeValue('');
      toast({ title: 'Access code updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to update access code', description: err.message, variant: 'destructive' });
    },
  });

  const updateSlugMutation = useMutation({
    mutationFn: async (data: { id: number; slug: string }) => {
      const res = await apiRequest('PUT', `/api/estimates/${data.id}`, { slug: data.slug });
      const updated = (await res.json()) as Estimate;
      if (updated.slug !== data.slug) {
        throw new Error(`Server did not save the slug. Returned: ${updated.slug}`);
      }
      return updated;
    },
    onSuccess: (updatedEstimate, variables) => {
      const savedSlug = updatedEstimate.slug || variables.slug;
      const updateEstimateSlug = (current: { data: EstimateWithStats[]; total: number } | undefined) =>
        current
          ? {
              ...current,
              data: current.data.map((estimate) =>
                estimate.id === variables.id
                  ? { ...estimate, slug: savedSlug }
                  : estimate,
              ),
            }
          : current;

      queryClient.setQueryData<{ data: EstimateWithStats[]; total: number }>(
        ['/api/estimates', page, debouncedSearch],
        updateEstimateSlug,
      );
      queryClient.setQueriesData<{ data: EstimateWithStats[]; total: number }>(
        { queryKey: ['/api/estimates'] },
        updateEstimateSlug,
      );
      setEditingSlugId(null);
      setSlugValue('');
      toast({ title: 'Slug updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to update slug', description: err.message, variant: 'destructive' });
    },
  });

  const startSlugEdit = (estimate: Estimate) => {
    skipSlugBlurRef.current = false;
    setEditingSlugId(estimate.id);
    setSlugValue(estimate.slug);
  };

  const commitSlug = (estimate: Estimate, value = slugValue) => {
    if (skipSlugBlurRef.current) {
      skipSlugBlurRef.current = false;
      return;
    }

    const slug = normalizeEstimateSlug(value);

    if (!slug) {
      setSlugValue(estimate.slug);
      return;
    }

    if (slug !== estimate.slug) {
      setSlugValue(slug);
      updateSlugMutation.mutate({ id: estimate.id, slug });
      return;
    }

    setEditingSlugId(null);
    setSlugValue('');
  };

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
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64 group">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Search estimates..."
                className="pl-9 pr-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingEstimate(null);
                setIsDialogOpen(true);
              }}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              New Estimate
            </Button>
          </div>
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
                <PageThumbnail
                  thumbnailUrl={est.thumbnailUrl}
                  title={`${est.companyName?.trim() || est.contactName?.trim() || est.clientName} thumbnail`}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="block font-semibold text-sm truncate">
                    {est.companyName?.trim() || est.contactName?.trim() || est.clientName}
                  </span>
                  {editingSlugId === est.id ? (
                    <div className="flex h-6 max-w-xs items-center overflow-hidden rounded border bg-background focus-within:ring-1 focus-within:ring-ring">
                      <span className="shrink-0 border-r bg-muted/50 px-2 text-[10px] font-mono leading-5 text-muted-foreground">
                        /e/
                      </span>
                      <Input
                        autoFocus
                        value={slugValue}
                        onChange={(e) => setSlugValue(e.target.value)}
                        onBlur={(e) => commitSlug(est, e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') {
                            skipSlugBlurRef.current = true;
                            setEditingSlugId(null);
                            setSlugValue('');
                          }
                        }}
                        disabled={updateSlugMutation.isPending}
                        aria-label="Estimate slug"
                        className="h-5 min-w-0 border-0 bg-transparent px-2 text-[9px] font-mono leading-5 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startSlugEdit(est)}
                      className="inline-flex max-w-full items-center rounded border px-2 py-0.5 text-[10px] font-mono leading-4 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      title="Edit slug"
                    >
                      <span className="truncate">/e/{est.slug}</span>
                    </button>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                  <Layers className="w-3 h-3" />
                  {est.services.length}
                </Badge>
                <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                  <Eye className="w-3 h-3" />
                  {est.viewCount ?? 0}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={est.accessCode ? 'Edit access code' : 'Add access code'}
                  title={est.accessCode ? 'Protected with password — click to edit' : 'Click to add password protection'}
                  onClick={() => {
                    setEditingAccessCodeEstimate(est);
                    setAccessCodeValue(est.accessCode ?? '');
                  }}
                  className={est.accessCode ? 'text-yellow-600 hover:text-yellow-700' : 'text-muted-foreground hover:text-foreground'}
                >
                  {est.accessCode ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                </Button>
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

      {/* Access Code dialog */}
      {editingAccessCodeEstimate && (
        <Dialog open={!!editingAccessCodeEstimate} onOpenChange={(o) => !o && setEditingAccessCodeEstimate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Password Protection</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateAccessCodeMutation.mutate({
                  id: editingAccessCodeEstimate.id,
                  accessCode: accessCodeValue || null,
                });
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="accessCode">Access code (optional)</Label>
                <Input
                  id="accessCode"
                  type="text"
                  placeholder="e.g. 20260419"
                  value={accessCodeValue}
                  onChange={(e) => setAccessCodeValue(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Leave blank to remove password protection</p>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={updateAccessCodeMutation.isPending}>
                  {updateAccessCodeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

