import { useState } from 'react';
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
import { getOriginalImageUrl } from '../shared/utils';
import type { PortfolioService } from '@shared/schema';

type PortfolioServiceCardProps = {
    service: PortfolioService;
    onEdit: (service: PortfolioService) => void;
    onDelete: (id: number) => void;
};

export function PortfolioServiceCard({ service, onEdit, onDelete }: PortfolioServiceCardProps) {
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
