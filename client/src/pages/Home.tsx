import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Star, Shield, Clock, Sparkles, Heart, BadgeCheck, ThumbsUp, Trophy, Calendar, FileText, Zap, Rocket, Users, Award } from "lucide-react";
import { AboutSection } from "@/components/AboutSection";
import { AreasServedMap } from "@/components/AreasServedMap";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings, BlogPost, HomepageContent } from "@shared/schema";
import { format } from "date-fns";
import { trackCTAClick } from "@/lib/analytics";
import { LeadFormModal } from "@/components/LeadFormModal";
import { ServicesSection } from "@/components/ServicesSection";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";
import { useTranslation } from "@/hooks/useTranslation";

function BlogSection({ content }: { content: HomepageContent['blogSection'] }) {
  const { t } = useTranslation();
  const sectionContent = {
    ...(content || {}),
  };

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog', 'published', 3, 0],
    queryFn: () => fetch('/api/blog?status=published&limit=3&offset=0').then(r => r.json()),
  });

  if (isLoading || !posts || posts.length === 0) {
    return null;
  }

  const getExcerpt = (post: BlogPost) => {
    if (post.excerpt) return post.excerpt;
    const text = post.content.replace(/<[^>]*>/g, '');
    return text.length > 120 ? text.slice(0, 120) + '...' : text;
  };

  return (
    <section className="py-20 bg-[#F8FAFC]">
      <div className="container-custom mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1D1D1D] mb-2" data-testid="text-blog-section-title">
              {t(sectionContent.title || '')}
            </h2>
            <p className="text-slate-600 text-lg">{t(sectionContent.subtitle || '')}</p>
          </div>
          <Link href="/blog" className="hidden md:flex items-center gap-2 text-primary font-semibold hover:underline" data-testid="link-view-all-blog">
            {t(sectionContent.viewAllText || '')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map(post => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="group" data-testid={`link-blog-card-${post.id}`}>
              <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 h-full flex flex-col">
                {post.featureImageUrl ? (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={post.featureImageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      data-testid={`img-blog-home-${post.id}`}
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    <FileText className="w-12 h-12 text-blue-300" />
                  </div>
                )}
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                    <Calendar className="w-4 h-4" />
                    <span data-testid={`text-blog-home-date-${post.id}`}>
                      {post.publishedAt ? format(new Date(post.publishedAt), 'MMMM d, yyyy') : ''}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#1D1D1D] mb-2 line-clamp-2 group-hover:text-primary transition-colors" data-testid={`text-blog-home-title-${post.id}`}>
                    {post.title}
                  </h3>
                  <p className="text-slate-600 text-sm line-clamp-3 flex-1" data-testid={`text-blog-home-excerpt-${post.id}`}>
                    {getExcerpt(post)}
                  </p>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <span className="text-primary font-semibold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                      {t(sectionContent.readMoreText || '')}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center md:hidden">
          <Link href="/blog" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-full hover:bg-primary/90 transition-colors" data-testid="link-view-all-blog-mobile">
            {t(sectionContent.viewAllText || '')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t } = useTranslation();
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
  const badgeIconMap: Record<string, React.ComponentType<any>> = {
    star: Star,
    shield: Shield,
    clock: Clock,
    sparkles: Sparkles,
    heart: Heart,
    badgecheck: BadgeCheck,
    thumbsup: ThumbsUp,
    trophy: Trophy,
    zap: Zap,
    rocket: Rocket,
    users: Users,
    award: Award,
  };

  const [isFormOpen, setIsFormOpen] = useState(false);
  const heroImageUrl = (companySettings?.heroImageUrl || '').trim();
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
      {/* Hero Section */}
      {/* Added responsive bottom padding (pb-36 sm:pb-48 lg:pb-0) to create a void for the absolute badges to occupy without covering the image */}
      <section className="relative flex items-end pt-16 sm:pt-20 lg:pt-16 pb-36 sm:pb-48 lg:pb-0 overflow-hidden bg-[#1C53A3] min-h-[65vh] sm:min-h-[50vh] lg:min-h-[500px]">
        <div className="container-custom mx-auto relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 sm:gap-6 lg:gap-8 items-end">
            <div className="order-1 lg:order-2 text-white pt-6 sm:pt-8 lg:pt-16 pb-16 sm:pb-24 lg:pb-32 lg:translate-y-0 relative z-20">
              {homepageContent.heroBadgeImageUrl ? (
                <div className="mt-4 sm:mt-0 mb-3 lg:mb-6">
                  <img
                    src={homepageContent.heroBadgeImageUrl}
                    alt={homepageContent.heroBadgeAlt || ''}
                    className="h-5 sm:h-6 w-auto object-contain"
                  />
                </div>
              ) : null}
              <h1 className="text-[11vw] sm:text-5xl md:text-6xl lg:text-4xl xl:text-5xl font-bold mb-3 lg:mb-6 font-display leading-[1.05] sm:leading-[1.1]">
                {companySettings?.heroTitle ? (
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">{t(companySettings.heroTitle)}</span>
                ) : null}
              </h1>
              <p className="text-base sm:text-xl text-blue-50/80 mb-4 lg:mb-8 leading-relaxed max-w-xl">
                {companySettings?.heroSubtitle ? t(companySettings.heroSubtitle) : ""}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 lg:gap-5 flex-wrap">
                {companySettings?.ctaText ? (
                  <button
                    data-form-trigger="lead-form"
                    className="w-full sm:w-auto shrink-0 px-6 sm:px-8 py-3 sm:py-4 bg-[#406EF1] hover:bg-[#355CD0] hover:scale-105 text-white font-bold rounded-full transition-all flex items-center justify-center gap-2 text-base sm:text-lg whitespace-nowrap"
                    onClick={() => {
                      setIsFormOpen(true);
                      trackCTAClick('hero', companySettings?.ctaText || '');
                    }}
                    data-testid="button-hero-form"
                  >
                    {t(companySettings.ctaText)}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="order-2 lg:order-1 relative flex h-full items-end justify-center lg:justify-end self-end w-full lg:min-h-[400px] z-10 lg:ml-[-3%]">
              {heroImageUrl ? (
                <img
                  src={heroImageUrl}
                  alt={companySettings?.companyName || ""}
                  className="w-[92vw] sm:w-[98%] lg:w-full max-w-[380px] sm:max-w-[360px] md:max-w-[430px] lg:max-w-[500px] xl:max-w-[560px] object-contain drop-shadow-2xl origin-bottom"
                />
              ) : (
                <div className="w-[92vw] sm:w-[98%] lg:w-full max-w-[380px] sm:max-w-[360px] md:max-w-[430px] lg:max-w-[500px] xl:max-w-[560px]" />
              )}
            </div>
          </div>
        </div>

        {/* Hero Background Gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(
                to right bottom,
                #09152d,
                #0b152a,
                #0d1427,
                #0f1424,
                #101421,
                #121622,
                #151723,
                #171924,
                #1c1c29,
                #21202e,
                #262332,
                #2c2637
              )
            `
          }}
        ></div>
      </section>

      {/* Wrapper to connect backgrounds and eliminate white gap */}
      <div className="bg-gradient-to-br from-[#f7f9fc] via-white to-[#eaf1ff] relative w-full mt-0 pt-0">

        {/* Trust Badges - Absolute container 50/50 intersecting the section break */}
        {trustBadges.length > 0 && (
          <div className="absolute left-0 right-0 z-20 top-0 -translate-y-1/2">
            <div className="container-custom mx-auto px-4 sm:px-6">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 overflow-hidden">
                {trustBadges.map((feature, i) => {
                  const iconKey = (feature.icon || '').toLowerCase();
                  const Icon = badgeIconMap[iconKey] || badgeIconMap.star || Star;
                  return (
                    <div key={i} className="p-8 flex items-center gap-6 hover:bg-gray-50 transition-colors">
                      <div className="w-12 h-12 bg-blue-50 text-primary rounded-full flex items-center justify-center shrink-0">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#1D1D1D]">{t(feature.title)}</h3>
                        <p className="text-sm text-slate-500">{t(feature.description)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
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
      {/* Reviews Section */}
      {(reviewsEmbedUrl || reviewsTitle || reviewsSubtitle) && (
        <section className="pt-6 sm:pt-10 lg:pt-12 pb-0 bg-[#111111] overflow-hidden mb-0 text-white">
          <div className="w-full">
            <div className="container-custom mx-auto mb-16 text-center">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
                {t(reviewsTitle)}
              </h2>
              <p className="text-slate-300 max-w-2xl mx-auto text-lg">
                {t(reviewsSubtitle)}
              </p>
            </div>
            {reviewsEmbedUrl ? (
              <div className="w-full px-0">
                <div className="pb-0 bg-[#111111] -mt-6 sm:-mt-8 lg:-mt-10">
                  <iframe
                    className="lc_reviews_widget rounded-none"
                    src={reviewsEmbedUrl}
                    frameBorder='0'
                    scrolling='no'
                    style={{ minWidth: '100%', width: '100%', height: '488px', border: 'none', display: 'block', borderRadius: '0', background: '#111111' }}
                    onLoad={() => {
                      const script = document.createElement('script');
                      script.type = 'text/javascript';
                      script.src = 'https://reputationhub.site/reputation/assets/review-widget.js';
                      document.body.appendChild(script);
                    }}
                  ></iframe>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}
      <BlogSection content={homepageContent.blogSection} />
      <section id="about" className="bg-white py-20">
        <AboutSection
          aboutImageUrl={companySettings?.aboutImageUrl}
          content={homepageContent.aboutSection}
        />
      </section>
      <LeadFormModal open={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </div>
  );
}
