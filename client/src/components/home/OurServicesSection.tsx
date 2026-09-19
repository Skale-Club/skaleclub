import { startTransition, useCallback, useMemo, useState } from 'react';
import type { HomepageContent } from '@shared/schema';
import { catalogServices, type CatalogItem } from '@shared/catalog';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogDetail } from '@/components/catalog/CatalogDetail';
import { ServicesCarousel } from '@/components/home/ServicesCarousel';
import { SectionHeading } from '@/components/layout/SectionHeading';
import { LayoutGrid } from 'lucide-react';

type OurServicesSectionData = NonNullable<HomepageContent['ourServicesSection']>;

/**
 * Dark "Our Services" section. Admin-managed via the Website editor
 * (homepageContent.ourServicesSection) — a single content instance shared by
 * every usage (homepage + `ourServices` page-builder sections), so edits
 * apply everywhere at once. Same CatalogCard and CatalogDetail as the apps.
 */
export function OurServicesSection({ section, onCtaClick }: {
  section?: OurServicesSectionData;
  /** Opens the lead form. Without it the popup shows no CTA. */
  onCtaClick?: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const items = useMemo(() => catalogServices(section?.cards), [section?.cards]);

  // startTransition lets the tap's frame paint before React mounts the popup
  // and re-renders the paused carousel (INP fix).
  const openCard = useCallback((item: CatalogItem) => {
    const idx = items.findIndex((i) => i.key === item.key);
    if (idx >= 0) startTransition(() => setSelectedIndex(idx));
  }, [items]);

  // Stable renderItem so ServicesCarousel's memoized children survive
  // re-renders of this section (e.g. the paused prop flipping on popup open).
  const renderCardItem = useCallback((item: CatalogItem, idx: number) => (
    <div key={`${item.key}-${idx}`} className="flex-shrink-0 w-[85%] sm:w-[280px] md:w-[260px] tablet:w-[245px]">
      <CatalogCard item={item} variant="compact" onOpen={openCard} />
    </div>
  ), [openCard]);

  if (!section?.enabled || items.length === 0) return null;

  return (
    // Gradient (not surface-dark): this section sits in the homepage's second
    // dark slot — the slot colors stayed put when the sections swapped order.
    <section id="our-services" className="bg-dark-gradient text-white overflow-hidden section-y">
      <div className="space-y-[2.125rem]">
        <div className="container-custom mx-auto">
          <SectionHeading
            eyebrow="What we do"
            icon={LayoutGrid}
            title={section.title || 'Our Services'}
            subtitle={section.subtitle}
          />
        </div>

        <ServicesCarousel
          items={items}
          paused={selectedIndex !== null}
          ariaLabel="Our services carousel"
          renderItem={renderCardItem}
          speed={0.42}
        />
      </div>

      <CatalogDetail
        items={items}
        index={selectedIndex}
        onIndexChange={setSelectedIndex}
        onClose={() => setSelectedIndex(null)}
        onCta={onCtaClick ? () => { setSelectedIndex(null); onCtaClick(); } : undefined}
      />
    </section>
  );
}
