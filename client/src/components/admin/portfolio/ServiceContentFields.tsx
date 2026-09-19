import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CATALOG_LIMITS } from '@shared/catalog';
import { PORTFOLIO_DESCRIPTION_MAX_LINES, PORTFOLIO_DESCRIPTION_MAX_WORDS, countWords } from '@shared/portfolio';
import { CategorySelect, FeatureListEditor, LimitedInput } from '../catalog/CatalogFields';
import { SECTION_LABEL, type PortfolioFieldsProps } from './portfolioFormTypes';

/** Title, slug, subtitle, category, description and features. */
export function ServiceContentFields({ formData, setFormData }: PortfolioFieldsProps) {
    const descriptionWordCount = countWords(formData.description ?? '');
    const descriptionTooLong = descriptionWordCount > PORTFOLIO_DESCRIPTION_MAX_WORDS;

    return (
        <div className="space-y-3">
            <p className={SECTION_LABEL}>Identity</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <LimitedInput
                    id="title"
                    label="Title"
                    value={formData.title ?? ''}
                    max={CATALOG_LIMITS.title}
                    onChange={title => setFormData(prev => ({ ...prev, title }))}
                    placeholder="Service title"
                    required
                />
                <div className="space-y-1.5">
                    <Label htmlFor="slug">Slug (unique ID)</Label>
                    <Input
                        id="slug"
                        value={formData.slug ?? ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                        required
                        placeholder="e.g., social-cash"
                    />
                </div>
            </div>
            <LimitedInput
                id="subtitle"
                label="Subtitle"
                value={formData.subtitle ?? ''}
                max={CATALOG_LIMITS.subtitle}
                onChange={subtitle => setFormData(prev => ({ ...prev, subtitle }))}
                placeholder="Short subtitle"
            />
            <CategorySelect
                id="category"
                value={formData.category}
                onChange={category => setFormData(prev => ({ ...prev, category }))}
            />
            <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                    id="description"
                    value={formData.description ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    required
                    placeholder="Service description"
                    rows={4}
                />
                <p className={descriptionTooLong ? 'text-xs text-red-500' : 'text-xs text-muted-foreground'}>
                    {descriptionWordCount}/{PORTFOLIO_DESCRIPTION_MAX_WORDS} words. Popup descriptions support up to {PORTFOLIO_DESCRIPTION_MAX_LINES} lines.
                </p>
            </div>
            <FeatureListEditor
                features={formData.features ?? []}
                onChange={features => setFormData(prev => ({ ...prev, features }))}
            />
        </div>
    );
}
