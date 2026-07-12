import { useState, startTransition } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Plus,
  Image,
  Settings,
} from 'lucide-react';
import { EmptyState, SectionHeader } from './shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import type { PortfolioService, InsertPortfolioService } from '@shared/schema';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DndContext, closestCenter, DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { PortfolioServiceCard } from './portfolio/PortfolioServiceCard';
import { PortfolioServiceForm } from './portfolio/PortfolioServiceForm';
import { PortfolioHeroSettings } from './portfolio/PortfolioHeroSettings';

export function PortfolioSection() {
    const { toast } = useToast();
    const [editingService, setEditingService] = useState<PortfolioService | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
    );

    const { data: services, isLoading } = useQuery<PortfolioService[]>({
        queryKey: ['/api/admin/portfolio-services']
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
            queryClient.setQueryData<PortfolioService[]>(['/api/admin/portfolio-services'], (old) =>
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
            queryClient.setQueryData<PortfolioService[]>(['/api/admin/portfolio-services'], (old) =>
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

    const toggleActive = useMutation({
        mutationFn: async (data: { id: number; isActive: boolean }) => {
            const res = await apiRequest('PUT', `/api/portfolio-services/${data.id}`, { isActive: data.isActive });
            return res.json() as Promise<PortfolioService>;
        },
        onMutate: ({ id, isActive }) => {
            // Optimistic flip so the switch responds instantly.
            queryClient.setQueryData<PortfolioService[]>(['/api/admin/portfolio-services'], (old) =>
                old?.map((s) => (s.id === id ? { ...s, isActive } : s)) ?? []
            );
        },
        onSuccess: (updated) => {
            queryClient.setQueryData<PortfolioService[]>(['/api/admin/portfolio-services'], (old) =>
                old?.map((s) => (s.id === updated.id ? updated : s)) ?? [updated]
            );
            // Public portfolio page filters to active-only; refetch it so the change shows there too.
            queryClient.invalidateQueries({ queryKey: ['/api/portfolio-services'] });
            toast({ title: updated.isActive ? 'Service activated' : 'Service deactivated' });
        },
        onError: (error: Error) => {
            queryClient.refetchQueries({ queryKey: ['/api/admin/portfolio-services'] });
            toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
        }
    });

    const deleteService = useMutation({
        mutationFn: async (id: number) => {
            await apiRequest('DELETE', `/api/portfolio-services/${id}`);
            return id;
        },
        onSuccess: (deletedId) => {
            queryClient.setQueryData<PortfolioService[]>(['/api/admin/portfolio-services'], (old) =>
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
            queryClient.refetchQueries({ queryKey: ['/api/admin/portfolio-services'] });
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
            queryClient.refetchQueries({ queryKey: ['/api/admin/portfolio-services'] });
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
        // DnD Kit may return IDs as strings; coerce both sides to number.
        const oldIndex = sortedServices.findIndex(s => s.id === Number(active.id));
        const newIndex = sortedServices.findIndex(s => s.id === Number(over.id));

        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(sortedServices, oldIndex, newIndex);
        const orders = reordered.map((s, idx) => ({ id: s.id, order: idx }));
        reorderServices.mutate(orders);
    };

    const handleEdit = (service: PortfolioService) => {
        // Mounting PortfolioServiceForm is heavy (image previews, uploaders, many fields);
        // startTransition lets the click return immediately instead of blocking on that mount.
        startTransition(() => {
            setEditingService(service);
            setIsDialogOpen(true);
        });
    };

    const handleCreate = () => {
        startTransition(() => {
            setEditingService(null);
            setIsDialogOpen(true);
        });
    };

    if (isLoading && !services) {
        return <div className="flex w-full justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    const sortedServices = [...(services || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return (
        <div className="space-y-6">
            <SectionHeader
                title="Portfolio"
                description="Services shown on the portfolio page"
                icon={<Image className="w-5 h-5" />}
                action={
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" type="button" data-testid="button-portfolio-settings">
                                    <Settings className="w-4 h-4 mr-2" />
                                    Settings
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
                                <PortfolioHeroSettings />
                            </DialogContent>
                        </Dialog>

                        <Dialog open={isDialogOpen} onOpenChange={(open) => { startTransition(() => { setIsDialogOpen(open); if (!open) setEditingService(null); }); }}>
                            <DialogTrigger asChild>
                                <Button size="sm" onClick={handleCreate} data-testid="button-add-service">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Service
                                </Button>
                            </DialogTrigger>
                            <DialogContent
                                className="max-w-3xl max-h-[90vh] overflow-hidden p-0 [&>button:last-child]:hidden"
                                onCloseAutoFocus={(e) => e.preventDefault()}
                            >
                                <PortfolioServiceForm
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
                }
            />

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
                    <SortableContext items={sortedServices.map(s => s.id)} strategy={verticalListSortingStrategy}>
                        <div className="flex flex-col gap-2">
                            {sortedServices.map((service) => (
                                <PortfolioServiceCard
                                    key={service.id}
                                    service={service}
                                    onEdit={handleEdit}
                                    onDelete={(id) => deleteService.mutate(id)}
                                    onToggleActive={(id, isActive) => toggleActive.mutate({ id, isActive })}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}
