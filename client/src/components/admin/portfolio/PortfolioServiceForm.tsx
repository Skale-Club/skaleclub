import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from '@/components/ui/loader';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToServer } from '../shared/utils';
import { CatalogPreview } from '../catalog/CatalogPreview';
import { FormNotice, catalogLimitIssues } from '../catalog/CatalogFields';
import { ServiceMediaFields } from './ServiceMediaFields';
import { ServiceContentFields } from './ServiceContentFields';
import { ServicePricingFields } from './ServicePricingFields';
import { ServiceGalleryFields } from './ServiceGalleryFields';
import { ServicePopupUrlsField } from './ServicePopupUrlsField';
import type { PortfolioFormData, PreviewImageField } from './portfolioFormTypes';
import type { InsertPortfolioService, PortfolioService } from '@shared/schema';
import { fromPortfolioService } from '@shared/catalog';
import { PORTFOLIO_DESCRIPTION_MAX_LINES, PORTFOLIO_DESCRIPTION_MAX_WORDS, countWords } from '@shared/portfolio';

type PortfolioServiceFormProps = {
    service: PortfolioService | null;
    onSubmit: (data: Partial<InsertPortfolioService>) => void;
    isLoading: boolean;
    nextOrder: number;
};

/**
 * Only the fields the redesigned catalog reads. The legacy per-item styling
 * (backgroundColor, textColor, accentColor, ctaButtonColor, iconName) and the
 * legacy `imageUrl` are no longer edited nor sent: updates leave the stored
 * values untouched and creates fall back to the schema defaults.
 */
function initialFormData(service: PortfolioService | null, nextOrder: number): PortfolioFormData {
    return {
        slug: service?.slug || '',
        title: service?.title || '',
        subtitle: service?.subtitle || '',
        description: service?.description || '',
        category: (service?.category as PortfolioFormData['category']) ?? null,
        price: service?.price || '',
        priceLabel: service?.priceLabel || '/month',
        setupPrice: service?.setupPrice || '',
        badgeText: service?.badgeText ?? '',
        features: service?.features || [],
        homeImageUrl: service?.homeImageUrl || '',
        dashboardImageUrl: service?.dashboardImageUrl || '',
        logoIconUrl: service?.logoIconUrl || '',
        toolUrl: service?.toolUrl || '',
        ctaText: service?.ctaText || 'Get Started',
        order: service?.order ?? nextOrder,
        isActive: service?.isActive ?? true,
        popupSliderImages: service?.popupSliderImages || [],
        popupUrls: service?.popupUrls || [],
    };
}

export function PortfolioServiceForm({ service, onSubmit, isLoading, nextOrder }: PortfolioServiceFormProps) {
    const { toast } = useToast();
    const [previewUploading, setPreviewUploading] = useState(false);
    const [formData, setFormData] = useState<PortfolioFormData>(() => initialFormData(service, nextOrder));

    const descriptionTooLong = countWords(formData.description ?? '') > PORTFOLIO_DESCRIPTION_MAX_WORDS;
    const limitIssues = catalogLimitIssues(formData);
    const blocked = limitIssues.length > 0 || descriptionTooLong;

    const previewItem = useMemo(
        () => fromPortfolioService({ ...formData, id: service?.id ?? 0 } as PortfolioService),
        [formData, service?.id],
    );

    const uploadPreview = async (field: PreviewImageField, file: File | undefined) => {
        if (!file) return;
        setPreviewUploading(true);
        try {
            const imagePath = await uploadFileToServer(file);
            setFormData(prev => ({ ...prev, [field]: imagePath }));
            toast({ title: field === 'homeImageUrl' ? 'Preview da Home atualizado' : 'Preview do dashboard atualizado' });
        } catch (error: any) {
            toast({ title: 'Upload falhou', description: error.message, variant: 'destructive' });
        } finally {
            setPreviewUploading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (descriptionTooLong) {
            toast({
                title: 'Description too long',
                description: 'Use ' + PORTFOLIO_DESCRIPTION_MAX_WORDS + ' words or fewer so the popup fits within ' + PORTFOLIO_DESCRIPTION_MAX_LINES + ' lines.',
                variant: 'destructive',
            });
            return;
        }
        if (limitIssues.length > 0) {
            toast({ title: 'Content over the card limits', description: limitIssues.join(' '), variant: 'destructive' });
            return;
        }
        let toolUrl = (formData.toolUrl ?? '').trim();
        if (toolUrl && !/^https?:\/\//i.test(toolUrl)) toolUrl = `https://${toolUrl}`;
        const setupPrice = (formData.setupPrice ?? '').trim();
        onSubmit({
            ...formData,
            badgeText: (formData.badgeText ?? '').trim(),
            description: (formData.description ?? '').trim(),
            toolUrl: toolUrl || null,
            setupPrice: setupPrice || null,
        });
    };

    const sectionProps = { formData, setFormData };

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
                <Button type="submit" disabled={isLoading || previewUploading || blocked} size="sm" data-testid="button-save-service"
                    title={blocked ? 'Fix the highlighted fields to save' : undefined}>
                    {isLoading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    {service ? 'Update' : 'Create'}
                </Button>
                <DialogClose asChild>
                    <button type="button" className="rounded-sm opacity-70 hover:opacity-100 transition-opacity" aria-label="Close">
                        <span className="text-lg leading-none">✕</span>
                    </button>
                </DialogClose>
            </div>

            <div className="overflow-y-auto flex-1">
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 py-4 px-6">
                    <div className="space-y-6 min-w-0">
                        {blocked && (
                            <FormNotice tone="error">
                                <p className="font-semibold">Fix these before saving:</p>
                                {limitIssues.map(issue => <p key={issue}>{issue}</p>)}
                                {descriptionTooLong && <p>Description is longer than {PORTFOLIO_DESCRIPTION_MAX_WORDS} words.</p>}
                            </FormNotice>
                        )}
                        <ServiceMediaFields {...sectionProps} previewUploading={previewUploading} uploadPreview={uploadPreview} />
                        <div className="border-t" />
                        <ServiceContentFields {...sectionProps} />
                        <div className="border-t" />
                        <ServicePricingFields {...sectionProps} />
                        <div className="border-t" />
                        <ServiceGalleryFields {...sectionProps} previewUploading={previewUploading} uploadPreview={uploadPreview} />
                        <div className="border-t" />
                        <ServicePopupUrlsField {...sectionProps} />
                    </div>

                    <aside className="xl:sticky xl:top-0 xl:self-start">
                        <CatalogPreview item={previewItem} />
                    </aside>
                </div>
            </div>
        </form>
    );
}
