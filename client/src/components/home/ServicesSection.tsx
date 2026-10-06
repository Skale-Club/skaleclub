import { startTransition, useCallback, useMemo, useState } from 'react';
import type { HomepageContent, PortfolioService } from '@shared/schema';
import { catalogProducts, type CatalogItem } from '@shared/catalog';
import { useQuery } from '@tanstack/react-query';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogDetail } from '@/components/catalog/CatalogDetail';
import { Band, type BandTone } from '@/components/editorial';
import { SectionHeading } from '@/components/layout/SectionHeading';
import { ServicesCarousel } from '@/components/home/ServicesCarousel';
import { StepCard } from '@/components/home/StepCard';
import type { StepItem } from '@/components/home/StepCard';

type Props = {
  section?: HomepageContent['consultingStepsSection'] | HomepageContent['horizontalScrollSection'] | null;
  mode?: 'steps' | 'services';
  /** Band background. Defaults to cream; the home passes a blue step (dark text treatment). */
  band?: BandTone;
  onCtaClick?: () => void;
};

export function ServicesSection({ section, mode: explicitMode, onCtaClick, band = 'cream' }: Props) {
  const dark = band !== 'cream' && band !== 'ice' && band !== 'white';
  const displayMode = explicitMode || (section as any)?.mode || 'steps';

  const { data: portfolioServices } = useQuery<PortfolioService[]>({
    queryKey: ['/api/portfolio-services'],
    staleTime: 60000,
    enabled: displayMode === 'services',
  });

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isModalOpen = selectedIndex !== null;

  const rawItems = (section as any)?.cards || (section as any)?.steps || [];
  const sortedSteps = useMemo<StepItem[]>(() => {
    const items: StepItem[] = rawItems.length ? [...rawItems] : [];
    return items
      .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.numberLabel || '').localeCompare(b.numberLabel || ''))
      .map((item, index) => ({
        ...item,
        numberLabel: item.numberLabel || String(index + 1).padStart(2, '0'),
      }));
  }, [rawItems]);

  const services = useMemo(() => catalogProducts(portfolioServices), [portfolioServices]);

  // startTransition lets the tap's frame paint before React mounts the popup
  // + re-renders the paused carousel — this render used to block the main
  // thread on tap (INP ~300ms).
  const openServiceModal = useCallback((item: CatalogItem) => {
    const idx = services.findIndex((s) => s.key === item.key);
    if (idx >= 0) startTransition(() => setSelectedIndex(idx));
  }, [services]);

  // Stable renderItem so ServicesCarousel's memoized children survive
  // re-renders of this section (e.g. the paused prop flipping on modal open).
  const renderServiceItem = useCallback((item: CatalogItem, idx: number) => (
    <div
      key={`${item.key}-${idx}`}
      className="flex-shrink-0 w-[85%] sm:w-[280px] md:w-[260px] tablet:w-[245px]"
    >
      <CatalogCard item={item} variant="compact" className={dark ? undefined : 'cat--light'} onOpen={openServiceModal} />
    </div>
  ), [openServiceModal, dark]);

  const stepLabel = section?.stepLabel || '';
  const whatWeDoLabel = section?.whatWeDoLabel || '';
  const outcomeLabel = section?.outcomeLabel || '';

  const renderStepItem = useCallback((step: StepItem, idx: number) => (
    <div key={`${step.numberLabel}-${step.title}-${idx}`}>
      <StepCard
        step={step}
        index={idx}
        stepLabel={stepLabel}
        whatWeDoLabel={whatWeDoLabel}
        outcomeLabel={outcomeLabel}
        dark={dark}
      />
    </div>
  ), [stepLabel, whatWeDoLabel, outcomeLabel, dark]);

  if (!section || section.enabled === false) return null;

  const tagLabel = section?.tagLabel || 'Consulting';
  const sectionId = section?.sectionId || 'how-it-works';

  if (displayMode === 'services') {
    if (services.length === 0) return null;

    return (
      <>
        <SectionShell sectionId={sectionId} band={band}>
          <SectionHeading
            variant="editorial"
            tone={dark ? 'dark' : 'light'}
            eyebrow={tagLabel}
            title={section?.title || ''}
            subtitle={section?.subtitle}
          />
          <ServicesCarousel
            items={services}
            dark={dark}
            paused={isModalOpen}
            ariaLabel="Services carousel"
            renderItem={renderServiceItem}
          />
        </SectionShell>

        <CatalogDetail
          items={services}
          index={selectedIndex}
          onIndexChange={setSelectedIndex}
          onClose={() => setSelectedIndex(null)}
          onCta={() => {
            setSelectedIndex(null);
            if (onCtaClick) onCtaClick();
          }}
        />
      </>
    );
  }

  if (sortedSteps.length === 0) return null;

  return (
    <SectionShell sectionId={sectionId} band={band}>
      <SectionHeading
        variant="editorial"
        tone={dark ? 'dark' : 'light'}
        eyebrow={tagLabel}
        title={section?.title || ''}
        subtitle={section?.subtitle}
      />
      <ServicesCarousel
        items={sortedSteps}
        ariaLabel="Consulting steps"
        dark={dark}
        renderItem={renderStepItem}
      />
    </SectionShell>
  );
}

function SectionShell({ sectionId, band, children }: { sectionId: string; band: BandTone; children: React.ReactNode }) {
  return (
    <Band tone={band} id={sectionId} className="overflow-hidden" containerClassName="space-y-[2.125rem]">
      {children}
    </Band>
  );
}
