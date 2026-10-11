import { startTransition, useCallback, useMemo, useState } from 'react';
import type { HomepageContent } from '@shared/schema';
import { catalogServices, type CatalogItem } from '@shared/catalog';
import { CatalogCard } from '@/components/catalog/CatalogCard';
import { CatalogDetail } from '@/components/catalog/CatalogDetail';
import { ServicesCarousel } from '@/components/home/ServicesCarousel';
import { SectionHeading } from '@/components/layout/SectionHeading';
import { Band } from '@/components/editorial';
import { LayoutGrid } from 'lucide-react';

type OurServicesSectionData = NonNullable<HomepageContent['ourServicesSection']>;

/**
 * Dark "Our Services" section. Admin-managed via the Website editor
 * (homepageContent.ourServicesSection) — a single content instance shared by
 * every usage (homepage + `ourServices` page-builder sections), so edits
 * apply everywhere at once. Same CatalogCard and CatalogDetail as the apps.
 */
export function OurServicesSection({ section, onCtaClick, itemsOverride, eyebrow }: {
  section?: OurServicesSectionData;
  /** Opens the lead form. Without it the popup shows no CTA. */
  onCtaClick?: () => void;
  /** Optional curated subset; the homepage still falls back to section.cards. */
  itemsOverride?: CatalogItem[];
  eyebrow?: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const catalogItems = useMemo(() => catalogServices(section?.cards), [section?.cards]);
  const items = itemsOverride ?? catalogItems;

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
    <Band tone="dark" id="our-services" className="overflow-hidden" containerClassName="section-content-stack">
      <SectionHeading
        variant="editorial"
        eyebrow={eyebrow ?? "What we do"}
        icon={LayoutGrid}
        title={section.title || 'Our Services'}
        subtitle={section.subtitle}
      />

      <ServicesCarousel
        items={items}
        paused={selectedIndex !== null}
        ariaLabel="Our services carousel"
        renderItem={renderCardItem}
        speed={0.42}
      />

      <CatalogDetail
        items={items}
        index={selectedIndex}
        onIndexChange={setSelectedIndex}
        onClose={() => setSelectedIndex(null)}
        onCta={onCtaClick ? () => { setSelectedIndex(null); onCtaClick(); } : undefined}
      />
    </Band>
  );
}
