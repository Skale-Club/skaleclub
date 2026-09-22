import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { CATALOG_CATEGORIES, CATALOG_CATEGORY_LABEL, CATALOG_LIMITS, headlineLength, isCatalogCategory, type CatalogCategory } from '@shared/catalog';

/**
 * Admin editing primitives shared by the two catalogs (Portfolio apps and
 * Website → Our Services cards). The limits live here, in the forms only:
 * existing rows may exceed them and must still load, so the schema stays lax.
 */

type LimitedContent = { title?: string | null; subtitle?: string | null; headline?: string | null; features?: string[] | null };

/** Human-readable problems that must be fixed before saving. Empty = OK. */
export function catalogLimitIssues({ title, subtitle, headline, features }: LimitedContent): string[] {
    const issues: string[] = [];
    if (headlineLength(headline ?? '') > CATALOG_LIMITS.headline) issues.push(`Headline is longer than ${CATALOG_LIMITS.headline} characters.`);
    if ((title ?? '').length > CATALOG_LIMITS.title) issues.push(`Title is longer than ${CATALOG_LIMITS.title} characters.`);
    if ((subtitle ?? '').length > CATALOG_LIMITS.subtitle) issues.push(`Subtitle is longer than ${CATALOG_LIMITS.subtitle} characters.`);
    const list = features ?? [];
    if (list.length > CATALOG_LIMITS.features) issues.push(`Use at most ${CATALOG_LIMITS.features} features.`);
    const longFeatures = list.filter(f => f.length > CATALOG_LIMITS.feature).length;
    if (longFeatures > 0) issues.push(`${longFeatures} feature(s) longer than ${CATALOG_LIMITS.feature} characters.`);
    return issues;
}

/** "18/24", red once past the limit. */
export function LimitCounter({ value, max, className }: { value: number; max: number; className?: string }) {
    const over = value > max;
    return (
        <span className={cn('text-xs tabular-nums', over ? 'font-semibold text-red-500' : 'text-muted-foreground', className)} aria-live="polite">
            {value}/{max}
        </span>
    );
}

/** Label + counter + input. The input never truncates: legacy text stays visible so it can be fixed. */
export function LimitedInput({ id, label, value, max, onChange, placeholder, required }: {
    id: string;
    label: string;
    value: string;
    max: number;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
}) {
    const over = value.length > max;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={id}>{label}</Label>
                <LimitCounter value={value.length} max={max} />
            </div>
            <Input
                id={id}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                aria-invalid={over}
                className={over ? 'border-red-500 focus-visible:ring-red-500' : undefined}
            />
        </div>
    );
}

/** Category select: the six catalog categories plus "None" (no label on the card). */
export function CategorySelect({ id, value, onChange }: {
    id: string;
    value: string | null | undefined;
    onChange: (value: CatalogCategory | null) => void;
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>Category</Label>
            <select
                id={id}
                value={isCatalogCategory(value) ? value : ''}
                onChange={e => onChange(isCatalogCategory(e.target.value) ? e.target.value : null)}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm"
            >
                <option value="">None</option>
                {CATALOG_CATEGORIES.map(c => <option key={c} value={c}>{CATALOG_CATEGORY_LABEL[c]}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Shown as the card label. None shows only the kind (App or Service).</p>
        </div>
    );
}

/** Feature bullets: at most CATALOG_LIMITS.features, each with its own counter. */
export function FeatureListEditor({ features, onChange }: { features: string[]; onChange: (features: string[]) => void }) {
    const [draft, setDraft] = useState('');
    const full = features.length >= CATALOG_LIMITS.features;
    const add = () => {
        const value = draft.trim();
        if (!value || full) return;
        onChange([...features, value]);
        setDraft('');
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <Label>Features</Label>
                <LimitCounter value={features.length} max={CATALOG_LIMITS.features} />
            </div>
            {features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2">
                    <Input
                        value={feature}
                        onChange={e => onChange(features.map((f, i) => (i === idx ? e.target.value : f)))}
                        placeholder="Feature text"
                        aria-invalid={feature.length > CATALOG_LIMITS.feature}
                        className={feature.length > CATALOG_LIMITS.feature ? 'border-red-500 focus-visible:ring-red-500' : undefined}
                    />
                    <LimitCounter value={feature.length} max={CATALOG_LIMITS.feature} className="w-12 shrink-0 text-right" />
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-red-500"
                        onClick={() => onChange(features.filter((_, i) => i !== idx))} aria-label="Delete feature">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            ))}
            {!full && (
                <div className="flex items-center gap-2">
                    <Input
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        placeholder="Add a feature..."
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
                    />
                    <LimitCounter value={draft.length} max={CATALOG_LIMITS.feature} className="w-12 shrink-0 text-right" />
                    <Button type="button" onClick={add} variant="secondary">Add</Button>
                </div>
            )}
            <p className="text-xs text-muted-foreground">
                Up to {CATALOG_LIMITS.features} short features, {CATALOG_LIMITS.feature} characters each, so every card shares one layout.
            </p>
        </div>
    );
}

/** Inline notice. `tone="error"` for problems that block saving, `warning` for advice. */
export function FormNotice({ tone = 'warning', children }: { tone?: 'warning' | 'error'; children: React.ReactNode }) {
    return (
        <div role={tone === 'error' ? 'alert' : 'status'} className={cn(
            'flex gap-2 rounded-md border px-3 py-2 text-xs',
            tone === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        )}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <div className="space-y-0.5">{children}</div>
        </div>
    );
}
