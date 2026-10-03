import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { PRODUCT_CARDS } from "@shared/products";
import { Band, EditorialCard } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { SectionHeadingRow } from "@/components/portfolio/SectionHeadingRow";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

/** The things we make for the counter. Each card is one link to its own page. */
export function PortfolioProducts({ seeAllHref, hideHeading }: { seeAllHref?: string; hideHeading?: boolean }) {
  const { t } = useTranslation();
  return (
    <Band tone="dark" id="products" className="scroll-mt-[calc(var(--nav-offset)+1rem)]">
      {!hideHeading && (
        <SectionHeadingRow seeAllHref={seeAllHref}>
          <SectionHeading
            variant="editorial"
            eyebrow="03 · Products"
            title="Things we make for your counter"
            subtitle="Two things, each with its own page."
          />
        </SectionHeadingRow>
      )}
      <div className={cn(!hideHeading && "mt-12", "grid gap-5 sm:grid-cols-2")}>
        {PRODUCT_CARDS.map((product) => (
          <article key={product.slug} className="group relative">
            <EditorialCard
              tone="dark"
              className="flex h-full flex-col overflow-hidden p-0 transition group-hover:-translate-y-1 group-hover:border-cta-soft/40 sm:p-0"
            >
              {/* Transparent product cut-outs, contained on a panel so both
                  products sit at the same scale whatever their shape. */}
              <div className="relative aspect-[16/10] w-full bg-[radial-gradient(ellipse_at_center,rgba(81,115,214,0.16),transparent_70%)]">
                <img
                  src={product.image.src}
                  alt={t(product.image.alt)}
                  className="absolute inset-0 h-full w-full object-contain p-6 drop-shadow-2xl transition duration-300 group-hover:scale-[1.03] sm:p-8"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="flex flex-1 flex-col border-t border-white/10 p-6">
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
        ))}
      </div>
    </Band>
  );
}
