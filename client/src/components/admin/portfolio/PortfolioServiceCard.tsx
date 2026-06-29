import { GripVertical, Image, Pencil, Trash2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getImageUrl } from '../shared/utils';
import type { PortfolioService } from '@shared/schema';

type PortfolioServiceCardProps = {
    service: PortfolioService;
    onEdit: (service: PortfolioService) => void;
    onDelete: (id: number) => void;
};

export function PortfolioServiceCard({ service, onEdit, onDelete }: PortfolioServiceCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: service.id,
        transition: { duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
        boxShadow: isDragging ? '0 12px 28px rgba(0,0,0,0.18)' : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-3 rounded-lg bg-card border px-3 py-2 transition-all hover:shadow-sm"
            data-testid={`service-item-${service.id}`}
        >
            {/* Drag handle */}
            <button
                {...attributes}
                {...listeners}
                className="p-1 cursor-grab hover:bg-muted rounded touch-none shrink-0"
                aria-label="Drag to reorder"
            >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Main info — clickable to edit */}
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(service)}>
                <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-semibold text-sm truncate hover:text-primary transition-colors">
                        {service.title}
                    </h3>
                    <Badge
                        variant={service.isActive ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5 py-0 shrink-0"
                    >
                        {service.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                </div>
                <div className="flex items-center gap-x-2 gap-y-0.5 mt-0.5 flex-wrap">
                    {service.subtitle && (
                        <span className="text-muted-foreground text-xs truncate max-w-[16rem]">
                            {service.subtitle}
                        </span>
                    )}
                    <span className="flex items-baseline gap-1">
                        <span className="font-bold text-primary text-sm">{service.price}</span>
                        <span className="text-muted-foreground text-[10px]">{service.priceLabel}</span>
                    </span>
                    {service.features && service.features.length > 0 && (
                        <span className="hidden sm:flex flex-wrap gap-1">
                            {service.features.slice(0, 2).map((feature: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
                                    {feature}
                                </Badge>
                            ))}
                            {service.features.length > 2 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    +{service.features.length - 2}
                                </Badge>
                            )}
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
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
            </div>

            {/* Small thumbnail — far right */}
            <div
                className="shrink-0 h-12 w-16 rounded-md overflow-hidden border bg-muted flex items-center justify-center cursor-pointer"
                onClick={() => onEdit(service)}
            >
                {service.imageUrl ? (
                    <img
                        src={getImageUrl(service.imageUrl, { width: 160, quality: 70 })}
                        alt={service.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <Image className="w-5 h-5 text-muted-foreground/40" />
                )}
            </div>
        </div>
    );
}
