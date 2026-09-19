import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogDetail } from '@/components/catalog/CatalogDetail';
import type { CatalogItem } from '@shared/catalog';
import { AdminCard } from '../shared/AdminCard';

/**
 * Live preview of the real public card, on the site's page colour, plus a
 * button that opens the real popup (without a CTA). Rendered inside the admin
 * dialogs, so it has to coexist with a Radix modal.
 */
export function CatalogPreview({ item, className, cardWidth = 340 }: { item: CatalogItem; className?: string; cardWidth?: number }) {
    const [open, setOpen] = useState(false);

    // The admin dialog listens for Escape on `document` (capture) and would
    // close itself along with the popup. `window` capture runs first.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setOpen(false);
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [open]);

    return (
        <AdminCard padding="compact" className={cn('bg-surface-dark space-y-3', className)}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Live preview</p>
                <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)} data-testid="button-preview-popup">
                    <Eye className="mr-1.5 h-4 w-4" /> Preview popup
                </Button>
            </div>
            <div className="mx-auto w-full" style={{ maxWidth: cardWidth }}>
                <CatalogCard item={item} variant="tile" onOpen={() => setOpen(true)} />
            </div>
            <CatalogDetail items={[item]} index={open ? 0 : null} onIndexChange={() => undefined} onClose={() => setOpen(false)} />
        </AdminCard>
    );
}
