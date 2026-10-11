import { useEffect, useMemo, useRef, useState } from "react";
import { Star } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Band } from "@/components/editorial";
import {
  parseLegacyReviewsEmbed,
  type ReviewsXphereConfig,
} from "@shared/reviews-embed";

export type { ReviewsXphereConfig } from "@shared/reviews-embed";

interface ReviewsSectionProps {
  xphere?: ReviewsXphereConfig;
  /** Deprecated: retained while stored pages move to the structured config. */
  embedUrl?: string;
  title?: string;
  subtitle?: string;
}

const XPHERE_SCRIPT_URL = "https://xphere.app/reviews-widget.js";
const REPUTATIONHUB_SCRIPT_URL = "https://reputationhub.site/reputation/assets/review-widget.js";

function XphereReviews({ config }: { config: ReviewsXphereConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    host.replaceChildren();
    setLoadError(false);

    const script = document.createElement("script");
    script.src = XPHERE_SCRIPT_URL;
    script.async = true;
    script.dataset.skaleReviewsLoader = config.token;
    script.addEventListener("error", () => setLoadError(true));
    document.body.appendChild(script);

    return () => {
      script.remove();
      host.replaceChildren();
    };
  }, [config]);

  return (
    <div>
      <div
        ref={containerRef}
        data-operator-reviews
        data-token={config.token}
        data-layout={config.layout ?? "carousel"}
        data-theme={config.theme ?? "dark"}
        data-min-rating={config.minRating ?? 4}
        data-sort={config.sort ?? "recent"}
        data-limit={config.limit ?? 12}
        data-hero={(config.showHero ?? true) ? "1" : "0"}
        data-hero-style={config.heroStyle ?? "full"}
        data-shape={config.cardShape ?? "square"}
        data-equal-height={(config.equalHeight ?? true) ? "1" : "0"}
        data-footer-cta={(config.footerCta ?? false) ? "1" : "0"}
      />
      {loadError ? <ReviewEmbedError message="The reviews widget could not be loaded." /> : null}
    </div>
  );
}

function ReputationHubReviews({ url }: { url: string }) {
  return (
    <iframe
      className="lc_reviews_widget block h-[488px] w-full min-w-full border-0"
      src={url}
      title="Customer reviews"
      loading="lazy"
      scrolling="no"
      onLoad={() => {
        if (document.querySelector(`script[src="${REPUTATIONHUB_SCRIPT_URL}"]`)) return;
        const script = document.createElement("script");
        script.src = REPUTATIONHUB_SCRIPT_URL;
        script.async = true;
        document.body.appendChild(script);
      }}
    />
  );
}

function ReviewEmbedError({ message }: { message: string }) {
  const visible = import.meta.env.DEV || new URLSearchParams(window.location.search).has("preview");
  if (!visible) return null;
  return <p className="border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">{message}</p>;
}

export function ReviewsSection({ xphere, embedUrl, title, subtitle }: ReviewsSectionProps) {
  const { t } = useTranslation();
  const legacy = useMemo(() => (embedUrl ? parseLegacyReviewsEmbed(embedUrl) : null), [embedUrl]);
  const xphereConfig = xphere ?? (legacy?.type === "xphere" ? legacy.config : undefined);
  const iframeUrl = legacy?.type === "iframe" ? legacy.url : undefined;

  if (!xphereConfig && !iframeUrl && !title && !subtitle && !legacy) return null;

  return (
    <Band
      id="reviews"
      tone="dark"
      role="editorial"
      className="mb-0 overflow-hidden border-t border-white/10 bg-navy-900"
      containerClassName="section-content-stack"
    >
      <SectionHeading variant="editorial" eyebrow="Reviews" icon={Star} title={title || ""} subtitle={subtitle || ""} />
      {xphereConfig || iframeUrl || legacy?.type === "invalid" ? (
        <div className="relative left-1/2 w-screen -translate-x-1/2 bg-navy-950">
          {xphereConfig ? <XphereReviews config={xphereConfig} /> : null}
          {!xphereConfig && iframeUrl ? <ReputationHubReviews url={iframeUrl} /> : null}
          {!xphereConfig && !iframeUrl && legacy?.type === "invalid" ? <ReviewEmbedError message={t(legacy.reason)} /> : null}
        </div>
      ) : null}
    </Band>
  );
}
