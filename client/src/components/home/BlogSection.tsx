import { Link } from "wouter";
import { ArrowRight, Calendar, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/format";
import type { BlogPost, HomepageContent } from "@shared/schema";
import { useTranslation } from "@/hooks/useTranslation";
import { usePagePaths } from "@/lib/pagePaths";
import { Skeleton } from "@/components/ui/skeleton";
import { Band, EditorialCard, Eyebrow, PillLink, type BandTone } from "@/components/editorial";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { fetchJson } from "@/lib/queryClient";

interface BlogSectionProps {
  content: HomepageContent['blogSection'];
  /** Band background. Defaults to ice; the home passes a blue step. */
  band?: BandTone;
}

export function BlogSection({ content, band = "ice" }: BlogSectionProps) {
  const dark = band !== "ice" && band !== "cream" && band !== "white";
  const tone = dark ? "dark" : "light";
  const { t, language } = useTranslation();
  const pagePaths = usePagePaths();
  const sectionContent = {
    ...(content || {}),
  };

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog', 'published', 3, 0],
    queryFn: () => fetchJson<BlogPost[]>('/api/blog?status=published&limit=3&offset=0'),
  });

  if (isLoading) {
    return (
      <Band tone={band}>
        <div className="mb-[2.125rem] space-y-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 tablet:grid-cols-3 gap-[1.7rem]">
          {[0, 1, 2].map((i) => (
            <EditorialCard key={i} tone={tone} className={`h-full flex flex-col overflow-hidden p-0 sm:p-0 ${dark ? "bg-steel-700" : ""}`}>
              <div className="aspect-[16/10] w-full p-3">
                <Skeleton className="h-full w-full rounded-none" />
              </div>
              <div className="p-6 flex flex-col flex-1 gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </EditorialCard>
          ))}
        </div>
      </Band>
    );
  }

  if (!posts || posts.length === 0) {
    return null;
  }

  const getExcerpt = (post: BlogPost) => {
    if (post.excerpt) return post.excerpt;
    const text = post.content.replace(/<[^>]*>/g, '');
    return text.length > 120 ? text.slice(0, 120) + '...' : text;
  };

  return (
    <Band tone={band}>
      <div className="flex items-end justify-between gap-6 mb-[2.125rem]">
        <div data-testid="text-blog-section-title">
          <SectionHeading
            variant="editorial"
            tone={tone}
            title={sectionContent.title || ''}
            subtitle={sectionContent.subtitle || ''}
          />
        </div>
        <Link href={pagePaths.blog} className={`hidden md:flex shrink-0 items-center gap-2 ${dark ? "text-cta-soft" : "text-cta-ink"} font-semibold hover:underline`} data-testid="link-view-all-blog">
          {t(sectionContent.viewAllText || '')}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 tablet:grid-cols-3 gap-[1.7rem]">
        {posts.map(post => (
          <Link key={post.id} href={pagePaths.blogPost(post.slug)} className="group" data-testid={`link-blog-card-${post.id}`}>
            <EditorialCard tone={tone} className={`h-full flex flex-col overflow-hidden p-0 sm:p-0 transition-colors duration-300 ${dark ? "bg-steel-700 group-hover:border-cta-soft/30" : "group-hover:border-cta-ink/30"}`}>
              {post.featureImageUrl ? (
                <div className="aspect-[16/10] overflow-hidden p-3">
                  <img
                    src={post.featureImageUrl}
                    alt={post.title}
                    width={640}
                    height={400}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full object-cover outline outline-1 -outline-offset-1 ${dark ? "outline-white/10" : "outline-black/10"}`}
                    data-testid={`img-blog-home-${post.id}`}
                  />
                </div>
              ) : (
                <div className={`aspect-[16/10] ${dark ? "bg-white/5" : "bg-ink/5"} flex items-center justify-center`}>
                  <FileText className={`w-12 h-12 ${dark ? "text-fog-400" : "text-ink-400"}`} />
                </div>
              )}
              <div className="p-6 flex flex-col flex-1">
                <Eyebrow tone={tone} className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4" />
                  <span data-testid={`text-blog-home-date-${post.id}`}>
                    {post.publishedAt ? formatDate(post.publishedAt, language) : ''}
                  </span>
                </Eyebrow>
                <h3 className={`font-display text-xl font-semibold mb-2 line-clamp-2 ${dark ? "text-fog-50" : "text-ink"}`} data-testid={`text-blog-home-title-${post.id}`}>
                  {post.title}
                </h3>
                <p className={`text-sm line-clamp-3 flex-1 ${dark ? "text-fog-400" : "text-ink-500"}`} data-testid={`text-blog-home-excerpt-${post.id}`}>
                  {getExcerpt(post)}
                </p>
                <div className={`mt-[0.85rem] pt-[0.85rem] border-t ${dark ? "border-white/10" : "border-ink-700/10"}`}>
                  <span className={`${dark ? "text-cta-soft" : "text-cta-ink"} font-semibold text-sm flex items-center gap-1 group-hover:gap-2 transition-all`}>
                    {t(sectionContent.readMoreText || '')}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </EditorialCard>
          </Link>
        ))}
      </div>

      <div className="mt-[2.125rem] text-center md:hidden">
        <PillLink href={pagePaths.blog} data-testid="link-view-all-blog-mobile">
          {t(sectionContent.viewAllText || '')}
          <ArrowRight className="w-4 h-4" />
        </PillLink>
      </div>
    </Band>
  );
}
