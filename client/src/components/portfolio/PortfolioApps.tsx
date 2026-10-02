import { Check } from "lucide-react";
import { CATALOG_CATEGORY_LABEL, headlineParts, siteDomain, type CatalogItem } from "@shared/catalog";
import { Band, Eyebrow, Figure, PillButton, PillLink } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { SectionHeadingRow } from "@/components/portfolio/SectionHeadingRow";
import { getImageUrl } from "@/components/admin/shared/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { trackCTAClick } from "@/lib/analytics";
import { priceParts } from "@/lib/format";

function AppRow({ item, flip, analyticsSource, onOpen }: { item: CatalogItem; flip: boolean; analyticsSource: string; onOpen: (item: CatalogItem) => void }) {
  const { t, language } = useTranslation();
  const price = item.price ? priceParts(item.price, language, t) : undefined;
  const eyebrow = item.category ? t(CATALOG_CATEGORY_LABEL[item.category]) : undefined;
  const source = item.headline ?? item.subtitle;
  const siteUrl = item.site;
  const siteHref = siteUrl ? (/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`) : undefined;

  return (
    <article className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn(flip && "lg:order-2")}>
        {item.cover ? (
          <Figure
            tone="dark"
            src={getImageUrl(item.cover, { width: 1200, quality: 80 })}
            alt="App home screen"
            caption={item.headline ? item.subtitle : undefined}
            imgClassName="aspect-[16/10] object-top"
          />
        ) : (
          <div className="flex aspect-[16/10] items-center justify-center gap-4 border border-white/10 bg-navy-800 shadow-[0_28px_80px_rgba(0,0,0,.38)]">
            {item.logo && <img src={getImageUrl(item.logo, { width: 96, quality: 90 })} alt="" className="h-12 w-12 object-contain" loading="lazy" />}
            <span className="font-display text-3xl font-semibold text-fog-50">{item.title}</span>
          </div>
        )}
      </div>

      <div>
        {(eyebrow || item.badge) && (
          <Eyebrow>{[eyebrow, item.badge && t(item.badge)].filter(Boolean).join(" · ")}</Eyebrow>
        )}
        <h3 className="mt-4 flex items-center gap-3 font-display text-3xl font-semibold text-fog-50">
          {item.logo && <img src={getImageUrl(item.logo, { width: 96, quality: 90 })} alt="" className="h-9 w-9 object-contain" loading="lazy" />}
          {item.title}
        </h3>
        {source && (
          <p className="mt-3 font-display text-xl font-medium leading-snug text-fog-200">
            {headlineParts(t(source)).map((part, i) =>
              part.highlight ? <em key={i} className="not-italic text-cta-soft">{part.text}</em> : <span key={i}>{part.text}</span>,
            )}
          </p>
        )}
        {item.description && <p className="mt-4 leading-7 text-fog-400">{t(item.description)}</p>}
        {item.features.length > 0 && (
          <ul className="mt-6 space-y-3">
            {item.features.slice(0, 4).map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-fog-300">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-cta-soft" aria-hidden="true" />
                {t(feature)}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {/* Self-serve apps (those with a tool URL) lead with Start; the lead
              form stays one click away inside the details popup. */}
          {siteHref && (
            <PillLink
              href={siteHref}
              target="_blank"
              variant="primary"
              aria-label={siteDomain(siteUrl) ? `${t("Start")} ${siteDomain(siteUrl)}` : undefined}
              onClick={() => trackCTAClick(`${analyticsSource}-start-${item.slug ?? item.key}`, item.slug ?? item.key)}
            >
              {t("Start")} <span aria-hidden="true">↗</span>
            </PillLink>
          )}
          <PillButton variant="ghost" onClick={() => onOpen(item)}>
            {t("See details")}
          </PillButton>
          <span className="ml-auto font-display text-xl font-semibold text-fog-50">
            {price ? (
              <>
                {price.prefix && <small className="mr-1 text-sm font-normal text-fog-400">{price.prefix}</small>}
                {price.value}
                {price.suffix && <small className={cn("text-sm font-normal text-fog-400", price.tight ? "ml-0" : "ml-1")}>{price.suffix}</small>}
              </>
            ) : (
              t("Start here")
            )}
          </span>
        </div>
      </div>
    </article>
  );
}

export function PortfolioApps({
  apps,
  onOpen,
  source = "portfolio",
  seeAllHref,
  hideHeading,
}: {
  apps: CatalogItem[];
  onOpen: (item: CatalogItem) => void;
  /** Prefix of the analytics name of the Start links. */
  source?: string;
  /** Adds a "See all" link to the section heading (the /portfolio umbrella). */
  seeAllHref?: string;
  /** For /apps, whose hero already says what the heading would. */
  hideHeading?: boolean;
}) {
  if (apps.length === 0) return null;
  return (
    <>
      {!hideHeading && (
        <Band tone="dark" id="apps" className="scroll-mt-[calc(var(--nav-offset)+1rem)] pb-10 sm:pb-14">
          <SectionHeadingRow seeAllHref={seeAllHref}>
            <SectionHeading
              variant="editorial"
              eyebrow="01 · Apps"
              title="Apps we build and run"
              subtitle="Our own products, live today, with a fixed price. Subscribe and start."
            />
          </SectionHeadingRow>
        </Band>
      )}
      {/* Each app is its own full-bleed band; alternating navy steps plus a
          hairline keep the rows readable as separate products. */}
      {apps.map((item, i) => (
        <Band
          key={item.key}
          tone="dark"
          className={cn(
            "py-16 sm:py-20",
            (i > 0 || !hideHeading) && "border-t border-white/10",
            i % 2 === 0 && "bg-navy-900",
          )}
        >
          <AppRow item={item} flip={i % 2 === 1} analyticsSource={source} onOpen={onOpen} />
        </Band>
      ))}
    </>
  );
}
