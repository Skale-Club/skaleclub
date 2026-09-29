import { MapPin, ArrowRight } from "lucide-react";
import type { HomepageContent } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Band, PillLink } from "@/components/editorial";
import { usePagePaths } from "@/lib/pagePaths";

interface AreasServedMapProps {
  mapEmbedUrl?: string | null;
  content?: HomepageContent['areasServedSection'] | null;
}

function normalizeEmbedUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Admin UI asks for the iframe `src`, but users sometimes paste the full <iframe ...> snippet.
  if (/<iframe\b/i.test(trimmed)) {
    const srcMatch = trimmed.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcMatch?.[1]) return srcMatch[1].trim();
    return '';
  }

  // Sometimes people paste `src="..."` without the iframe wrapper.
  const bareSrcMatch = trimmed.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  if (bareSrcMatch?.[1]) return bareSrcMatch[1].trim();

  return trimmed;
}

export function AreasServedMap({ mapEmbedUrl, content }: AreasServedMapProps) {
  const { t } = useTranslation();
  const pagePaths = usePagePaths();
  const sectionContent = content || {};

  const embedUrl = normalizeEmbedUrl(mapEmbedUrl || "");

  return (
    <Band tone="dark" id="areas-served" className="border-t border-white/10">
      <div className={`grid grid-cols-1 gap-[2.55rem] items-center ${embedUrl ? "tablet:grid-cols-2" : ""}`}>
        <div>
          <SectionHeading
            variant="editorial"
            eyebrow={sectionContent?.label}
            icon={MapPin}
            title={sectionContent?.heading || ''}
            subtitle={sectionContent?.description}
            className="mb-[2.125rem]"
          />

          {sectionContent?.ctaText ? (
            <div className="mb-[0.85rem]">
              <PillLink href={pagePaths.contact} size="sm">
                {t(sectionContent.ctaText)}
                <ArrowRight className="w-4 h-4" />
              </PillLink>
            </div>
          ) : null}
        </div>
        
        {/* Only with an embed URL: an empty bordered 450px box read as a
            broken section on the homepage. */}
        {embedUrl ? (
          <div className="h-[450px] overflow-hidden border border-white/10 tablet:col-span-1 relative">
            <iframe
              src={embedUrl}
              title="Google Maps"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        ) : null}
      </div>
    </Band>
  );
}
