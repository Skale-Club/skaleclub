import { useState } from 'react';
import { Image, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from '@/components/ui/loader';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToServer, getOriginalImageUrl } from '../shared/utils';
import type { InsertPortfolioService, PortfolioService } from '@shared/schema';

type PortfolioServiceFormProps = {
    service: PortfolioService | null;
    onSubmit: (data: Partial<InsertPortfolioService>) => void;
    isLoading: boolean;
    nextOrder: number;
};

export function PortfolioServiceForm({ service, onSubmit, isLoading, nextOrder }: PortfolioServiceFormProps) {
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
        logoIconUrl: service?.logoIconUrl || '',
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

    const updateFeature = (index: number, value: string) => {
        setFormData(prev => ({
            ...prev,
            features: prev.features?.map((f: string, i: number) => (i === index ? value : f)) || []
        }));
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const path = await uploadFileToServer(file);
            setFormData(prev => ({ ...prev, logoIconUrl: path }));
            toast({ title: 'Logo icon uploaded successfully' });
        } catch (error: any) {
            toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
        }
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

                    {/* Right column: Logo Icon + Tool URL */}
                    <div className="space-y-4">
                        {/* Logo Icon — small square shown on the card */}
                        <div className="space-y-1.5">
                            <Label>Logo Icon</Label>
                            {formData.logoIconUrl ? (
                                <div className="relative w-24 h-24 rounded-lg overflow-hidden border bg-muted">
                                    <img
                                        src={getOriginalImageUrl(formData.logoIconUrl)}
                                        alt="Logo icon"
                                        className="w-full h-full object-contain p-1"
                                    />
                                    <label
                                        className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
                                        title="Click to replace"
                                    >
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
                            <p className="text-xs text-muted-foreground">Small square shown on the card. Transparent PNG recommended.</p>
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

                {/* Section: Feature Bubbles */}
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feature Bubbles</p>
                    {formData.features && formData.features.length > 0 && (
                        <div className="space-y-2">
                            {formData.features.map((feature: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <Input
                                        value={feature}
                                        onChange={(e) => updateFeature(idx, e.target.value)}
                                        placeholder="Bubble text"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0 text-red-500"
                                        onClick={() => removeFeature(idx)}
                                        aria-label="Delete bubble"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Input
                            value={featureInput}
                            onChange={(e) => setFeatureInput(e.target.value)}
                            placeholder="Add a bubble..."
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                        />
                        <Button type="button" onClick={addFeature} variant="secondary">Add</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Shown as bubbles on the card. They sit in a fixed-height area, so adding or removing them won't change the card's height.</p>
                </div>

                <div className="border-t" />

                {/* Section: Appearance */}
                <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appearance</p>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="hidden">
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
