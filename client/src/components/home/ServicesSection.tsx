import { startTransition, useCallback, useMemo, useState } from 'react';
import type { HomepageContent, PortfolioService } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { PortfolioCard } from '@/components/PortfolioCard';
import { ServicesHeader } from '@/components/home/ServicesHeader';
import { ServicesCarousel } from '@/components/home/ServicesCarousel';
import { StepCard } from '@/components/home/StepCard';
import type { StepItem } from '@/components/home/StepCard';
import { ServiceDetailModal } from '@/components/ServiceDetailModal';

type Props = {
  section?: HomepageContent['consultingStepsSection'] | HomepageContent['horizontalScrollSection'] | null;
  mode?: 'steps' | 'services';
  onCtaClick?: () => void;
  /** Overrides the SectionShell background classes — lets the homepage keep
   *  each slot's original color when sections are reordered. */
  background?: string;
};

export function ServicesSection({ section, mode: explicitMode, onCtaClick, background }: Props) {
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

  const services = useMemo(() => portfolioServices || [], [portfolioServices]);

  // startTransition lets the tap's frame paint before React mounts the heavy
  // modal + re-renders the paused carousel — this render used to block the
  // main thread on tap (INP ~300ms).
  const openServiceModal = useCallback((service: PortfolioService) => {
    const idx = services.findIndex((s) => s.id === service.id);
    if (idx >= 0) startTransition(() => setSelectedIndex(idx));
  }, [services]);

  // Stable renderItem so ServicesCarousel's memoized children survive
  // re-renders of this section (e.g. the paused prop flipping on modal open).
  const renderServiceItem = useCallback((service: PortfolioService, idx: number) => (
    <div
      key={`service-${service.id}-${idx}`}
      className="flex-shrink-0 w-[85%] sm:w-[280px] md:w-[260px] tablet:w-[245px]"
    >
      <PortfolioCard
        service={service}
        variant="dark"
        compact
        onClick={() => openServiceModal(service)}
      />
    </div>
  ), [openServiceModal]);

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
      />
    </div>
  ), [stepLabel, whatWeDoLabel, outcomeLabel]);

  if (!section || section.enabled === false) return null;

  const tagLabel = section?.tagLabel || 'Consulting';
  const sectionId = section?.sectionId || 'how-it-works';

  if (displayMode === 'services') {
    if (services.length === 0) return null;

    const selectedService = selectedIndex !== null ? services[selectedIndex] : null;

    const goToPrev = () => {
      if (selectedIndex === null) return;
      setSelectedIndex((selectedIndex - 1 + services.length) % services.length);
    };
    const goToNext = () => {
      if (selectedIndex === null) return;
      setSelectedIndex((selectedIndex + 1) % services.length);
    };

    return (
      <>
        <SectionShell sectionId={sectionId} dark background={background}>
          <ServicesHeader
            tagLabel={tagLabel}
            title={section?.title || ''}
            subtitle={section?.subtitle}
            dark
          />
          <ServicesCarousel
            items={services}
            paused={isModalOpen}
            ariaLabel="Services carousel"
            renderItem={renderServiceItem}
          />
        </SectionShell>

        {selectedService && (
          <ServiceDetailModal
            service={selectedService}
            isOpen={isModalOpen}
            onClose={() => setSelectedIndex(null)}
            onCta={() => {
              setSelectedIndex(null);
              if (onCtaClick) onCtaClick();
            }}
            onPrev={services.length > 1 ? goToPrev : undefined}
            onNext={services.length > 1 ? goToNext : undefined}
            variant="dark"
          />
        )}
      </>
    );
  }

  if (sortedSteps.length === 0) return null;

  return (
    <SectionShell sectionId={sectionId} background={background}>
      <ServicesHeader
        tagLabel={tagLabel}
        title={section?.title || ''}
        subtitle={section?.subtitle}
      />
      <ServicesCarousel
        items={sortedSteps}
        ariaLabel="Consulting steps"
        dark={false}
        renderItem={renderStepItem}
      />
    </SectionShell>
  );
}

function SectionShell({ sectionId, children, dark = false, background }: { sectionId: string; children: React.ReactNode; dark?: boolean; background?: string }) {
  return (
    <section
      id={sectionId}
      className={`relative pt-[4.25rem] pb-[4.25rem] overflow-hidden ${background || (dark ? 'bg-gradient-to-b from-[#0a0f18] to-[#0d1320]' : 'bg-gradient-to-br from-[#f7f9fc] via-white to-[#eaf1ff]')}`}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute w-80 h-80 blur-3xl -left-20 top-0 rounded-full ${dark ? 'bg-primary/10' : 'bg-primary/5'}`} />
        <div className={`absolute w-[420px] h-[420px] blur-3xl right-[-10%] bottom-[-20%] rounded-full ${dark ? 'bg-indigo-500/20' : 'bg-indigo-200/30'}`} />
      </div>
      <div className="relative z-10 space-y-[2.125rem]">
        {children}
      </div>
    </section>
  );
}
