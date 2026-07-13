import { useMemo, useState } from 'react';
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
};

export function ServicesSection({ section, mode: explicitMode, onCtaClick }: Props) {
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

  if (!section || section.enabled === false) return null;

  const tagLabel = section?.tagLabel || 'Consulting';
  const sectionId = section?.sectionId || 'how-it-works';
  const stepLabel = section?.stepLabel || '';
  const whatWeDoLabel = section?.whatWeDoLabel || '';
  const outcomeLabel = section?.outcomeLabel || '';

  if (displayMode === 'services') {
    const services = portfolioServices || [];
    if (services.length === 0) return null;

    const selectedService = selectedIndex !== null ? services[selectedIndex] : null;

    const openServiceModal = (service: PortfolioService) => {
      const idx = services.findIndex((s) => s.id === service.id);
      if (idx >= 0) setSelectedIndex(idx);
    };
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
        <SectionShell sectionId={sectionId} dark>
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
            renderItem={(service, idx) => (
              <div
                key={`service-${service.id}-${idx}`}
                className="flex-shrink-0 w-[85%] sm:w-[280px] md:w-[260px] lg:w-[250px] xl:w-[245px]"
              >
                <PortfolioCard
                  service={service}
                  variant="dark"
                  compact
                  onClick={() => openServiceModal(service)}
                  className="!border-[rgba(64,110,241,0.25)] hover:!border-[rgba(64,110,241,0.5)]"
                />
              </div>
            )}
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
    <SectionShell sectionId={sectionId}>
      <ServicesHeader
        tagLabel={tagLabel}
        title={section?.title || ''}
        subtitle={section?.subtitle}
      />
      <ServicesCarousel
        items={sortedSteps}
        ariaLabel="Consulting steps"
        dark={false}
        renderItem={(step, idx) => (
          <div key={`${step.numberLabel}-${step.title}-${idx}`}>
            <StepCard
              step={step}
              index={idx}
              stepLabel={stepLabel}
              whatWeDoLabel={whatWeDoLabel}
              outcomeLabel={outcomeLabel}
            />
          </div>
        )}
      />
    </SectionShell>
  );
}

function SectionShell({ sectionId, children, dark = false }: { sectionId: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <section
      id={sectionId}
      className={`relative pt-20 pb-20 overflow-hidden ${dark ? 'bg-gradient-to-b from-[#0a0f18] to-[#0d1320]' : 'bg-gradient-to-br from-[#f7f9fc] via-white to-[#eaf1ff]'}`}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute w-80 h-80 blur-3xl -left-20 top-0 rounded-full ${dark ? 'bg-primary/10' : 'bg-primary/5'}`} />
        <div className={`absolute w-[420px] h-[420px] blur-3xl right-[-10%] bottom-[-20%] rounded-full ${dark ? 'bg-indigo-500/20' : 'bg-indigo-200/30'}`} />
      </div>
      <div className="relative z-10 space-y-10">
        {children}
      </div>
    </section>
  );
}
