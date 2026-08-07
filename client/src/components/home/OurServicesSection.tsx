import { startTransition, useCallback, useMemo, useState } from 'react';
import type { HomepageContent, PortfolioService } from '@shared/schema';
import { useTranslation } from '@/hooks/useTranslation';
import { PortfolioCard } from '@/components/PortfolioCard';
import { ServicesCarousel } from '@/components/home/ServicesCarousel';
import { OurServiceDetailModal } from '@/components/home/OurServiceDetailModal';

type OurServicesSectionData = NonNullable<HomepageContent['ourServicesSection']>;
type OurServicesCard = NonNullable<OurServicesSectionData['cards']>[number];

/**
 * Dark "Our Services" section. Admin-managed via the Website editor
 * (homepageContent.ourServicesSection) — a single content instance shared by
 * every usage (homepage + `ourServices` page-builder sections), so edits
 * apply everywhere at once. Reuses the portfolio card layout (without the
 * logo icon) inside the shared full-bleed auto-scrolling carousel.
 */
export function OurServicesSection({ section }: { section?: OurServicesSectionData }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<OurServicesCard | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const cards = useMemo(() => (section?.cards || [])
    .filter((c) => c.enabled !== false)
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0)), [section?.cards]);

  // startTransition lets the tap's frame paint before React mounts the modal
  // and re-renders the paused carousel (INP fix).
  const openCard = useCallback((card: OurServicesCard) => {
    startTransition(() => {
      setSelected(card);
      setIsOpen(true);
    });
  }, []);

  // Stable renderItem so ServicesCarousel's memoized children survive
  // re-renders of this section (e.g. the paused prop flipping on modal open).
  const renderCardItem = useCallback((card: OurServicesCard, idx: number) => (
    <div
      key={`our-service-${idx}`}
      className="flex-shrink-0 w-[85%] sm:w-[280px] md:w-[260px] tablet:w-[245px]"
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
        compact
        description={card.description}
        onClick={() => openCard(card)}
      />
    </div>
  ), [openCard]);

  if (!section?.enabled || cards.length === 0) return null;

  return (
    <section id="our-services" className="bg-[#111111] text-white overflow-hidden pt-[4.25rem] pb-[4.25rem]">
      <div className="space-y-[2.125rem]">
        {/* Header — mirrors ServicesHeader spacing + type sizes (dark variant) */}
        <div className="container-custom mx-auto">
          <div className="max-w-4xl space-y-[2.125rem]">
            <h2 className="text-3xl md:text-4xl font-bold leading-tight text-white">
              {t(section.title || 'Our Services')}
            </h2>
            {section.subtitle && (
              <p className="text-lg md:text-xl leading-relaxed text-slate-300">{t(section.subtitle)}</p>
            )}
          </div>
        </div>

        <ServicesCarousel
          items={cards}
          paused={isOpen}
          ariaLabel="Our services carousel"
          renderItem={renderCardItem}
        />
      </div>

      <OurServiceDetailModal card={selected} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </section>
  );
}
