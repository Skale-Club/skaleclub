import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Briefcase, Loader2, Pencil, Plus, Trash2, Eye, EyeOff, GripVertical, Image } from 'lucide-react';
import { uploadFileToServer, getOriginalImageUrl } from './shared/utils';
import { EmptyState } from './shared';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { PortfolioService, InsertPortfolioService } from '@shared/schema';
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export function PortfolioSection() {
    const { toast } = useToast();
    const [editingService, setEditingService] = useState<PortfolioService | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
    );

    const { data: services, isLoading } = useQuery<PortfolioService[]>({
        queryKey: ['/api/portfolio-services']
    });

    const restoreScroll = (scrollY: number) => {
        requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'instant' }));
    };

    const createService = useMutation({
        mutationFn: async (data: InsertPortfolioService) => {
            const res = await apiRequest('POST', '/api/portfolio-services', data);
            return res.json() as Promise<PortfolioService>;
        },
        onSuccess: (created) => {
            const scrollY = window.scrollY;
            queryClient.setQueryData<PortfolioService[]>(['/api/portfolio-services'], (old) =>
                old ? [...old, created] : [created]
            );
            setIsDialogOpen(false);
            toast({ title: 'Service created successfully' });
            restoreScroll(scrollY);
        },
        onError: (error: Error) => {
            toast({ title: 'Failed to create service', description: error.message, variant: 'destructive' });
        }
    });

    const updateService = useMutation({
        mutationFn: async (data: { id: number; service: Partial<InsertPortfolioService> }) => {
            const res = await apiRequest('PUT', `/api/portfolio-services/${data.id}`, data.service);
            return res.json() as Promise<PortfolioService>;
        },
        onSuccess: (updated) => {
            const scrollY = window.scrollY;
            queryClient.setQueryData<PortfolioService[]>(['/api/portfolio-services'], (old) =>
                old?.map((s) => (s.id === updated.id ? updated : s)) ?? [updated]
            );
            setEditingService(null);
            setIsDialogOpen(false);
            toast({ title: 'Service updated successfully' });
            restoreScroll(scrollY);
        },
        onError: (error: Error) => {
            toast({ title: 'Failed to update service', description: error.message, variant: 'destructive' });
        }
    });

    const deleteService = useMutation({
        mutationFn: async (id: number) => {
            await apiRequest('DELETE', `/api/portfolio-services/${id}`);
            return id;
        },
        onSuccess: (deletedId) => {
            queryClient.setQueryData<PortfolioService[]>(['/api/portfolio-services'], (old) =>
                old?.filter((s) => s.id !== deletedId) ?? []
            );
            toast({ title: 'Service deleted successfully' });
        },
        onError: (error: Error) => {
            toast({ title: 'Failed to delete service', description: error.message, variant: 'destructive' });
        }
    });

    const seedServices = useMutation({
        mutationFn: async () => {
            return apiRequest('POST', '/api/portfolio-services/seed', {});
        },
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ['/api/portfolio-services'] });
            toast({ title: 'Default services seeded successfully!' });
        },
        onError: (error: Error) => {
            toast({ title: 'Failed to seed services', description: error.message, variant: 'destructive' });
        }
    });

    const reorderServices = useMutation({
        mutationFn: async (orders: { id: number; order: number }[]) => {
            return apiRequest('PUT', '/api/portfolio-services/reorder', { orders });
        },
        onSuccess: () => {
            queryClient.refetchQueries({ queryKey: ['/api/portfolio-services'] });
            toast({ title: 'Order updated successfully' });
        },
        onError: (error: Error) => {
            toast({ title: 'Failed to update order', description: error.message, variant: 'destructive' });
        }
    });

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const sortedServices = [...(services || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        // DnD Kit may return IDs as strings — coerce both sides to number
        const oldIndex = sortedServices.findIndex(s => s.id === Number(active.id));
        const newIndex = sortedServices.findIndex(s => s.id === Number(over.id));

        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(sortedServices, oldIndex, newIndex);
        const orders = reordered.map((s, idx) => ({ id: s.id, order: idx }));
        reorderServices.mutate(orders);
    };

    const handleEdit = (service: PortfolioService) => {
        setEditingService(service);
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingService(null);
        setIsDialogOpen(true);
    };

    if (isLoading && !services) {
        return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    const sortedServices = [...(services || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingService(null); }}>
                    <DialogTrigger asChild>
                        <Button onClick={handleCreate} data-testid="button-add-service">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Service
                        </Button>
                    </DialogTrigger>
                    <DialogContent
                        className="max-w-3xl max-h-[90vh] overflow-hidden p-0 [&>button:last-child]:hidden"
                        onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                        <ServiceForm
                            key={editingService?.id ?? 'new'}
                            service={editingService}
                            onSubmit={(data) => {
                                if (editingService) {
                                    updateService.mutate({ id: editingService.id, service: data });
                                } else {
                                    createService.mutate(data as InsertPortfolioService);
                                }
                            }}
                            isLoading={createService.isPending || updateService.isPending}
                            nextOrder={services?.length || 0}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {services?.length === 0 ? (
                <EmptyState
                    icon={<Briefcase />}
                    title="No services yet"
                    description="Create services to display on your portfolio page"
                    action={
                        <Button
                            onClick={() => seedServices.mutate()}
                            disabled={seedServices.isPending}
                            variant="outline"
                        >
                            {seedServices.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            Seed Default Services
                        </Button>
                    }
                />
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={sortedServices.map(s => s.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sortedServices.map((service) => (
                                <SortableServiceCard
                                    key={service.id}
                                    service={service}
                                    onEdit={handleEdit}
                                    onDelete={(id) => deleteService.mutate(id)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}

function SortableServiceCard({ service, onEdit, onDelete }: {
    service: PortfolioService;
    onEdit: (service: PortfolioService) => void;
    onDelete: (id: number) => void;
}) {
    const [imageAspectRatio, setImageAspectRatio] = useState("16 / 9");
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: service.id,
        transition: { duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        scale: isDragging ? '1.03' : '1',
        zIndex: isDragging ? 50 : undefined,
        boxShadow: isDragging ? '0 16px 40px rgba(0,0,0,0.15)' : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="rounded-lg bg-card border transition-all hover:shadow-md flex flex-col"
            data-testid={`service-item-${service.id}`}
        >
            {/* Card header with drag + actions + status */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b gap-2">
                <button
                    {...attributes}
                    {...listeners}
                    className="p-1 cursor-grab hover:bg-muted rounded touch-none shrink-0"
                >
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="flex items-center gap-1 flex-1 justify-end">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(service)}
                        data-testid={`button-edit-service-${service.id}`}
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-delete-service-${service.id}`}>
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete Service?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete "{service.title}". This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => onDelete(service.id)}
                                    variant="destructive"
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Badge variant={service.isActive ? "default" : "secondary"} className="text-xs">
                        {service.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                </div>
            </div>

            {/* Card body — clickable */}
            <div className="flex-1 cursor-pointer" onClick={() => onEdit(service)}>
                {/* Image preview 16:9 */}
                {service.imageUrl ? (
                    <div
                        className="w-full flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(64,110,241,0.12),_rgba(15,23,42,0.92)_70%)]"
                        style={{ aspectRatio: imageAspectRatio }}
                    >
                        <img
                            src={getOriginalImageUrl(service.imageUrl)}
                            alt={service.title}
                            loading="lazy"
                            decoding="async"
                            onLoad={(e) => {
                                const { naturalWidth, naturalHeight } = e.currentTarget;
                                if (naturalWidth > 0 && naturalHeight > 0) {
                                    setImageAspectRatio(`${naturalWidth} / ${naturalHeight}`);
                                }
                            }}
                            className="w-full h-full object-cover"
                            style={{ imageRendering: 'auto', transform: 'translateZ(0)', WebkitBackfaceVisibility: 'hidden', willChange: 'transform' }}
                        />
                    </div>
                ) : (
                    <div className="w-full aspect-video bg-muted flex items-center justify-center">
                        <Image className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                )}

                <div className="p-4">
                    <h3 className="font-semibold text-base mb-0.5 hover:text-primary transition-colors leading-tight">
                        {service.title}
                    </h3>
                    <p className="text-muted-foreground text-xs mb-3">{service.subtitle}</p>
                    <div className="flex items-baseline gap-1.5 mb-3">
                        <span className="font-bold text-primary text-lg">{service.price}</span>
                        <span className="text-muted-foreground text-xs">{service.priceLabel}</span>
                    </div>
                    {service.features && service.features.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {service.features.slice(0, 2).map((feature: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">{feature}</Badge>
                            ))}
                            {service.features.length > 2 && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0">+{service.features.length - 2}</Badge>
                            )}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}

function ServiceForm({ service, onSubmit, isLoading, nextOrder }: {
    service: PortfolioService | null;
    onSubmit: (data: Partial<InsertPortfolioService>) => void;
    isLoading: boolean;
    nextOrder: number;
}) {
    const { toast } = useToast();
    const [imageAspectRatio, setImageAspectRatio] = useState("16 / 9");
    const [formData, setFormData] = useState<Partial<InsertPortfolioService>>({
        slug: service?.slug || '',
        title: service?.title || '',
        subtitle: service?.subtitle || '',
        description: service?.description || '',
        price: service?.price || '',
        priceLabel: service?.priceLabel || '/month',
        badgeText: service?.badgeText || 'One-time Fee',
        features: service?.features || [],
        imageUrl: service?.imageUrl || '',
        toolUrl: service?.toolUrl || '',
        iconName: service?.iconName || 'Rocket',
        ctaText: service?.ctaText || 'Get Started',
        backgroundColor: service?.backgroundColor || 'bg-white',
        textColor: service?.textColor || 'text-slate-900',
        accentColor: service?.accentColor || '#406EF1',
        order: service?.order ?? nextOrder,
        isActive: service?.isActive ?? true,
    });

    const [featureInput, setFeatureInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let toolUrl = (formData.toolUrl ?? '').trim();
        if (toolUrl && !/^https?:\/\//i.test(toolUrl)) {
            toolUrl = `https://${toolUrl}`;
        }
        onSubmit({ ...formData, toolUrl: toolUrl || null });
    };

    const addFeature = () => {
        if (featureInput.trim()) {
            setFormData(prev => ({
                ...prev,
                features: [...(prev.features || []), featureInput.trim()]
            }));
            setFeatureInput('');
        }
    };

    const removeFeature = (index: number) => {
        setFormData(prev => ({
            ...prev,
            features: prev.features?.filter((_: string, i: number) => i !== index) || []
        }));
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
            {/* Sticky header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b bg-background shrink-0">
                <DialogTitle className="flex-1 text-lg">{service ? 'Edit Service' : 'Add Service'}</DialogTitle>
                <span className="text-sm text-muted-foreground">{formData.isActive ? 'Active' : 'Inactive'}</span>
                <Switch
                    id="isActive"
                    checked={formData.isActive ?? true}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Button type="submit" disabled={isLoading} size="sm" data-testid="button-save-service">
                    {isLoading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    {service ? 'Update' : 'Create'}
                </Button>
                <DialogClose asChild>
                    <button type="button" className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
                        <span className="text-lg leading-none">✕</span>
                    </button>
                </DialogClose>
            </div>

            <div className="py-4 px-6 space-y-6 overflow-y-auto flex-1">

                {/* Service Image + Tool URL — 2 columns */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Image 16:9 */}
                    <div className="space-y-1.5">
                        <Label>Service Image</Label>
                        {formData.imageUrl ? (
                            <div className="space-y-1.5">
                                <label
                                    className="group relative w-full rounded-lg overflow-hidden border bg-[radial-gradient(circle_at_top,_rgba(64,110,241,0.12),_rgba(15,23,42,0.92)_70%)] cursor-pointer block"
                                    style={{ aspectRatio: imageAspectRatio }}
                                    title="Click to replace image"
                                >
                                    <img
                                        src={getOriginalImageUrl(formData.imageUrl)}
                                        alt="Service"
                                        className="w-full h-full object-cover"
                                        style={{ transform: 'translateZ(0)', WebkitBackfaceVisibility: 'hidden', imageRendering: 'auto' }}
                                        loading="eager"
                                        decoding="async"
                                        onLoad={(e) => {
                                            const img = e.currentTarget;
                                            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                                                setImageAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
                                            }
                                            const info = document.getElementById(`img-info-${service?.id ?? 'new'}`);
                                            if (info) info.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`;
                                        }}
                                    />
                                    {/* Hover overlay — Replace */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white pointer-events-none">
                                        <Image className="w-6 h-6" />
                                        <span className="text-sm font-medium">Click to replace</span>
                                    </div>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                try {
                                                    const imagePath = await uploadFileToServer(file);
                                                    setFormData(prev => ({ ...prev, imageUrl: imagePath }));
                                                    toast({ title: 'Image replaced successfully' });
                                                } catch (error: any) {
                                                    toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                                                }
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); setFormData(prev => ({ ...prev, imageUrl: '' })); }}
                                        className="absolute top-2 right-2 z-10 p-1.5 bg-black/60 hover:bg-red-500/80 text-white rounded-full transition-colors"
                                        title="Remove image"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    Stored size: <span id={`img-info-${service?.id ?? 'new'}`} className="font-mono">...</span>
                                    {' · '}
                                    <a
                                        href={getOriginalImageUrl(formData.imageUrl)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                    >Open original</a>
                                </p>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                                <Image className="w-8 h-8 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground mt-2">Click to upload image</span>
                                <span className="text-xs text-muted-foreground/60 mt-1">Ideal: 1200 × 720 px · max 200 KB</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            try {
                                                const imagePath = await uploadFileToServer(file);
                                                setFormData(prev => ({ ...prev, imageUrl: imagePath }));
                                                toast({ title: 'Image uploaded successfully' });
                                            } catch (error: any) {
                                                toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                                            }
                                        }
                                    }}
                                />
                            </label>
                        )}
                    </div>

                    {/* Tool URL */}
                    <div className="space-y-1.5">
                        <Label htmlFor="toolUrl">Tool URL (optional)</Label>
                        <Input
                            id="toolUrl"
                            type="text"
                            value={formData.toolUrl ?? ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, toolUrl: e.target.value }))}
                            onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val && !/^https?:\/\//i.test(val)) {
                                    setFormData(prev => ({ ...prev, toolUrl: `https://${val}` }));
                                }
                            }}
                            placeholder="example.com"
                        />
                        <p className="text-xs text-muted-foreground">External URL to open the tool. A link will appear next to the service title.</p>
                    </div>
                </div>

                <div className="border-t" />

                {/* Section: Identity */}
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identity</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                required
                                placeholder="Service title"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="slug">Slug (unique ID)</Label>
                            <Input
                                id="slug"
                                value={formData.slug}
                                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                                required
                                placeholder="e.g., social-cash"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="subtitle">Subtitle</Label>
                        <Input
                            id="subtitle"
                            value={formData.subtitle}
                            onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                            placeholder="Short subtitle"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            required
                            placeholder="Service description"
                            rows={3}
                        />
                    </div>
                </div>

                <div className="border-t" />

                {/* Section: Pricing */}
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pricing</p>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="price">Price</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                    id="price"
                                    value={formData.price?.replace(/^\$/, '') || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, price: '$' + e.target.value.replace(/^\$/, '') }))}
                                    required
                                    placeholder="1,999"
                                    className="pl-7"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="priceLabel">Price Label</Label>
                            <select
                                id="priceLabel"
                                value={formData.priceLabel}
                                onChange={(e) => setFormData(prev => ({ ...prev, priceLabel: e.target.value }))}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                            >
                                <option value="/month">/month</option>
                                <option value="/year">/year</option>
                                <option value="one-time">one-time</option>
                                <option value="starting">starting</option>
                                <option value="per project">per project</option>
                                <option value="per seat">/seat</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="badgeText">Badge</Label>
                            <Input
                                id="badgeText"
                                value={formData.badgeText}
                                onChange={(e) => setFormData(prev => ({ ...prev, badgeText: e.target.value }))}
                                placeholder="One-time Fee"
                            />
                        </div>
                    </div>
                </div>

                <div className="border-t" />

                {/* Section: Features */}
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Features</p>
                    <div className="flex gap-2">
                        <Input
                            value={featureInput}
                            onChange={(e) => setFeatureInput(e.target.value)}
                            placeholder="Add a feature..."
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                        />
                        <Button type="button" onClick={addFeature} variant="secondary">Add</Button>
                    </div>
                    {formData.features && formData.features.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {formData.features.map((feature: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="cursor-pointer gap-1" onClick={() => removeFeature(idx)}>
                                    {feature} ×
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t" />

                {/* Section: Appearance */}
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appearance</p>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="iconName">Icon</Label>
                            <select
                                id="iconName"
                                value={formData.iconName || 'Rocket'}
                                onChange={(e) => setFormData(prev => ({ ...prev, iconName: e.target.value }))}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                            >
                                <option value="sparkles">✨ Sparkles</option>
                                <option value="globe">🌐 Globe</option>
                                <option value="message-circle">💬 Message Circle</option>
                                <option value="credit-card">💳 Credit Card</option>
                                <option value="phone">📞 Phone</option>
                                <option value="calendar">📅 Calendar</option>
                                <option value="users">👥 Users</option>
                                <option value="cpu">🖥️ CPU</option>
                                <option value="rocket">🚀 Rocket</option>
                                <option value="bot">🤖 Bot</option>
                                <option value="zap">⚡ Zap</option>
                                <option value="star">⭐ Star</option>
                                <option value="heart">❤️ Heart</option>
                                <option value="settings">⚙️ Settings</option>
                                <option value="code">💻 Code</option>
                                <option value="database">🗄️ Database</option>
                                <option value="mail">📧 Mail</option>
                                <option value="bell">🔔 Bell</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Accent Color</Label>
                            <div className="flex items-center gap-2 h-10">
                                <input
                                    type="color"
                                    value={formData.accentColor || '#406EF1'}
                                    onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                                    className="w-10 h-10 rounded-md border cursor-pointer shrink-0"
                                />
                                <span className="text-sm font-mono text-muted-foreground">{formData.accentColor || '#406EF1'}</span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ctaText">CTA Button Text</Label>
                            <Input
                                id="ctaText"
                                value={formData.ctaText}
                                onChange={(e) => setFormData(prev => ({ ...prev, ctaText: e.target.value }))}
                                placeholder="e.g., Get Started"
                            />
                        </div>
                    </div>

                </div>

            </div>

        </form>
    );
}
