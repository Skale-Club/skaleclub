import { useEffect } from "react";
import { useCategories, useServices } from "@/hooks/use-booking";
import { Link, useLocation } from "wouter";
import { ArrowRight, Star, Shield, Clock, Sparkles, Heart, BadgeCheck, ThumbsUp, Trophy, Phone, Calendar, FileText } from "lucide-react";
import { CartSummary } from "@/components/CartSummary";
import { AreasServedMap } from "@/components/AreasServedMap";
import heroImage from "@assets/Persona-Mobile_1767749022412.png";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings, BlogPost, HomepageContent } from "@shared/schema";
import { format } from "date-fns";
import { trackCTAClick } from "@/lib/analytics";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";

function BlogSection({ content }: { content: HomepageContent['blogSection'] }) {
  const sectionContent = {
    ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
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
              {sectionContent.title}
            </h2>
            <p className="text-slate-600 text-lg">{sectionContent.subtitle}</p>
          </div>
          <Link href="/blog" className="hidden md:flex items-center gap-2 text-primary font-semibold hover:underline" data-testid="link-view-all-blog">
            {sectionContent.viewAllText}
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
                      {sectionContent.readMoreText}
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
            {sectionContent.viewAllText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { data: categories, isLoading: isCategoriesLoading } = useCategories();
  const { data: services, isLoading: isServicesLoading } = useServices();
  const [, setLocation] = useLocation();
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const isLoading = isCategoriesLoading || isServicesLoading;
  const homepageContent = {
    ...DEFAULT_HOMEPAGE_CONTENT,
    ...(companySettings?.homepageContent || {}),
    trustBadges: companySettings?.homepageContent?.trustBadges?.length
      ? companySettings.homepageContent.trustBadges
      : DEFAULT_HOMEPAGE_CONTENT.trustBadges,
    categoriesSection: {
      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
      ...(companySettings?.homepageContent?.categoriesSection || {}),
    },
    reviewsSection: {
      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
      ...(companySettings?.homepageContent?.reviewsSection || {}),
    },
    blogSection: {
      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
      ...(companySettings?.homepageContent?.blogSection || {}),
    },
    areasServedSection: {
      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
      ...(companySettings?.homepageContent?.areasServedSection || {}),
    },
  };

  const trustBadges = homepageContent.trustBadges || [];
  const badgeIconMap: Record<string, React.ComponentType<any>> = {
    star: Star,
    shield: Shield,
    clock: Clock,
    sparkles: Sparkles,
    heart: Heart,
    badgeCheck: BadgeCheck,
    thumbsUp: ThumbsUp,
    trophy: Trophy,
  };

  const displayPhone = companySettings?.companyPhone || "(303) 309 4226";
  const telPhone = displayPhone.replace(/\D/g, '');

  const handleCategoryClick = (categoryId: number) => {
    setLocation(`/services?category=${categoryId}&scroll=true`);
  };

  // Filter categories that have at least one service
  const activeCategories = categories?.filter(category =>
    services?.some(service => service.categoryId === category.id)
  );

  // Handle hash navigation on mount (e.g., /#areas-served)
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

  return (
    <div className="pb-0">
      {/* Hero Section */}
      <section className="relative flex items-center lg:items-end pt-6 lg:pt-4 pb-0 overflow-hidden bg-[#1C53A3] min-h-[65vh] sm:min-h-[50vh] lg:min-h-[500px] xl:min-h-[550px]">
        <div className="container-custom mx-auto relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-8 items-center lg:items-center">
            <div className="text-white pt-4 pb-2 lg:pt-12 lg:pb-12 relative z-20">
              <div className="mb-3 lg:mb-6">
                <img
                  src={homepageContent.heroBadgeImageUrl || DEFAULT_HOMEPAGE_CONTENT.heroBadgeImageUrl}
                  alt={homepageContent.heroBadgeAlt || DEFAULT_HOMEPAGE_CONTENT.heroBadgeAlt || 'Trusted Experts'}
                  className="h-5 sm:h-6 w-auto object-contain"
                />
              </div>
              <h1 className="text-[11vw] sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl font-bold mb-3 lg:mb-6 font-display leading-[1.05] sm:leading-[1.1]">
                {companySettings?.heroTitle ? (
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">{companySettings.heroTitle}</span>
                ) : (
                  <>
                    <span className="text-white">Your 5-star</span> <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                      cleaning company
                    </span>
                  </>
                )}
              </h1>
              <p className="text-base sm:text-xl text-blue-50/80 mb-4 lg:mb-8 leading-relaxed max-w-xl">
                {companySettings?.heroSubtitle || "We provide top-quality cleaning services ensuring a spotless environment for your home and office."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 flex-wrap">
                <Link href="/services" className="w-full sm:w-auto shrink-0">
                  <button
                    className="w-full px-6 sm:px-8 py-3 sm:py-4 bg-[#FFFF01] hover:bg-[#e6e600] text-black font-bold rounded-full transition-all flex items-center justify-center gap-2 text-base sm:text-lg whitespace-nowrap"
                    onClick={() => trackCTAClick('hero', companySettings?.ctaText || 'Get Instant Price')}
                    data-testid="button-hero-cta"
                  >
                    {companySettings?.ctaText || "Get Instant Price"}
                  </button>
                </Link>
                <a
                  href={`tel:${telPhone}`}
                  className="w-full sm:w-auto shrink-0 px-6 sm:px-8 py-3 sm:py-4 bg-transparent text-white font-bold rounded-full border border-white/30 hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-base sm:text-lg whitespace-nowrap"
                  onClick={() => trackCTAClick('hero', 'phone_call')}
                  data-testid="button-hero-phone"
                >
                  <Phone className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                  {displayPhone}
                </a>
              </div>
            </div>
            <div className="relative flex h-full items-end justify-center lg:justify-end self-end w-full lg:min-h-[400px] z-10 lg:ml-[-5%] -mt-2 sm:mt-0">
              <img
                src={companySettings?.heroImageUrl || heroImage}
                alt="Cleaning Professionals"
                className="w-[100vw] sm:w-[105%] lg:w-[100%] max-w-[400px] sm:max-w-[360px] md:max-w-[420px] lg:max-w-[490px] xl:max-w-[560px] object-contain drop-shadow-2xl translate-y-[2%] sm:translate-y-[5%] scale-100 sm:scale-102 lg:scale-100 origin-bottom"
              />
            </div>
          </div>
        </div>
        
        {/* Modern Creative Blue Gradient Background */}
        <div className="absolute inset-0 bg-[#1C53A3]">
          <div className="absolute inset-0 opacity-60" style={{ 
            background: `
              radial-gradient(circle at 20% 30%, #4facfe 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, #a8d8ff 0%, transparent 50%),
              radial-gradient(circle at 50% 80%, #1C53A3 0%, transparent 50%),
              linear-gradient(135deg, #1C53A3 0%, #74abe2 100%)
            ` 
          }}></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#1C53A3] via-[#1C53A3]/20 to-transparent"></div>
        </div>
      </section>
      {/* Trust Badges */}
      <section className="relative z-20 -mt-10">
        <div className="absolute inset-x-0 bottom-0 top-1/2 bg-[#F8FAFC] -z-10 pt-[0px] pb-[0px] mt-[-25px] mb-[-25px]"></div>
        <div className="container-custom mx-auto">
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
                    <h3 className="font-bold text-[#1D1D1D]">{feature.title}</h3>
                    <p className="text-sm text-slate-500">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {/* Categories */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="container-custom mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              {homepageContent.categoriesSection?.title || DEFAULT_HOMEPAGE_CONTENT.categoriesSection?.title}
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              {homepageContent.categoriesSection?.subtitle || DEFAULT_HOMEPAGE_CONTENT.categoriesSection?.subtitle}
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 ${activeCategories?.length === 1 ? 'lg:grid-cols-1 max-w-md mx-auto' : activeCategories?.length === 2 ? 'lg:grid-cols-2 max-w-4xl mx-auto' : 'lg:grid-cols-3'} gap-8`}>
              {activeCategories?.map((category) => (
                <div
                  key={category.id}
                  className="group cursor-pointer relative overflow-hidden rounded-2xl h-80 shadow-md hover:shadow-xl transition-all duration-500 bg-light-gray"
                  onClick={() => handleCategoryClick(category.id)}
                >
                  <img 
                    src={category.imageUrl || "https://images.unsplash.com/photo-1581578731117-104f2a412729?w=800&q=80"}
                    alt={category.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-8 w-full">
                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:translate-x-2 transition-transform">
                      {category.name}
                    </h3>
                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                      {category.description}
                    </p>
                    <button 
                      className="w-full py-2 bg-[#FFFF01] hover:bg-[#e6e600] text-black font-bold rounded-lg opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all"
                      onClick={() => trackCTAClick('category_card', category.name)}
                    >
                      {homepageContent.categoriesSection?.ctaText || DEFAULT_HOMEPAGE_CONTENT.categoriesSection?.ctaText}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      {/* Reviews Section */}
      <section className="pt-20 pb-0 bg-white overflow-hidden mb-0">
        <div className="w-full">
          <div className="container-custom mx-auto mb-16 text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              {homepageContent.reviewsSection?.title || DEFAULT_HOMEPAGE_CONTENT.reviewsSection?.title}
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto text-lg">
              {homepageContent.reviewsSection?.subtitle || DEFAULT_HOMEPAGE_CONTENT.reviewsSection?.subtitle}
            </p>
          </div>
          <div className="w-full px-0">
            <div className="pb-8 md:pb-0 bg-white">
              <iframe 
                className='lc_reviews_widget' 
                src={homepageContent.reviewsSection?.embedUrl || DEFAULT_HOMEPAGE_CONTENT.reviewsSection?.embedUrl}
                frameBorder='0' 
                scrolling='no' 
                style={{ minWidth: '100%', width: '100%', height: '520px', border: 'none', display: 'block' }}
                onLoad={() => {
                  const script = document.createElement('script');
                  script.type = 'text/javascript';
                  script.src = 'https://reputationhub.site/reputation/assets/review-widget.js';
                  document.body.appendChild(script);
                }}
              ></iframe>
            </div>
          </div>
        </div>
      </section>
      <BlogSection content={homepageContent.blogSection} />
      <section id="areas-served" className="bg-white py-20">
        <AreasServedMap 
          mapEmbedUrl={companySettings?.mapEmbedUrl} 
          content={homepageContent.areasServedSection} 
        />
      </section>
      <CartSummary />
    </div>
  );
}
