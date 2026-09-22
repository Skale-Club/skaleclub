import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SECTION_LABEL, type PortfolioFieldsProps } from './portfolioFormTypes';

const PRICE_LABELS: { value: string; label: string }[] = [
    { value: '/month', label: '/month' },
    { value: '/year', label: '/year' },
    { value: 'one-time', label: 'one-time' },
    { value: 'starting', label: 'starting' },
    { value: 'per project', label: 'per project' },
    { value: 'per seat', label: '/seat' },
];

/** Price, price label, setup fee, badge and CTA label. */
export function ServicePricingFields({ formData, setFormData }: PortfolioFieldsProps) {
    return (
        <div className="space-y-3">
            <p className={SECTION_LABEL}>Pricing</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="price">Price</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                            id="price"
                            value={formData.price?.replace(/^\$/, '') || ''}
                            onChange={(e) => {
                                const value = e.target.value.replace(/^\$/, '').trim();
                                setFormData(prev => ({ ...prev, price: value ? '$' + value : '' }));
                            }}
                            placeholder="Empty = Start here"
                            className="pl-7"
                        />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="priceLabel">Price Label</Label>
                    <select
                        id="priceLabel"
                        value={formData.priceLabel ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, priceLabel: e.target.value }))}
                        className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                    >
                        {PRICE_LABELS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="setupPrice">Setup Price (optional)</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                            id="setupPrice"
                            value={formData.setupPrice?.replace(/^\$/, '') || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, setupPrice: e.target.value ? '$' + e.target.value.replace(/^\$/, '') : '' }))}
                            placeholder="499"
                            className="pl-7"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">Shown smaller, next to the price, as a one-time setup fee. Leave blank to hide.</p>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="badgeText">Badge (optional)</Label>
                    <Input
                        id="badgeText"
                        value={formData.badgeText ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, badgeText: e.target.value }))}
                        placeholder="e.g., Popular"
                    />
                    <p className="text-xs text-muted-foreground">Small tag on the cover. Leave empty to show no badge.</p>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="ctaText">CTA Button Text</Label>
                    <Input
                        id="ctaText"
                        value={formData.ctaText ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, ctaText: e.target.value }))}
                        required
                        placeholder="e.g., Get Started"
                    />
                </div>
            </div>
        </div>
    );
}
