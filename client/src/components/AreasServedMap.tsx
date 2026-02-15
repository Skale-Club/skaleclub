import { MapPin, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { HomepageContent } from "@shared/schema";

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
  const sectionContent = content || {};

  const embedUrl = normalizeEmbedUrl(mapEmbedUrl || "");

  return (
    <div className="container-custom mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-medium mb-6">
            <MapPin className="w-4 h-4" />
            {sectionContent?.label || ""}
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            {sectionContent?.heading || ""}
          </h2>
          
          <p className="text-slate-600 text-lg mb-8 leading-relaxed">
            {sectionContent?.description || ""}
          </p>

          {sectionContent?.ctaText ? (
            <div className="mb-4">
              <Link href="/contact">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5">
                  {sectionContent.ctaText}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          ) : null}
        </div>
        
        <div className="h-[450px] rounded-2xl overflow-hidden shadow-2xl border border-slate-100 lg:col-span-1 relative">
          {embedUrl ? (
            <iframe
              src={embedUrl}
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
