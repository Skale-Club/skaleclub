import { useState } from 'react';
import { Image, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToServer, getOriginalImageUrl } from '../shared/utils';
import { FormNotice } from '../catalog/CatalogFields';
import type { PortfolioFieldsProps, PreviewImageField } from './portfolioFormTypes';

type Props = PortfolioFieldsProps & {
    previewUploading: boolean;
    uploadPreview: (field: PreviewImageField, file: File | undefined) => Promise<void>;
};

/** Website home (the card cover), logo icon and tool URL. */
export function ServiceMediaFields({ formData, setFormData, previewUploading, uploadPreview }: Props) {
    const { toast } = useToast();
    const [imageAspectRatio, setImageAspectRatio] = useState('16 / 9');
    const [storedSize, setStoredSize] = useState('...');

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const path = await uploadFileToServer(file);
            setFormData(prev => ({ ...prev, logoIconUrl: path }));
            toast({ title: 'Logo icon uploaded successfully' });
        } catch (error: any) {
            toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
        }
    };

    const onHomeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        void uploadPreview('homeImageUrl', file);
    };

    const missingCover = (formData.isActive ?? true) && !formData.homeImageUrl;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Website home: the one cover image */}
            <div className="space-y-1.5">
                <Label>Website home | card cover</Label>
                <p className="text-xs text-muted-foreground">
                    Screenshot of the product's website home. It is the card cover on the site and the only image of the product in the print folder.
                </p>
                {formData.homeImageUrl ? (
                    <div className="space-y-1.5">
                        <label
                            className="group relative w-full rounded-lg overflow-hidden border bg-muted cursor-pointer block"
                            style={{ aspectRatio: imageAspectRatio }}
                            title="Click to replace image"
                        >
                            <img
                                src={getOriginalImageUrl(formData.homeImageUrl)}
                                alt="Website home"
                                className="w-full h-full object-cover"
                                loading="eager"
                                decoding="async"
                                onLoad={(e) => {
                                    const img = e.currentTarget;
                                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                                        setImageAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
                                        setStoredSize(`${img.naturalWidth} × ${img.naturalHeight}px`);
                                    }
                                }}
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white pointer-events-none">
                                <Image className="w-6 h-6" />
                                <span className="text-sm font-medium">Click to replace</span>
                            </div>
                            <input type="file" className="hidden" accept="image/*" data-testid="input-home-preview-replace"
                                disabled={previewUploading} onChange={onHomeFile} />
                            <button
                                type="button"
                                disabled={previewUploading}
                                onClick={(e) => { e.preventDefault(); setFormData(prev => ({ ...prev, homeImageUrl: null })); }}
                                className="absolute top-2 right-2 z-10 p-1.5 bg-black/60 hover:bg-red-500/80 text-white rounded-full transition-colors"
                                title="Remove image"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </label>
                        <p className="text-xs text-muted-foreground">
                            Stored size: <span className="font-mono">{storedSize}</span>
                            {' · '}
                            <a href={getOriginalImageUrl(formData.homeImageUrl)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                Open original
                            </a>
                        </p>
                    </div>
                ) : (
                    <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        <Image className="w-8 h-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground mt-2">Click to upload image</span>
                        <span className="text-xs text-muted-foreground/60 mt-1">At least 1200 px wide · the card shows the top of this image</span>
                        <input type="file" className="hidden" accept="image/*" data-testid="input-home-preview"
                            disabled={previewUploading} onChange={onHomeFile} />
                    </label>
                )}
                {missingCover && (
                    <FormNotice>
                        <p>
                            This item is active but has no website home image. The card will fall back to
                            {formData.logoIconUrl ? ' the logo' : ' the product name (there is no logo either)'}.
                        </p>
                    </FormNotice>
                )}
            </div>

            {/* Logo icon + tool URL */}
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <Label>Logo Icon</Label>
                    {formData.logoIconUrl ? (
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden border bg-muted">
                            <img src={getOriginalImageUrl(formData.logoIconUrl)} alt="Logo icon" className="w-full h-full object-contain p-1" />
                            <label className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/50 opacity-0 hover:opacity-100 transition-opacity" title="Click to replace">
                                <span className="text-white text-xs font-medium">Replace</span>
                                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                            </label>
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFormData(prev => ({ ...prev, logoIconUrl: '' })); }}
                                className="absolute top-1 right-1 z-10 p-1 bg-black/60 hover:bg-red-500/80 text-white rounded-full transition-colors"
                                title="Remove logo icon"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ) : (
                        <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                            <Image className="w-5 h-5 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground mt-1">Upload</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                        </label>
                    )}
                    <p className="text-xs text-muted-foreground">Shown beside the product name in the detail view; used on the card if there is no home image.</p>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="toolUrl">Tool URL (optional)</Label>
                    <Input
                        id="toolUrl"
                        type="text"
                        value={formData.toolUrl ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, toolUrl: e.target.value }))}
                        onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && !/^https?:\/\//i.test(val)) setFormData(prev => ({ ...prev, toolUrl: `https://${val}` }));
                        }}
                        placeholder="example.com"
                    />
                    <p className="text-xs text-muted-foreground">The product's own site, linked from its details.</p>
                </div>
            </div>
        </div>
    );
}
