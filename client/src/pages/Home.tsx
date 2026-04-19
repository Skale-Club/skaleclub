import { useEffect, useState } from "react";
import { AboutSection } from "@/components/AboutSection";
import { AreasServedMap } from "@/components/AreasServedMap";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings, HomepageContent } from "@shared/schema";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { HeroSection } from "@/components/home/HeroSection";
import { ServicesSection } from "@/components/home/ServicesSection";
import { TrustBadges } from "@/components/home/TrustBadges";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { BlogSection } from "@/components/home/BlogSection";
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
      />

      {/* Wrapper to connect backgrounds and eliminate white gap */}
      <div className="bg-gradient-to-br from-[#f7f9fc] via-white to-[#eaf1ff] relative w-full mt-0 pt-0">
        <TrustBadges badges={trustBadges} />
        <ServicesSection
          section={horizontalScrollSection}
          onCtaClick={handleConsultingCta}
        />
      </div>
      {(companySettings?.mapEmbedUrl || areasServedSection?.heading || areasServedSection?.description) && (
        <section id="areas-served" className="bg-white py-20">
          <AreasServedMap
            mapEmbedUrl={companySettings?.mapEmbedUrl}
            content={areasServedSection}
          />
        </section>
      )}
      <div className="h-0 bg-[#111111]"></div>
      <ReviewsSection
        embedUrl={reviewsEmbedUrl}
        title={reviewsTitle}
        subtitle={reviewsSubtitle}
      />
      <BlogSection content={homepageContent.blogSection} />
      <section id="about" className="bg-white py-20">
        <AboutSection
          aboutImageUrl={companySettings?.aboutImageUrl}
          content={homepageContent.aboutSection}
        />
      </section>
      <LeadFormModal open={isFormOpen} onClose={() => setIsFormOpen(false)} formSlug="default" />
    </div>
  );
}
