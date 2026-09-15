import { MapPin, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { HomepageContent } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionHeading } from "@/components/layout/SectionHeading";
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
    <div className="container-custom mx-auto">
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-[2.55rem] items-center">
        <div>
          <SectionHeading
            eyebrow={sectionContent?.label}
            icon={MapPin}
            title={sectionContent?.heading || ''}
            subtitle={sectionContent?.description}
            className="mb-[2.125rem]"
          />

          {sectionContent?.ctaText ? (
            <div className="mb-[0.85rem]">
              <Link href={pagePaths.contact}>
                <button className="px-4 py-2 bg-cta hover:bg-cta-hover text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/40 focus-visible:ring-offset-2">
                  {t(sectionContent.ctaText)}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          ) : null}
        </div>
        
        <div className="h-[450px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 tablet:col-span-1 relative">
          {embedUrl ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
