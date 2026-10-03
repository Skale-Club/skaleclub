// `pricingPlans` section type: a few side-by-side plan cards (name, what it is,
// the price rule, what is included, a worked example, a button). For products
// whose price is a rule rather than one unit price, e.g. the NFC plaque's
// standard "$49, or 2 for $79" against custom "$89 first, $49 each". Copy is
// t()-based English like every managed section; seeds build the numbers from
// the product's pricing file so a card never quotes what the form does not.
import { z } from "zod";
import { ArrowRight, Check } from "lucide-react";
import { Band, EditorialCard, Eyebrow, PillButton } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { sectionThemeSchema } from "./sectionTheme";

const planSchema = z.object({
  name:      z.string(),
  title:     z.string(),
  imageUrl:  z.string().regex(/^\/(?![\/\\])/).optional(),
  imageAlt:  z.string().optional(),
  price:     z.string(),
  priceUnit: z.string().optional(),
  priceNote: z.string().optional(),
  features:  z.array(z.string()).max(6).optional(),
  example:   z.string().optional(),
  highlight: z.boolean().optional(),
});

export const pricingPlansPropsSchema = z.object({
  eyebrow:    z.string().optional(),
  heading:    z.string().optional(),
  subheading: z.string().optional(),
  plans:      z.array(planSchema).min(1).max(3),
  // Label of each card's button; it opens the page's lead form (the same
  // trigger the hero button uses). Omit for cards without a button.
  ctaLabel:   z.string().optional(),
  footnote:   z.string().optional(),
  anchorId:   z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
  theme:      sectionThemeSchema,
});
type PricingPlansProps = z.infer<typeof pricingPlansPropsSchema>;

const openLeadForm = () => {
  document.querySelector<HTMLElement>("[data-landing-lead-cta]")?.click();
};

export function PricingPlansSection({ props }: { props: PricingPlansProps }) {
  const { t } = useTranslation();
  const dark = props.theme !== "light";

  return (
    <div data-testid="section-pricing-plans">
      <Band tone={dark ? "dark" : "cream"} id={props.anchorId} className="scroll-mt-24">
        <SectionHeading
          variant="editorial"
          tone={dark ? "dark" : "light"}
          eyebrow={props.eyebrow ?? "Pricing"}
          title={props.heading ?? "Simple, upfront pricing"}
          subtitle={props.subheading}
        />
        <div className={cn("mt-12 grid gap-5", props.plans.length > 1 && "md:grid-cols-2", props.plans.length > 2 && "lg:grid-cols-3")}>
          {props.plans.map((plan) => (
            <EditorialCard
              key={plan.name}
              tone={dark ? "dark" : "light"}
              className={cn("group flex flex-col", plan.highlight && (dark ? "border-cta-soft/50" : "border-cta-ink/40"))}
            >
              <Eyebrow className={dark ? "text-cta-soft" : "text-cta-ink"}>{t(plan.name)}</Eyebrow>
              <h3 className={cn("mt-3 font-display text-2xl font-semibold", dark ? "text-fog-50" : "text-ink")}>{t(plan.title)}</h3>

              {plan.imageUrl && (
                <figure
                  className={cn(
                    "relative mt-5 h-44 overflow-hidden border sm:h-48",
                    dark
                      ? "border-white/10 bg-[radial-gradient(circle_at_50%_30%,rgba(103,136,230,0.18),rgba(255,255,255,0.025)_62%)]"
                      : "border-ink-700/10 bg-[radial-gradient(circle_at_50%_30%,rgba(72,105,200,0.12),rgba(11,20,36,0.025)_62%)]",
                  )}
                >
                  <img
                    src={plan.imageUrl}
                    alt={t(plan.imageAlt ?? plan.title)}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain px-5 py-2 transition-transform duration-500 ease-out group-hover:scale-[1.025]"
                  />
                </figure>
              )}

              <p className={cn("flex items-baseline gap-2", plan.imageUrl ? "mt-5" : "mt-6")}>
                <span className={cn("font-display text-5xl font-semibold tabular-nums tracking-[-0.03em]", dark ? "text-fog-50" : "text-ink")}>
                  {t(plan.price)}
                </span>
                {plan.priceUnit && <span className={cn("text-sm", dark ? "text-fog-400" : "text-ink-500")}>{t(plan.priceUnit)}</span>}
              </p>
              {plan.priceNote && (
                <p className={cn("mt-2 text-sm font-medium", dark ? "text-fog-200" : "text-ink-700")}>{t(plan.priceNote)}</p>
              )}

              {plan.features && plan.features.length > 0 && (
                <ul className={cn("mt-6 space-y-3 border-t pt-6", dark ? "border-white/10" : "border-ink-700/10")}>
                  {plan.features.map((feature) => (
                    <li key={feature} className={cn("flex items-start gap-3 text-sm leading-6", dark ? "text-fog-300" : "text-ink-500")}>
                      <Check className={cn("mt-0.5 h-5 w-5 shrink-0", dark ? "text-cta-soft" : "text-cta-ink")} aria-hidden="true" />
                      {t(feature)}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-auto pt-8">
                {plan.example && (
                  <p className={cn("mb-4 text-xs tabular-nums", dark ? "text-fog-400" : "text-ink-400")}>{t(plan.example)}</p>
                )}
                {props.ctaLabel && (
                  <PillButton variant={plan.highlight ? "primary" : "ghost"} tone={dark ? "dark" : "light"} onClick={openLeadForm} className="w-full">
                    {t(props.ctaLabel)}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </PillButton>
                )}
              </div>
            </EditorialCard>
          ))}
        </div>
        {props.footnote && (
          <p className={cn("mt-8 text-center text-sm", dark ? "text-fog-400" : "text-ink-500")}>{t(props.footnote)}</p>
        )}
      </Band>
    </div>
  );
}
