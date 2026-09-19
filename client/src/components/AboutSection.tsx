import { User, CheckCircle } from "lucide-react";
import type { HomepageContent } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionHeading } from "@/components/layout/SectionHeading";

interface AboutSectionProps {
  content?: HomepageContent['aboutSection'] | null;
  aboutImageUrl?: string | null;
}

export function AboutSection({ content, aboutImageUrl }: AboutSectionProps) {
  const { t } = useTranslation();
  const sectionContent = content || {};

  const highlights = sectionContent?.highlights || [];

  return (
    <div className="container-custom mx-auto">
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-[2.55rem] items-center">
        <div className="order-2 tablet:order-1">
          <SectionHeading
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
                  <CheckCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-white mb-1">{t(highlight.title)}</h3>
                    <p className="text-slate-300">{t(highlight.description)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="order-1 tablet:order-2 aspect-square max-h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
          {aboutImageUrl || sectionContent?.defaultImageUrl ? (
            <img
              src={aboutImageUrl || sectionContent?.defaultImageUrl}
              alt={sectionContent?.heading || ""}
              className="w-full h-full object-cover object-center"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
