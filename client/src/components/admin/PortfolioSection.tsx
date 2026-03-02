import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Briefcase, Loader2, Pencil, Plus, Trash2, Eye, EyeOff, GripVertical, Image } from 'lucide-react';
import { uploadFileToServer } from './shared/utils';
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
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export function PortfolioSection() {
    const { toast } = useToast();
    const [editingService, setEditingService] = useState<PortfolioService | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const { data: services, isLoading } = useQuery<PortfolioService[]>({
        queryKey: ['/api/portfolio-services']
    });

    const createService = useMutation({
        mutationFn: async (data: InsertPortfolioService) => {
            return apiRequest('POST', '/api/portfolio-services', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/portfolio-services'] });
            toast({ title: 'Service created successfully' });
            setIsDialogOpen(false);
        },
        onError: (error: Error) => {
            toast({ title: 'Failed to create service', description: error.message, variant: 'destructive' });
        }
    });

    const updateService = useMutation({
        mutationFn: async (data: { id: number; service: Partial<InsertPortfolioService> }) => {
            return apiRequest('PUT', `/api/portfolio-services/${data.id}`, data.service);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/portfolio-services'] });
            toast({ title: 'Service updated successfully' });
            setEditingService(null);
            setIsDialogOpen(false);
        },
        onError: (error: Error) => {
            toast({ title: 'Failed to update service', description: error.message, variant: 'destructive' });
        }
    });

    const deleteService = useMutation({
        mutationFn: async (id: number) => {
            return apiRequest('DELETE', `/api/portfolio-services/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/portfolio-services'] });
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
            queryClient.invalidateQueries({ queryKey: ['/api/portfolio-services'] });
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
            queryClient.invalidateQueries({ queryKey: ['/api/portfolio-services'] });
            toast({ title: 'Order updated successfully' });
        },
        onError: (error: Error) => {
            toast({ title: 'Failed to update order', description: error.message, variant: 'destructive' });
        }
    });

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const sortedServices = [...(services || [])].sort((a, b) => a.order - b.order);
        const oldIndex = sortedServices.findIndex(s => s.id === active.id);
        const newIndex = sortedServices.findIndex(s => s.id === over.id);

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

    const sortedServices = [...(services || [])].sort((a, b) => a.order - b.order);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Portfolio Services</h1>
                    <p className="text-muted-foreground">Drag to reorder, click to edit</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingService(null); }}>
                    <DialogTrigger asChild>
                        <Button onClick={handleCreate} data-testid="button-add-service">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Service
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <ServiceForm
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
                <div className="p-12 text-center bg-card rounded-lg">
                    <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No services yet</h3>
                    <p className="text-muted-foreground mb-4">Create services to display on your portfolio page</p>
                    <Button
                        onClick={() => seedServices.mutate()}
                        disabled={seedServices.isPending}
                        variant="outline"
                        className="mt-2"
                    >
                        {seedServices.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4 mr-2" />
                        )}
                        Seed Default Services
                    </Button>
                </div>
            ) : (
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={sortedServices.map(s => s.id)} strategy={verticalListSortingStrategy}>
                        <div className="grid gap-4">
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
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="p-4 rounded-lg bg-card border transition-all hover:shadow-md"
            data-testid={`service-item-${service.id}`}
        >
            <div className="flex items-start gap-4">
                <button
                    {...attributes}
                    {...listeners}
                    className="p-2 cursor-grab hover:bg-muted rounded touch-none"
                >
                    <GripVertical className="w-5 h-5 text-muted-foreground" />
                </button>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(service)}>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-lg hover:text-primary transition-colors">{service.title}</h3>
                        <Badge variant={service.isActive ? "default" : "secondary"}>
                            {service.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mb-2">{service.subtitle}</p>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium text-primary">{service.price}</span>
                        <span className="text-muted-foreground">{service.priceLabel}</span>
                    </div>
                    {service.features && service.features.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {service.features.slice(0, 3).map((feature: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">{feature}</Badge>
                            ))}
                            {service.features.length > 3 && (
                                <Badge variant="outline" className="text-xs">+{service.features.length - 3} more</Badge>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit(service)}
                        data-testid={`button-edit-service-${service.id}`}
                    >
                        <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-delete-service-${service.id}`}>
                                <Trash2 className="w-4 h-4 text-red-500" />
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
    const [formData, setFormData] = useState<Partial<InsertPortfolioService>>({
        slug: service?.slug || '',
        title: service?.title || '',
        subtitle: service?.subtitle || '',
        description: service?.description || '',
        price: service?.price || '',
        priceLabel: service?.priceLabel || 'One-time',
        badgeText: service?.badgeText || 'One-time Fee',
        features: service?.features || [],
        imageUrl: service?.imageUrl || '',
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
        onSubmit(formData);
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
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle>{service ? 'Edit Service' : 'Add Service'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
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

                <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        required
                        placeholder="Service title"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="subtitle">Subtitle</Label>
                    <Input
                        id="subtitle"
                        value={formData.subtitle}
                        onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                        placeholder="Short subtitle"
                    />
                </div>

                <div className="space-y-2">
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

                {/* Pricing */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="price">Price</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                                id="price"
                                value={formData.price?.replace(/^\$/, '') || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, price: '$' + e.target.value.replace(/^\$/, '') }))}
                                required
                                placeholder="e.g., 1,999.00"
                                className="pl-7"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="priceLabel">Price Label</Label>
                        <Input
                            id="priceLabel"
                            value={formData.priceLabel}
                            onChange={(e) => setFormData(prev => ({ ...prev, priceLabel: e.target.value }))}
                            placeholder="e.g., One-time, per month"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="badgeText">Badge Text</Label>
                    <Input
                        id="badgeText"
                        value={formData.badgeText}
                        onChange={(e) => setFormData(prev => ({ ...prev, badgeText: e.target.value }))}
                        placeholder="e.g., One-time Fee, Subscription"
                    />
                </div>

                {/* Features */}
                <div className="space-y-2">
                    <Label>Features</Label>
                    <div className="flex gap-2">
                        <Input
                            value={featureInput}
                            onChange={(e) => setFeatureInput(e.target.value)}
                            placeholder="Add a feature..."
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                        />
                        <Button type="button" onClick={addFeature} variant="secondary">Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {formData.features?.map((feature: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeFeature(idx)}>
                                {feature} ×
                            </Badge>
                        ))}
                    </div>
                </div>

                {/* Media */}
                <div className="space-y-2">
                    <Label>Service Image</Label>
                    {formData.imageUrl ? (
                        <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                            <img src={formData.imageUrl} alt="Service" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                            >
                                <EyeOff className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                            <Image className="w-8 h-8 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground mt-2">Click to upload</span>
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

                <div className="space-y-2">
                    <Label htmlFor="iconName">Icon</Label>
                    <select
                        id="iconName"
                        value={formData.iconName || 'Rocket'}
                        onChange={(e) => setFormData(prev => ({ ...prev, iconName: e.target.value }))}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
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

                {/* CTA */}
                <div className="space-y-2">
                    <Label htmlFor="ctaText">CTA Text</Label>
                    <Input
                        id="ctaText"
                        value={formData.ctaText}
                        onChange={(e) => setFormData(prev => ({ ...prev, ctaText: e.target.value }))}
                        placeholder="e.g., Get Started"
                    />
                </div>

                {/* Styling */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="backgroundColor">Background Class</Label>
                        <Input
                            id="backgroundColor"
                            value={formData.backgroundColor}
                            onChange={(e) => setFormData(prev => ({ ...prev, backgroundColor: e.target.value }))}
                            placeholder="e.g., bg-white, bg-[#1C1936]"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="textColor">Text Color Class</Label>
                        <Input
                            id="textColor"
                            value={formData.textColor}
                            onChange={(e) => setFormData(prev => ({ ...prev, textColor: e.target.value }))}
                            placeholder="e.g., text-slate-900, text-white"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <input
                        type="color"
                        value={formData.accentColor || '#406EF1'}
                        onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                        className="w-12 h-12 rounded border cursor-pointer"
                    />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between pt-4 border-t">
                    <div className="space-y-0.5">
                        <Label htmlFor="isActive">Active</Label>
                        <p className="text-sm text-muted-foreground">Show this service on the portfolio page</p>
                    </div>
                    <Switch
                        id="isActive"
                        checked={formData.isActive ?? true}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline" type="button">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isLoading} data-testid="button-save-service">
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {service ? 'Update' : 'Create'}
                </Button>
            </DialogFooter>
        </form>
    );
}
