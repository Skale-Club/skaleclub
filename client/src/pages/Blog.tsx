import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ChevronLeft, ChevronRight, Calendar, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import type { BlogPost } from '@shared/schema';

const POSTS_PER_PAGE = 9;

export default function Blog() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const offset = (page - 1) * POSTS_PER_PAGE;

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog', 'published', POSTS_PER_PAGE, offset],
    queryFn: () => fetch(`/api/blog?status=published&limit=${POSTS_PER_PAGE}&offset=${offset}`).then(r => r.json()),
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ['/api/blog/count'],
  });

  const totalPages = Math.ceil((countData?.count || 0) / POSTS_PER_PAGE);

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
      <div className="bg-primary/5 py-12 md:py-16">
        <div className="container max-w-6xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4" data-testid="nav-blog-breadcrumb">
            <Link href="/" className="hover:text-primary">Home</Link>
            <span>/</span>
            <span className="text-foreground">Blog</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4" data-testid="text-blog-heading">
            Our Blog
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Tips, guides, and insights about professional cleaning services
          </p>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
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

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-blog-prev"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <Button
                      key={i + 1}
                      variant={page === i + 1 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPage(i + 1)}
                      data-testid={`button-blog-page-${i + 1}`}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  data-testid="button-blog-next"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
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
