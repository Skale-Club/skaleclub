import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Calendar, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import type { BlogPost } from '@shared/schema';

const POSTS_PER_PAGE = 9;

export default function Blog() {
  const [searchTerm, setSearchTerm] = useState('');
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<BlogPost[]>({
    queryKey: ['/api/blog', 'published', POSTS_PER_PAGE],
    initialPageParam: 0,
    queryFn: ({ pageParam = 0 }) =>
      fetch(`/api/blog?status=published&limit=${POSTS_PER_PAGE}&offset=${pageParam}`).then(r => r.json()),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === POSTS_PER_PAGE ? allPages.length * POSTS_PER_PAGE : undefined,
  });

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const node = loadMoreRef.current;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.unobserve(node);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const posts = data?.pages.flat() ?? [];

  const filteredPosts = posts?.filter(post => 
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.excerpt?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getExcerpt = (post: BlogPost) => {
    if (post.excerpt) return post.excerpt;
    const text = post.content.replace(/<[^>]*>/g, '');
    return text.length > 150 ? text.slice(0, 150) + '...' : text;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary/5 py-8 md:py-10">
        <div className="container-custom">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4" data-testid="nav-blog-breadcrumb">
            <Link href="/" className="hover:text-primary">Home</Link>
            <span>/</span>
            <span className="text-foreground">Blog</span>
          </nav>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2" data-testid="text-blog-heading">
                Our Blog
              </h1>
              <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
                Tips, guides, and insights about professional cleaning services
              </p>
            </div>
            <div className="w-full max-w-md md:max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-blog-search"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-custom py-8 md:py-12">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden border-0">
                <Skeleton className="aspect-video" />
                <CardContent className="p-4 space-y-3 bg-slate-50">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPosts && filteredPosts.length > 0 ? (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map(post => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <Card 
                    className="overflow-hidden hover-elevate cursor-pointer h-full flex flex-col border-0"
                    data-testid={`card-blog-${post.id}`}
                  >
                    {post.featureImageUrl ? (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={post.featureImageUrl}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.025]"
                          data-testid={`img-blog-${post.id}`}
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-muted flex items-center justify-center">
                        <FileText className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                    <CardContent className="p-4 flex-1 flex flex-col bg-slate-50">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Calendar className="w-4 h-4" />
                        <span data-testid={`text-blog-date-${post.id}`}>
                          {post.publishedAt ? format(new Date(post.publishedAt), 'MMMM d, yyyy') : 'Draft'}
                        </span>
                      </div>
                      <h2 
                        className="text-lg font-semibold text-foreground mb-2 line-clamp-2"
                        data-testid={`text-blog-title-${post.id}`}
                      >
                        {post.title}
                      </h2>
                      <p 
                        className="text-sm text-muted-foreground line-clamp-3 flex-1"
                        data-testid={`text-blog-excerpt-${post.id}`}
                      >
                        {getExcerpt(post)}
                      </p>
                      <div className="mt-4">
                        <span className="text-primary font-medium text-sm hover:underline">
                          Read More
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            {isFetchingNextPage && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={`loading-more-${i}`} className="overflow-hidden border-0">
                    <Skeleton className="aspect-video" />
                    <CardContent className="p-4 space-y-3 bg-slate-50">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {hasNextPage && <div ref={loadMoreRef} className="h-10" />}
          </>
        ) : (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No posts found</h2>
            <p className="text-muted-foreground">
              {searchTerm ? 'Try a different search term' : 'Check back soon for new articles'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
