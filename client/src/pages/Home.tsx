import { useEffect, useState } from "react";
import { AboutSection } from "@/components/AboutSection";
import { AreasServedMap } from "@/components/AreasServedMap";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings, HomepageContent } from "@shared/schema";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { HeroSection } from "@/components/home/HeroSection";
import { TrustBadges } from "@/components/home/TrustBadges";
import { ServicesSection } from "@/components/home/ServicesSection";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { BlogSection } from "@/components/home/BlogSection";
import { OurServicesSection } from "@/components/home/OurServicesSection";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";

export default function Home() {
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const consultingStepsSection: HomepageContent["consultingStepsSection"] = companySettings?.homepageContent?.consultingStepsSection || { enabled: false, steps: [] };
  const homepageContent: Partial<HomepageContent> = companySettings?.homepageContent || {};

  // Use new unified horizontal scroll section, fallback to old consultingStepsSection
  const horizontalScrollSection = homepageContent.horizontalScrollSection || consultingStepsSection;

  const areasServedSection: HomepageContent["areasServedSection"] = {
    ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
    ...(homepageContent.areasServedSection || {}),
  };

  const trustBadges = homepageContent.trustBadges || [];

  const reviewsEmbedUrl = homepageContent.reviewsSection?.embedUrl || '';
  const reviewsTitle = homepageContent.reviewsSection?.title || '';
  const reviewsSubtitle = homepageContent.reviewsSection?.subtitle || '';

  const [isFormOpen, setIsFormOpen] = useState(false);
  const handleConsultingCta = () => {
    setIsFormOpen(true);
    trackCTAClick('horizontal-scroll', horizontalScrollSection?.ctaButtonLabel || companySettings?.ctaText || '');
  };

  // Handle hash navigation on mount (e.g., /#about)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, []);

  // The mobile action bar asks the page to open its own lead form so two
  // modals never coexist; preventDefault tells the bar it was handled.
  useEffect(() => {
    const openHandler = (event: Event) => {
      event.preventDefault();
      setIsFormOpen(true);
    };
    document.addEventListener('lead-form:open', openHandler);
    return () => document.removeEventListener('lead-form:open', openHandler);
  }, []);

  useEffect(() => {
    const clickHandler = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const trigger = target.closest('[data-form-trigger], button, a') as HTMLElement | null;
      if (!trigger) return;
      if (trigger.dataset.formTrigger === 'lead-form') {
        event.preventDefault();
        setIsFormOpen(true);
      }
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  }, []);

  return (
    <div className="pb-0">
      {/* The wrapper owns the hero's navy + grid so the pattern runs unbroken
          from the hero into the top half of the trust bar's rows. */}
      <div className="bg-navy-900 pattern-grid-dark">
        <HeroSection
          companySettings={companySettings}
          homepageContent={homepageContent}
          onCtaClick={() => setIsFormOpen(true)}
          showTrustBadges={false}
        />

        {trustBadges.length > 0 && (
          // The trust card sits exactly centred on the hero/services boundary,
          // whatever its height (it changes with breakpoint and language): the
          // card spans two equal `1fr` rows, so each row is half the card. The
          // top row shows the wrapper's navy, the bottom row is filled with the
          // next section's cream. Real flow, so the bottom half pushes the
          // services section down and its own py rhythm sets the gap below.
          <section className="relative z-20 grid grid-cols-1 grid-rows-2">
            <div className="col-start-1 row-start-2 bg-steel-700" aria-hidden />
            <div className="container-editorial relative col-start-1 row-span-2 row-start-1">
              <TrustBadges badges={trustBadges} />
            </div>
          </section>
        )}
      </div>

      <ServicesSection
        section={horizontalScrollSection}
        onCtaClick={handleConsultingCta}
        band="steel"
      />

      <OurServicesSection
        section={homepageContent.ourServicesSection}
        onCtaClick={() => {
          setIsFormOpen(true);
          trackCTAClick('our-services', companySettings?.ctaText || '');
        }}
      />
      <ReviewsSection
        embedUrl={reviewsEmbedUrl}
        title={reviewsTitle}
        subtitle={reviewsSubtitle}
      />
      <BlogSection content={homepageContent.blogSection} band="steel-2" />
      <AboutSection
        tone="dark"
        band="steel-3"
        aboutImageUrl={companySettings?.aboutImageUrl}
        content={homepageContent.aboutSection}
      />
      {(companySettings?.mapEmbedUrl || areasServedSection?.heading || areasServedSection?.description) && (
        <AreasServedMap
          mapEmbedUrl={companySettings?.mapEmbedUrl}
          content={areasServedSection}
        />
      )}
      <LeadFormModal open={isFormOpen} onClose={() => setIsFormOpen(false)} formSlug="default" />
    </div>
  );
}
