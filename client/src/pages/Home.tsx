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
      <div className="trust-bar-bleed">
        <HeroSection
          companySettings={companySettings}
          homepageContent={homepageContent}
          onCtaClick={() => setIsFormOpen(true)}
          showTrustBadges={false}
        />

        {trustBadges.length > 0 && (
          // ── Trust-bar bleed contract ────────────────────────────────────
          // Source of truth: the `--trust-bleed` var set per breakpoint by
          // `.trust-bar-bleed` in index.css (on the wrapper above). This
          // section's `mt` and the fill `<div>`'s `top-[…]` below both read
          // that var, and so does HeroSection's `bottomPadding`
          // (showTrustBadges=false branch) — keeping the hero photo glued to
          // the card's top edge and the dark fill starting exactly at the
          // hero's true bottom edge, so only the rounded card (not a
          // full-width bar) shows over the hero. Change the var once in
          // index.css to change all three.
          <section className="relative z-20 mt-[calc(var(--trust-bleed)*-1)]">
            {/*
              Bleeds up into the hero by roughly half the card's height (tuned per
              breakpoint, since TrustBadges' own grid — and thus its height —
              changes at md/lg) so the split reads ~50/50 across the hero/services
              boundary. Real flow (not absolute/zero-height): the card's bottom
              half pushes the What We Do section down naturally. No extra trailing
              padding here — that section's own pt-[4.25rem] (the standard
              section-to-section rhythm used across this page) is what creates
              the gap before its heading, so it matches every other transition.

              The fill below only starts at `top: <bleed>` — i.e. right where this
              section crosses back below the hero's true bottom edge — so only the
              card (not a full-width bar) shows above that line, over the
              hero's own background/photo.
            */}
            <div className="absolute inset-x-0 bottom-0 top-[var(--trust-bleed)] bg-navy-900" aria-hidden />
            <div className="container-editorial relative">
              <TrustBadges badges={trustBadges} />
            </div>
          </section>
        )}
      </div>

      <ServicesSection
        section={horizontalScrollSection}
        onCtaClick={handleConsultingCta}
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
      <BlogSection content={homepageContent.blogSection} />
      <AboutSection
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
