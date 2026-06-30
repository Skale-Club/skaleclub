import { useState } from 'react';
import type { HomepageContent, PortfolioService } from '@shared/schema';
import { useTranslation } from '@/hooks/useTranslation';
import { PortfolioCard } from '@/components/PortfolioCard';
import { ServicesCarousel } from '@/components/home/ServicesCarousel';
import { OurServiceDetailModal } from '@/components/home/OurServiceDetailModal';

type OurServicesSectionData = NonNullable<HomepageContent['ourServicesSection']>;
type OurServicesCard = NonNullable<OurServicesSectionData['cards']>[number];

/**
 * Dark "Our Services" homepage section. Admin-managed via the Website editor
 * (homepageContent.ourServicesSection). Reuses the portfolio card layout
 * (without the logo icon) inside the shared auto-scrolling carousel.
 */
export function OurServicesSection({ section }: { section?: OurServicesSectionData }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<OurServicesCard | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const cards = (section?.cards || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!section?.enabled || cards.length === 0) return null;

  const openCard = (card: OurServicesCard) => {
    setSelected(card);
    setIsOpen(true);
  };

  return (
    <section id="our-services" className="bg-[#111111] text-white overflow-hidden py-16 md:py-20">
      <div className="container-custom mx-auto mb-10 md:mb-14 text-center px-4">
        <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">{t(section.title || 'Our Services')}</h2>
        {section.subtitle && (
          <p className="text-slate-300 max-w-2xl mx-auto text-lg">{t(section.subtitle)}</p>
        )}
      </div>

      <ServicesCarousel
        items={cards}
        paused={isOpen}
        ariaLabel="Our services carousel"
        renderItem={(card, idx) => (
          <div
            key={`our-service-${idx}`}
            className="flex-shrink-0 w-full sm:w-[70%] md:w-[52%] lg:w-[36%] xl:w-[30%]"
          >
            <PortfolioCard
              service={{
                id: idx,
                title: card.title,
                subtitle: card.subtitle ?? '',
                imageUrl: card.imageUrl ?? null,
                logoIconUrl: null,
                features: card.features ?? [],
              } as unknown as PortfolioService}
              variant="dark"
              onClick={() => openCard(card)}
            />
          </div>
        )}
      />

      <OurServiceDetailModal card={selected} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </section>
  );
}
