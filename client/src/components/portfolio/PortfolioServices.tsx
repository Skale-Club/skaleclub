import { ArrowRight } from "lucide-react";
import { CATALOG_CATEGORY_LABEL, type CatalogItem } from "@shared/catalog";
import { Band, EditorialCard, Eyebrow } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { getImageUrl } from "@/components/admin/shared/utils";
import { useTranslation } from "@/hooks/useTranslation";

export function PortfolioServices({ services, onOpen }: { services: CatalogItem[]; onOpen: (item: CatalogItem) => void }) {
  const { t } = useTranslation();
  if (services.length === 0) return null;
  return (
    <Band tone="dark" id="services" className="scroll-mt-[calc(var(--nav-offset)+1rem)]">
      <SectionHeading
        variant="editorial"
        eyebrow="02 · Services"
        title="Built by us, for your business"
        subtitle="Tailored marketing and technology, quoted for your case."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((item) => {
          const eyebrow = item.category ? t(CATALOG_CATEGORY_LABEL[item.category]) : undefined;
          const description = item.subtitle ?? item.description;
          return (
            <article key={item.key} className="group relative">
            <EditorialCard
              tone="dark"
              className="flex h-full flex-col overflow-hidden p-0 transition group-hover:-translate-y-1 group-hover:border-cta-soft/40 sm:p-0"
            >
              {item.cover && (
                <img
                  src={getImageUrl(item.cover, { width: 720, quality: 80 })}
                  alt=""
                  className="aspect-[16/9] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <div className="flex flex-1 flex-col p-6">
                {eyebrow && <Eyebrow className="mb-3 tracking-[0.2em]">{eyebrow}</Eyebrow>}
                <h3 className="font-display text-2xl font-semibold text-fog-50">{t(item.title)}</h3>
                {description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-fog-400">{t(description)}</p>}
                <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-cta-soft" aria-hidden="true">
                  {t("See details")}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </div>
              <button
                type="button"
                aria-label={t(item.title)}
                onClick={() => onOpen(item)}
                className="absolute inset-0 z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cta-soft"
              />
            </EditorialCard>
            </article>
          );
        })}
      </div>
    </Band>
  );
}
