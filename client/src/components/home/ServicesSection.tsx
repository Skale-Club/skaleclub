import type { MouseEvent } from 'react';
import { useMemo, useState } from 'react';
import type { HomepageContent, PortfolioService } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { PortfolioCard } from '@/components/PortfolioCard';
import { ServicesHeader } from '@/components/home/ServicesHeader';
import { ServicesCarousel } from '@/components/home/ServicesCarousel';
import { PracticalBlock } from '@/components/home/PracticalBlock';
import { StepCard } from '@/components/home/StepCard';
import type { StepItem } from '@/components/home/StepCard';
import { ServiceDetailModal } from '@/components/home/ServiceDetailModal';

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

  const [selectedService, setSelectedService] = useState<PortfolioService | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const practicalBullets = section?.practicalBullets?.length ? section.practicalBullets : [];
  const ctaLabel = section?.ctaButtonLabel || '';
  const ctaHref = section?.ctaButtonLink || '#lead-form';
  const helperText = section?.helperText;
  const tagLabel = section?.tagLabel || 'Consulting';
  const sectionId = section?.sectionId || 'how-it-works';
  const practicalTitle = section?.practicalBlockTitle || '';
  const stepLabel = section?.stepLabel || '';
  const whatWeDoLabel = section?.whatWeDoLabel || '';
  const outcomeLabel = section?.outcomeLabel || '';
  const practicalBlockSubtitle = section?.practicalBlockSubtitle || '';
  const nextStepLabel = section?.nextStepLabel || '';
  const nextStepText = section?.nextStepText || '';

  const handleCta = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onCtaClick) {
      event.preventDefault();
      onCtaClick();
    }
  };

  const openServiceModal = (service: PortfolioService) => {
    setSelectedService(service);
    setIsModalOpen(true);
  };

  if (displayMode === 'services') {
    const services = portfolioServices || [];
    if (services.length === 0) return null;

    return (
      <>
        <SectionShell sectionId={sectionId}>
          <ServicesHeader
            tagLabel={tagLabel}
            title={section?.title || ''}
            subtitle={section?.subtitle}
          />
          <ServicesCarousel
            items={services}
            ariaLabel="Services carousel"
            renderItem={(service, idx) => (
              <div
                key={`service-${service.id}-${idx}`}
                className="flex-shrink-0 w-full sm:w-[70%] md:w-[52%] lg:w-[36%] xl:w-[30%]"
              >
                <PortfolioCard
                  service={service}
                  variant="light"
                  onClick={() => openServiceModal(service)}
                />
              </div>
            )}
          />
          <PracticalBlock
            title={practicalTitle}
            subtitle={practicalBlockSubtitle}
            bullets={practicalBullets}
            nextStepLabel={nextStepLabel}
            nextStepText={nextStepText}
            ctaHref={ctaHref}
            ctaLabel={ctaLabel}
            helperText={helperText}
            onCtaClick={handleCta}
          />
        </SectionShell>

        <ServiceDetailModal
          service={selectedService}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCta={() => {
            if (onCtaClick) onCtaClick();
          }}
        />
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
      <PracticalBlock
        title={practicalTitle}
        subtitle={practicalBlockSubtitle}
        bullets={practicalBullets}
        nextStepLabel={nextStepLabel}
        nextStepText={nextStepText}
        ctaHref={ctaHref}
        ctaLabel={ctaLabel}
        helperText={helperText}
        onCtaClick={handleCta}
      />
    </SectionShell>
  );
}

function SectionShell({ sectionId, children }: { sectionId: string; children: React.ReactNode }) {
  return (
    <section
      id={sectionId}
      className="relative pt-0 pb-14 md:pb-16 bg-gradient-to-br from-[#f7f9fc] via-white to-[#eaf1ff] overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-80 h-80 bg-primary/5 blur-3xl -left-20 top-0 rounded-full" />
        <div className="absolute w-[420px] h-[420px] bg-indigo-200/30 blur-3xl right-[-10%] bottom-[-20%] rounded-full" />
      </div>
      {/* Heavy top padding on mobile to guard against the absolute overlay half (-translate-y-1/2) */}
      <div className="relative z-10 pt-64 sm:pt-[22rem] md:pt-48 lg:pt-24 space-y-6 md:space-y-8 pb-4 md:pb-8">
        {children}
      </div>
    </section>
  );
}
