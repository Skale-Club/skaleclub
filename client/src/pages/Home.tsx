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
      <HeroSection
        companySettings={companySettings}
        homepageContent={homepageContent}
        onCtaClick={() => setIsFormOpen(true)}
        showTrustBadges={false}
      />

      {trustBadges.length > 0 && (
        // ── Trust-bar bleed contract ──────────────────────────────────────
        // These `mt` values must exactly match:
        //   1. HeroSection's `bottomPadding` (showTrustBadges=false branch) —
        //      keeps the hero photo glued to the card's top edge, no gap.
        //   2. The fill `<div>`'s `top-[…]` below — keeps the dark fill
        //      starting exactly at the hero's true bottom edge, so only the
        //      rounded card (not a full-width bar) shows over the hero.
        // If you change one, change all three, at every breakpoint.
        <section className="relative z-20 mt-[-3.4rem] md:mt-[-6.0625rem] lg:mt-[-4.0625rem]">
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
            rounded card (not a full-width bar) shows above that line, over the
            hero's own background/photo.
          */}
          <div className="absolute inset-x-0 bottom-0 top-[3.4rem] md:top-[6.0625rem] lg:top-[4.0625rem] bg-[#111111]" aria-hidden />
          <div className="container-custom mx-auto relative">
            <TrustBadges badges={trustBadges} />
          </div>
        </section>
      )}

      {/* Sections swapped (What We Do first), but each SLOT keeps its original
          background: slot 1 stays flat #111111 so it still merges seamlessly
          with the trust-bar fill above; slot 2 keeps the dark gradient (now on
          OurServicesSection itself). */}
      <ServicesSection
        section={horizontalScrollSection}
        onCtaClick={handleConsultingCta}
        background="bg-[#111111]"
      />

      <OurServicesSection section={homepageContent.ourServicesSection} />
      <div className="h-0 bg-[#111111]"></div>
      <ReviewsSection
        embedUrl={reviewsEmbedUrl}
        title={reviewsTitle}
        subtitle={reviewsSubtitle}
      />
      <BlogSection content={homepageContent.blogSection} />
      <section id="about" className="relative py-[4.25rem] overflow-hidden bg-gradient-to-b from-[#10151f] to-[#0a0c11]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-80 h-80 blur-3xl -left-20 top-0 rounded-full bg-primary/5" />
          <div className="absolute w-[420px] h-[420px] blur-3xl right-[-10%] bottom-[-20%] rounded-full bg-indigo-500/10" />
        </div>
        <div className="relative z-10">
          <AboutSection
            aboutImageUrl={companySettings?.aboutImageUrl}
            content={homepageContent.aboutSection}
          />
        </div>
      </section>
      {(companySettings?.mapEmbedUrl || areasServedSection?.heading || areasServedSection?.description) && (
        <section id="areas-served" className="bg-[#111111] py-[4.25rem]">
          <AreasServedMap
            mapEmbedUrl={companySettings?.mapEmbedUrl}
            content={areasServedSection}
          />
        </section>
      )}
      <LeadFormModal open={isFormOpen} onClose={() => setIsFormOpen(false)} formSlug="default" />
    </div>
  );
}
