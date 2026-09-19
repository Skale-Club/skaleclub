import type { Dispatch, SetStateAction } from 'react';
import type { InsertPortfolioService } from '@shared/schema';

export type PortfolioFormData = Partial<InsertPortfolioService>;
export type SetPortfolioFormData = Dispatch<SetStateAction<PortfolioFormData>>;

/** Props every section of the portfolio service form receives. */
export type PortfolioFieldsProps = {
    formData: PortfolioFormData;
    setFormData: SetPortfolioFormData;
};

export type PreviewImageField = 'homeImageUrl' | 'dashboardImageUrl';

export const MAX_SLIDER_IMAGES = 10;

/** One uppercase eyebrow per form section, as the form always had. */
export const SECTION_LABEL = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground';
