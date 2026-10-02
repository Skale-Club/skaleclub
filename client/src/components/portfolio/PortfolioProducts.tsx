import { ArrowRight, KeyRound, Nfc } from "lucide-react";
import { Link } from "wouter";
import { PRODUCT_CARDS } from "@shared/products";
import { Band, EditorialCard } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { SectionHeadingRow } from "@/components/portfolio/SectionHeadingRow";
import { useTranslation } from "@/hooks/useTranslation";

// The plaque has no photo of its own yet, so its card carries the icon instead.
const PRODUCT_ICONS = { "nfc-review-plaque": Nfc, "nfc-keychains": KeyRound } as const;

/** The things we make for the counter. Each card is one link to its own page. */
export function PortfolioProducts({ seeAllHref }: { seeAllHref?: string }) {
  const { t } = useTranslation();
  return (
    <Band tone="dark" id="products" className="scroll-mt-[calc(var(--nav-offset)+1rem)]">
      <SectionHeadingRow seeAllHref={seeAllHref}>
        <SectionHeading
          variant="editorial"
          eyebrow="03 · Products"
          title="Things we make for your counter"
          subtitle="Two things, each with its own page."
        />
      </SectionHeadingRow>
      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {PRODUCT_CARDS.map((product) => {
          const Icon = PRODUCT_ICONS[product.slug as keyof typeof PRODUCT_ICONS];
          return (
            <article key={product.slug} className="group relative">
              <EditorialCard
                tone="dark"
                className="flex h-full flex-col overflow-hidden p-0 transition group-hover:-translate-y-1 group-hover:border-cta-soft/40 sm:p-0"
              >
                {product.image ? (
                  <img
                    src={product.image.src}
                    alt={t(product.image.alt)}
                    className="aspect-[16/9] w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex aspect-[16/9] w-full items-center justify-center bg-navy-900" aria-hidden="true">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "rgba(81,115,214,0.14)" }}>
                      {Icon && <Icon className="h-8 w-8 text-cta-soft" />}
                    </span>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-2xl font-semibold text-fog-50">{t(product.title)}</h3>
                  <p className="mt-3 text-sm leading-6 text-fog-400">{t(product.description)}</p>
                  <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-cta-soft" aria-hidden="true">
                    {t("See details")}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </div>
                <Link
                  href={product.href}
                  aria-label={t(product.title)}
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
