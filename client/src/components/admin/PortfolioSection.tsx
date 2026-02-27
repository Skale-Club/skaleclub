import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Briefcase, Loader2, Pencil, Plus, Trash2, Eye, EyeOff, GripVertical, ArrowLeft, ArrowRight } from 'lucide-react';
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Portfolio Services</h1>
                    <p className="text-muted-foreground">Manage services displayed on the portfolio page</p>
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
                </div>
            ) : (
                <div className="grid gap-4">
                    {services?.sort((a, b) => a.order - b.order).map((service) => (
                        <ServiceCard
                            key={service.id}
                            service={service}
                            onEdit={handleEdit}
                            onDelete={(id) => deleteService.mutate(id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function ServiceCard({ service, onEdit, onDelete }: {
    service: PortfolioService;
    onEdit: (service: PortfolioService) => void;
    onDelete: (id: number) => void;
}) {
    return (
        <div
            className="p-4 rounded-lg bg-card border transition-all hover:shadow-md"
            data-testid={`service-item-${service.id}`}
        >
            <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-lg">{service.title}</h3>
                        <Badge variant={service.isActive ? "default" : "secondary"}>
                            {service.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline">{service.layout === 'left' ? <ArrowLeft className="w-3 h-3 mr-1" /> : <ArrowRight className="w-3 h-3 mr-1" />} {service.layout}</Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mb-2">{service.subtitle}</p>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium text-primary">{service.price}</span>
                        <span className="text-muted-foreground">{service.priceLabel}</span>
                        <span className="text-muted-foreground">Order: {service.order}</span>
                    </div>
                    {service.features && service.features.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {service.features.slice(0, 3).map((feature, idx) => (
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
        ctaButtonColor: service?.ctaButtonColor || '#406EF1',
        backgroundColor: service?.backgroundColor || 'bg-white',
        textColor: service?.textColor || 'text-slate-900',
        accentColor: service?.accentColor || 'blue',
        layout: service?.layout || 'left',
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
            features: prev.features?.filter((_, i) => i !== index) || []
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
                    <div className="space-y-2">
                        <Label htmlFor="order">Display Order</Label>
                        <Input
                            id="order"
                            type="number"
                            value={formData.order}
                            onChange={(e) => setFormData(prev => ({ ...prev, order: Number(e.target.value) }))}
                            min={0}
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
                        <Input
                            id="price"
                            value={formData.price}
                            onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                            required
                            placeholder="e.g., $1,999.00"
                        />
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
                        {formData.features?.map((feature, idx) => (
                            <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeFeature(idx)}>
                                {feature} ×
                            </Badge>
                        ))}
                    </div>
                </div>

                {/* Media */}
                <div className="space-y-2">
                    <Label htmlFor="imageUrl">Image URL</Label>
                    <Input
                        id="imageUrl"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                        placeholder="https://..."
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="iconName">Icon Name (Lucide)</Label>
                    <Input
                        id="iconName"
                        value={formData.iconName}
                        onChange={(e) => setFormData(prev => ({ ...prev, iconName: e.target.value }))}
                        placeholder="e.g., Rocket, Bot, Calendar"
                    />
                </div>

                {/* CTA */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="ctaText">CTA Text</Label>
                        <Input
                            id="ctaText"
                            value={formData.ctaText}
                            onChange={(e) => setFormData(prev => ({ ...prev, ctaText: e.target.value }))}
                            placeholder="e.g., Get Started"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ctaButtonColor">CTA Button Color (hex)</Label>
                        <Input
                            id="ctaButtonColor"
                            value={formData.ctaButtonColor}
                            onChange={(e) => setFormData(prev => ({ ...prev, ctaButtonColor: e.target.value }))}
                            placeholder="#406EF1"
                        />
                    </div>
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

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="accentColor">Accent Color</Label>
                        <Input
                            id="accentColor"
                            value={formData.accentColor}
                            onChange={(e) => setFormData(prev => ({ ...prev, accentColor: e.target.value }))}
                            placeholder="e.g., blue, purple, emerald"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="layout">Layout</Label>
                        <select
                            id="layout"
                            value={formData.layout}
                            onChange={(e) => setFormData(prev => ({ ...prev, layout: e.target.value as 'left' | 'right' }))}
                            className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        >
                            <option value="left">Image Left</option>
                            <option value="right">Image Right</option>
                        </select>
                    </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between pt-4 border-t">
                    <div className="space-y-0.5">
                        <Label htmlFor="isActive">Active</Label>
                        <p className="text-sm text-muted-foreground">Show this service on the portfolio page</p>
                    </div>
                    <Switch
                        id="isActive"
                        checked={formData.isActive}
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
