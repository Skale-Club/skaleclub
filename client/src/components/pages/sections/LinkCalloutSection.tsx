// `linkCallout` section type: one quiet band that points to a second-level page,
// e.g. the keychain landing pointing at its full guide. A short eyebrow, one
// line, one link; deliberately smaller than a CTA so it never competes with the
// order button.
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { Band, Eyebrow, PillLink } from "@/components/editorial";
import { useTranslation } from "@/hooks/useTranslation";
import { languageHref } from "@/lib/languageRouting";
import { cn } from "@/lib/utils";
import { sectionThemeSchema } from "./sectionTheme";

export const linkCalloutPropsSchema = z.object({
  eyebrow:   z.string().optional(),
  text:      z.string(),
  linkLabel: z.string(),
  // Site path only (the lookahead blocks protocol-relative "//host").
  href:      z.string().regex(/^\/(?![\/\\])[a-z0-9/-]*$/),
  theme:     sectionThemeSchema,
});
type LinkCalloutProps = z.infer<typeof linkCalloutPropsSchema>;

export function LinkCalloutSection({ props }: { props: LinkCalloutProps }) {
  const { t } = useTranslation();
  const dark = props.theme !== "light";
  return (
    <div data-testid="section-link-callout">
      <Band tone={dark ? "dark" : "cream"} className={cn("py-10 sm:py-12 border-t", dark ? "border-white/10" : "border-ink-700/10")}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
          <div>
            {props.eyebrow && <Eyebrow className={dark ? "text-cta-soft" : "text-cta-ink"}>{t(props.eyebrow)}</Eyebrow>}
            <p className={cn("mt-3 max-w-2xl font-display text-xl font-semibold leading-snug sm:text-2xl", dark ? "text-fog-50" : "text-ink")}>
              {t(props.text)}
            </p>
          </div>
          <PillLink href={languageHref(props.href)} variant="ghost" tone={dark ? "dark" : "light"} className="shrink-0 whitespace-nowrap">
            {t(props.linkLabel)}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </PillLink>
        </div>
      </Band>
    </div>
  );
}
