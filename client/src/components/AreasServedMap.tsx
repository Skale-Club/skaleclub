import { MapPin, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { HomepageContent } from "@shared/schema";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";

const DEFAULT_MAP_EMBED_URL =
  "https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d259505.12434421625!2d-71.37915684523166!3d42.296281796774615!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1767905922570!5m2!1sen!2sus";

interface AreasServedMapProps {
  mapEmbedUrl?: string | null;
  content?: HomepageContent['areasServedSection'] | null;
}

export function AreasServedMap({ mapEmbedUrl, content }: AreasServedMapProps) {
  const sectionContent = {
    ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
    ...(content || {}),
  };

  const embedUrl = mapEmbedUrl || DEFAULT_MAP_EMBED_URL;

  return (
    <div className="container-custom mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-medium mb-6">
            <MapPin className="w-4 h-4" />
            {sectionContent?.label || DEFAULT_HOMEPAGE_CONTENT.areasServedSection?.label}
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            {sectionContent?.heading || DEFAULT_HOMEPAGE_CONTENT.areasServedSection?.heading}
          </h2>
          
          <p className="text-slate-600 text-lg mb-8 leading-relaxed">
            {sectionContent?.description || DEFAULT_HOMEPAGE_CONTENT.areasServedSection?.description}
          </p>

          <div className="mb-4">
            <Link href="/services">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5">
                {sectionContent?.ctaText || DEFAULT_HOMEPAGE_CONTENT.areasServedSection?.ctaText}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
        
        <div className="h-[450px] rounded-2xl overflow-hidden shadow-2xl border border-slate-100 lg:col-span-1 relative">
          <iframe
            src={embedUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen={true}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
      </div>
    </div>
  );
}
