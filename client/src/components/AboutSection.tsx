import { User, CheckCircle } from "lucide-react";
import type { HomepageContent } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="order-2 lg:order-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-300 text-sm font-medium mb-10">
            <User className="w-4 h-4" />
            {t(sectionContent?.label || '')}
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-10 text-white">
            {t(sectionContent?.heading || "")}
          </h2>

          <p className="text-slate-300 text-lg mb-10 leading-relaxed">
            {t(sectionContent?.description || '')}
          </p>

          {highlights.length > 0 && (
            <div className="space-y-4 mb-8">
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

        <div className="order-1 lg:order-2 aspect-square max-h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
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
