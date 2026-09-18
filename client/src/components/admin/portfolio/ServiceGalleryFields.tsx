import { Image, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToServer, getOriginalImageUrl } from '../shared/utils';
import { MAX_SLIDER_IMAGES, SECTION_LABEL, type PortfolioFieldsProps, type PreviewImageField } from './portfolioFormTypes';

type Props = PortfolioFieldsProps & {
    previewUploading: boolean;
    uploadPreview: (field: PreviewImageField, file: File | undefined) => Promise<void>;
};

/** Popup gallery: the dashboard screenshot first, then the laptop slider images. */
export function ServiceGalleryFields({ formData, setFormData, previewUploading, uploadPreview }: Props) {
    const { toast } = useToast();
    const slides = formData.popupSliderImages ?? [];

    const addSlides = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const remaining = MAX_SLIDER_IMAGES - slides.length;
        const selected = Array.from(e.target.files || []);
        const files = selected.slice(0, remaining);
        e.target.value = '';
        if (!files.length) return;
        if (selected.length > files.length) {
            toast({ title: `Apenas ${files.length} de ${selected.length} imagens foram adicionadas (limite de ${MAX_SLIDER_IMAGES})` });
        }
        try {
            const paths = await Promise.all(files.map(f => uploadFileToServer(f)));
            setFormData(prev => ({ ...prev, popupSliderImages: [...(prev.popupSliderImages ?? []), ...paths] }));
            toast({ title: `${paths.length} imagem(ns) adicionada(s)` });
        } catch (err: any) {
            toast({ title: 'Upload falhou', description: err.message, variant: 'destructive' });
        }
    };

    return (
        <>
            {/* Explicit previews are independent of the popup gallery order. */}
            <div className="space-y-3">
                <Label htmlFor="dashboard-preview-upload">Dashboard | first image of the popup gallery</Label>
                <p className="text-xs text-muted-foreground">Opens the gallery in the popup. This image does not appear in the print folder.</p>
                {formData.dashboardImageUrl && (
                    <div className="relative aspect-video max-w-sm overflow-hidden rounded-lg border bg-muted">
                        <img src={getOriginalImageUrl(formData.dashboardImageUrl)} alt="Preview do dashboard" className="h-full w-full object-cover" />
                        <Button type="button" variant="destructive" size="sm" className="absolute right-2 top-2" disabled={previewUploading}
                            data-testid="button-remove-dashboard-preview"
                            onClick={() => setFormData(prev => ({ ...prev, dashboardImageUrl: null }))}>
                            <Trash2 className="mr-1 h-4 w-4" /> Remover
                        </Button>
                    </div>
                )}
                <Input id="dashboard-preview-upload" data-testid="input-dashboard-preview" type="file" accept="image/*" disabled={previewUploading}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        void uploadPreview('dashboardImageUrl', file);
                    }} />
                {previewUploading && <p className="text-xs text-muted-foreground" role="status">Enviando imagem...</p>}
                {slides.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(['homeImageUrl', 'dashboardImageUrl'] as const).map(field => (
                            <div key={field} className="space-y-1.5">
                                <Label htmlFor={`preview-gallery-${field}`}>{field === 'homeImageUrl' ? 'Home: escolher da galeria' : 'Dashboard: escolher da galeria'}</Label>
                                <select id={`preview-gallery-${field}`} data-testid={`select-preview-${field}`}
                                    className="h-10 w-full rounded-md border bg-background px-3 text-sm" disabled={previewUploading}
                                    value={formData[field] || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value || null }))}>
                                    <option value="">Sem imagem</option>
                                    {formData[field] && !slides.includes(formData[field]!) && (
                                        <option value={formData[field]!}>Imagem cadastrada</option>
                                    )}
                                    {slides.map((url, index) => (
                                        <option key={`${url}-${index}`} value={url}>Screenshot {index + 1}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="border-t" />

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className={SECTION_LABEL}>Popup | Screenshots do Laptop</p>
                    <span className="text-xs text-muted-foreground">{slides.length}/{MAX_SLIDER_IMAGES} imagem(ns)</span>
                </div>
                <p className="text-xs text-muted-foreground">Imagens que passam como slides na galeria do popup. Máximo de {MAX_SLIDER_IMAGES} imagens.</p>

                {slides.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                        {slides.map((src, idx) => (
                            <div key={idx} className="relative rounded-lg overflow-hidden border" style={{ aspectRatio: '16/10' }}>
                                <img src={getOriginalImageUrl(src)} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, popupSliderImages: (prev.popupSliderImages ?? []).filter((_, i) => i !== idx) }))}
                                        className="p-1.5 bg-red-500/80 text-white rounded-full"
                                        aria-label={`Remove slide ${idx + 1}`}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{idx + 1}</span>
                            </div>
                        ))}
                    </div>
                )}

                {slides.length >= MAX_SLIDER_IMAGES ? (
                    <p className="text-xs text-muted-foreground px-4 py-3 border-2 border-dashed rounded-lg text-center">
                        Limite de {MAX_SLIDER_IMAGES} imagens atingido. Remova uma para adicionar outra.
                    </p>
                ) : (
                    <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        <Image className="w-5 h-5 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground">Adicionar screenshot...</span>
                        <input type="file" className="hidden" accept="image/*" multiple onChange={addSlides} />
                    </label>
                )}
            </div>
        </>
    );
}
