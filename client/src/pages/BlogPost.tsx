import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  User, 
  FileText, 
  ArrowLeft, 
  Facebook, 
  Twitter, 
  Linkedin,
  Share2,
  ShoppingCart
} from 'lucide-react';
import { format } from 'date-fns';
import type { BlogPost, Service, CompanySettings } from '@shared/schema';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/use-toast';
import { CartSummary } from '@/components/CartSummary';

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const { addItem } = useCart();
  const { toast } = useToast();

  const { data: post, isLoading, error } = useQuery<BlogPost>({
    queryKey: ['/api/blog', params.slug],
    queryFn: () => fetch(`/api/blog/${params.slug}`).then(r => {
      if (!r.ok) throw new Error('Post not found');
      return r.json();
    }),
  });

  const { data: relatedPosts } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog', post?.id, 'related'],
    queryFn: () => fetch(`/api/blog/${post?.id}/related?limit=4`).then(r => r.json()),
    enabled: !!post?.id,
  });

  const { data: relatedServices } = useQuery<Service[]>({
    queryKey: ['/api/blog', post?.id, 'services'],
    queryFn: () => fetch(`/api/blog/${post?.id}/services`).then(r => r.json()),
    enabled: !!post?.id,
  });

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  useEffect(() => {
    if (post) {
      document.title = `${post.title} | ${settings?.companyName || 'Blog'}`;
      
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', post.metaDescription || post.excerpt || '');
      }

      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', post.title);
      
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', post.metaDescription || post.excerpt || '');
      
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage && post.featureImageUrl) {
        ogImage.setAttribute('content', post.featureImageUrl);
      }
    }
  }, [post, settings]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = post?.title || '';

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`,
  };

  const handleAddToCart = (service: Service) => {
    addItem(service);
    toast({ title: `${service.name} added to cart` });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-6xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="aspect-video max-w-4xl mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Post Not Found</h1>
          <p className="text-muted-foreground mb-4">The blog post you're looking for doesn't exist.</p>
          <Link href="/blog">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <article>
        <div className="bg-primary/5 py-8 md:py-12">
          <div className="container max-w-6xl mx-auto px-4">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4" data-testid="nav-post-breadcrumb">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-primary">Blog</Link>
              <span>/</span>
              <span className="text-foreground truncate max-w-[200px]">{post.title}</span>
            </nav>

            <h1 
              className="text-2xl md:text-4xl font-bold text-foreground mb-4 max-w-4xl"
              data-testid="text-post-title"
            >
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <time dateTime={post.publishedAt ? String(post.publishedAt) : ''} data-testid="text-post-date">
                  {post.publishedAt ? format(new Date(post.publishedAt), 'MMMM d, yyyy') : 'Draft'}
                </time>
              </div>
              {post.authorName && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span data-testid="text-post-author">{post.authorName}</span>
                </div>
              )}
              {post.focusKeyword && (
                <Badge variant="secondary" data-testid="badge-post-keyword">
                  {post.focusKeyword}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="container max-w-6xl mx-auto px-4 py-8 md:py-12">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-[70%]">
              {post.featureImageUrl && (
                <div className="aspect-video overflow-hidden rounded-lg mb-8">
                  <img
                    src={post.featureImageUrl}
                    alt={post.title}
                    className="w-full h-full object-cover"
                    data-testid="img-post-feature"
                  />
                </div>
              )}

              <div 
                className="prose prose-lg dark:prose-invert max-w-none mb-8"
                dangerouslySetInnerHTML={{ __html: post.content }}
                data-testid="text-post-content"
              />

              <div className="border-t pt-6">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground">Share:</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={shareLinks.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                      data-testid="link-share-facebook"
                    >
                      <Facebook className="w-4 h-4" />
                    </a>
                    <a
                      href={shareLinks.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                      data-testid="link-share-twitter"
                    >
                      <Twitter className="w-4 h-4" />
                    </a>
                    <a
                      href={shareLinks.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                      data-testid="link-share-linkedin"
                    >
                      <Linkedin className="w-4 h-4" />
                    </a>
                    <a
                      href={shareLinks.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                      data-testid="link-share-whatsapp"
                    >
                      <Share2 className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <aside className="lg:w-[30%]">
              <div className="sticky top-20 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Need Cleaning Services?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Book our professional cleaning services today and enjoy a spotless home.
                    </p>
                    <Link href="/services">
                      <Button className="w-full" data-testid="button-browse-services">
                        Browse Services
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                {relatedServices && relatedServices.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg" data-testid="text-related-services-title">
                        Related Services
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {relatedServices.map(service => (
                        <div key={service.id} className="flex gap-3 items-stretch" data-testid={`card-service-${service.id}`}>
                          {service.imageUrl ? (
                            <div className="w-20 aspect-[4/3] overflow-hidden rounded flex-shrink-0">
                              <img
                                src={service.imageUrl}
                                alt={service.name}
                                className="w-full h-full object-cover"
                                data-testid={`img-service-${service.id}`}
                              />
                            </div>
                          ) : (
                            <div className="w-20 aspect-[4/3] bg-muted rounded flex items-center justify-center flex-shrink-0">
                              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 flex flex-col">
                            <h4 className="text-base font-semibold text-foreground line-clamp-1" data-testid={`text-service-name-${service.id}`}>
                              {service.name}
                            </h4>
                            <p className="text-sm font-bold text-primary" data-testid={`text-service-price-${service.id}`}>
                              ${service.price}
                            </p>
                            <button
                              className="mt-auto h-7 text-xs px-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
                              onClick={() => handleAddToCart(service)}
                              data-testid={`button-add-to-cart-${service.id}`}
                            >
                              Add to Booking
                            </button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {relatedPosts && relatedPosts.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg" data-testid="text-related-posts-title">
                        Related Posts
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {relatedPosts.map(relatedPost => (
                        <Link 
                          key={relatedPost.id} 
                          href={`/blog/${relatedPost.slug}`}
                          className="block group"
                        >
                          <div 
                            className="flex gap-3"
                            data-testid={`link-related-${relatedPost.id}`}
                          >
                            {relatedPost.featureImageUrl ? (
                              <img
                                src={relatedPost.featureImageUrl}
                                alt={relatedPost.title}
                                className="w-16 h-12 object-cover rounded flex-shrink-0"
                                data-testid={`img-related-${relatedPost.id}`}
                              />
                            ) : (
                              <div className="w-16 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 
                                className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-2 transition-colors"
                                data-testid={`text-related-title-${relatedPost.id}`}
                              >
                                {relatedPost.title}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                {relatedPost.publishedAt && format(new Date(relatedPost.publishedAt), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </aside>
          </div>
        </div>
      </article>

      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": post.title,
          "description": post.metaDescription || post.excerpt,
          "image": post.featureImageUrl,
          "datePublished": post.publishedAt,
          "dateModified": post.updatedAt,
          "author": {
            "@type": "Person",
            "name": post.authorName || "Admin"
          },
          "publisher": {
            "@type": "Organization",
            "name": settings?.companyName || "Skleanings",
            "logo": {
              "@type": "ImageObject",
              "url": settings?.logoMain || ""
            }
          }
        })
      }} />

      <CartSummary />
    </div>
  );
}
