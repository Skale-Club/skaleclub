import { User, CheckCircle } from "lucide-react";
import type { HomepageContent } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Band, Figure, type BandTone } from "@/components/editorial";

interface AboutSectionProps {
  content?: HomepageContent['aboutSection'] | null;
  aboutImageUrl?: string | null;
  /** Home renders this on a white band so the second half of the page keeps
   *  alternating; the landing adapter keeps the dark default. */
  tone?: "dark" | "light";
  /** Overrides the band background (e.g. a blue step on the home); text follows `tone`. */
  band?: BandTone;
}

export function AboutSection({ content, aboutImageUrl, tone = "dark", band }: AboutSectionProps) {
  const { t } = useTranslation();
  const sectionContent = content || {};
  const light = tone === "light";

  const highlights = sectionContent?.highlights || [];

  return (
    <Band tone={band ?? (light ? "white" : "dark")} id="about">
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-[2.55rem] items-center">
        <div className="order-2 tablet:order-1">
          <SectionHeading
            variant="editorial"
            tone={tone}
            eyebrow={sectionContent?.label}
            icon={User}
            title={sectionContent?.heading || ''}
            subtitle={sectionContent?.description}
            className="mb-[2.125rem]"
          />

          {highlights.length > 0 && (
            <div className="space-y-[0.85rem] mb-[1.7rem]">
              {highlights.map((highlight, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className={`w-6 h-6 shrink-0 mt-0.5 ${light ? "text-cta-ink" : "text-cta-soft"}`} />
                  <div>
                    <h3 className={`font-display font-semibold mb-1 ${light ? "text-ink" : "text-fog-50"}`}>{t(highlight.title)}</h3>
                    <p className={light ? "text-ink-500" : "text-fog-300"}>{t(highlight.description)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="order-1 tablet:order-2">
          {aboutImageUrl || sectionContent?.defaultImageUrl ? (
            <Figure
              src={aboutImageUrl || sectionContent?.defaultImageUrl || ""}
              alt={sectionContent?.heading || ""}
              tone={light ? "light" : "dark"}
              className="max-h-[500px]"
              imgClassName="aspect-square max-h-[500px] object-center"
            />
          ) : null}
        </div>
      </div>
    </Band>
  );
}
