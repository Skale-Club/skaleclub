import { FileText, FolderOpen, Image, MapPin, Plus, Star, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import type { HomepageContent } from '@shared/schema';
import { uploadFileToServer } from '../shared/utils';

interface SectionsTabProps {
  homepageContent: HomepageContent;
  updateHomepageContent: (updater: (prev: HomepageContent) => HomepageContent, fieldKey?: string) => void;
  aboutImageUrl: string;
  setAboutImageUrl: (v: string) => void;
  triggerAutoSave: (updates: Record<string, unknown>, fieldKeys?: string[]) => void;
  SavedIndicator: React.FC<{ field: string }>;
}

export function SectionsTab({
  homepageContent,
  updateHomepageContent,
  aboutImageUrl,
  setAboutImageUrl,
  triggerAutoSave,
  SavedIndicator,
}: SectionsTabProps) {
  const { toast } = useToast();

  const categoriesSection = { ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection, ...(homepageContent.categoriesSection || {}) };
  const reviewsSection = { ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection, ...(homepageContent.reviewsSection || {}) };
  const blogSection = { ...DEFAULT_HOMEPAGE_CONTENT.blogSection, ...(homepageContent.blogSection || {}) };
  const aboutSection = { ...DEFAULT_HOMEPAGE_CONTENT.aboutSection, ...(homepageContent.aboutSection || {}) };
  const areasServedSection = { ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection, ...(homepageContent.areasServedSection || {}) };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Categories */}
        <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              Categories
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Service categories displayed on the homepage.</p>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <div className="relative">
                <Input
                  value={categoriesSection.title || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      categoriesSection: { ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection, ...(prev.categoriesSection || {}), title: e.target.value },
                    }), 'homepageContent.categoriesSection.title')
                  }
                />
                <SavedIndicator field="homepageContent.categoriesSection.title" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <div className="relative">
                <Textarea
                  value={categoriesSection.subtitle || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      categoriesSection: { ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection, ...(prev.categoriesSection || {}), subtitle: e.target.value },
                    }), 'homepageContent.categoriesSection.subtitle')
                  }
                  className="min-h-[80px]"
                />
                <SavedIndicator field="homepageContent.categoriesSection.subtitle" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>CTA Text</Label>
              <div className="relative">
                <Input
                  value={categoriesSection.ctaText || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      categoriesSection: { ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection, ...(prev.categoriesSection || {}), ctaText: e.target.value },
                    }), 'homepageContent.categoriesSection.ctaText')
                  }
                />
                <SavedIndicator field="homepageContent.categoriesSection.ctaText" />
              </div>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              Reviews
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Customer reviews widget section.</p>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Heading</Label>
              <div className="relative">
                <Input
                  value={reviewsSection.title || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      reviewsSection: { ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection, ...(prev.reviewsSection || {}), title: e.target.value },
                    }), 'homepageContent.reviewsSection.title')
                  }
                />
                <SavedIndicator field="homepageContent.reviewsSection.title" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <div className="relative">
                <Textarea
                  value={reviewsSection.subtitle || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      reviewsSection: { ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection, ...(prev.reviewsSection || {}), subtitle: e.target.value },
                    }), 'homepageContent.reviewsSection.subtitle')
                  }
                  className="min-h-[80px]"
                />
                <SavedIndicator field="homepageContent.reviewsSection.subtitle" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Embed URL</Label>
              <div className="relative">
                <Input
                  value={reviewsSection.embedUrl || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      reviewsSection: { ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection, ...(prev.reviewsSection || {}), embedUrl: e.target.value },
                    }), 'homepageContent.reviewsSection.embedUrl')
                  }
                  placeholder="https://..."
                />
                <SavedIndicator field="homepageContent.reviewsSection.embedUrl" />
              </div>
              <p className="text-xs text-muted-foreground">External review widget embed URL.</p>
            </div>
          </div>
        </div>

        {/* Blog */}
        <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Blog
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Blog posts section on the homepage.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Title</Label>
              <div className="relative">
                <Input
                  value={blogSection.title || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      blogSection: { ...DEFAULT_HOMEPAGE_CONTENT.blogSection, ...(prev.blogSection || {}), title: e.target.value },
                    }), 'homepageContent.blogSection.title')
                  }
                />
                <SavedIndicator field="homepageContent.blogSection.title" />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Subtitle</Label>
              <div className="relative">
                <Textarea
                  value={blogSection.subtitle || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      blogSection: { ...DEFAULT_HOMEPAGE_CONTENT.blogSection, ...(prev.blogSection || {}), subtitle: e.target.value },
                    }), 'homepageContent.blogSection.subtitle')
                  }
                  className="min-h-[80px]"
                />
                <SavedIndicator field="homepageContent.blogSection.subtitle" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>View All Text</Label>
              <div className="relative">
                <Input
                  value={blogSection.viewAllText || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      blogSection: { ...DEFAULT_HOMEPAGE_CONTENT.blogSection, ...(prev.blogSection || {}), viewAllText: e.target.value },
                    }), 'homepageContent.blogSection.viewAllText')
                  }
                />
                <SavedIndicator field="homepageContent.blogSection.viewAllText" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Card CTA Text</Label>
              <div className="relative">
                <Input
                  value={blogSection.readMoreText || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      blogSection: { ...DEFAULT_HOMEPAGE_CONTENT.blogSection, ...(prev.blogSection || {}), readMoreText: e.target.value },
                    }), 'homepageContent.blogSection.readMoreText')
                  }
                />
                <SavedIndicator field="homepageContent.blogSection.readMoreText" />
              </div>
            </div>
          </div>
        </div>

        {/* About Us */}
        <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              About Us
            </h2>
            <p className="text-xs text-muted-foreground mt-1">About section with company info and image.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Label</Label>
              <div className="relative">
                <Input
                  value={aboutSection.label || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      aboutSection: { ...DEFAULT_HOMEPAGE_CONTENT.aboutSection, ...(prev.aboutSection || {}), label: e.target.value },
                    }), 'homepageContent.aboutSection.label')
                  }
                />
                <SavedIndicator field="homepageContent.aboutSection.label" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <div className="relative">
                <Input
                  value={aboutSection.heading || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      aboutSection: { ...DEFAULT_HOMEPAGE_CONTENT.aboutSection, ...(prev.aboutSection || {}), heading: e.target.value },
                    }), 'homepageContent.aboutSection.heading')
                  }
                />
                <SavedIndicator field="homepageContent.aboutSection.heading" />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <div className="relative">
                <Textarea
                  value={aboutSection.description || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({
                      ...prev,
                      aboutSection: { ...DEFAULT_HOMEPAGE_CONTENT.aboutSection, ...(prev.aboutSection || {}), description: e.target.value },
                    }), 'homepageContent.aboutSection.description')
                  }
                  className="min-h-[100px]"
                />
                <SavedIndicator field="homepageContent.aboutSection.description" />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Image</Label>
              <div className="aspect-video w-full max-w-sm rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden relative group">
                {aboutImageUrl ? (
                  <img src={aboutImageUrl} alt="About preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <Image className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Click to upload</p>
                  </div>
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <input
                    type="file" className="hidden" accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const imagePath = await uploadFileToServer(file);
                        setAboutImageUrl(imagePath);
                        triggerAutoSave({ aboutImageUrl: imagePath }, ['aboutImageUrl']);
                        toast({ title: 'Success', description: 'Image uploaded successfully!' });
                      } catch (error: any) {
                        toast({ title: 'Upload error', description: error.message, variant: 'destructive' });
                      }
                    }}
                  />
                  <Plus className="w-8 h-8 text-white" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Areas Served */}
      <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Areas Served
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Geographic coverage section with map.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Label</Label>
            <div className="relative">
              <Input
                value={areasServedSection.label || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: { ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection, ...(prev.areasServedSection || {}), label: e.target.value },
                  }), 'homepageContent.areasServedSection.label')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.label" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Heading</Label>
            <div className="relative">
              <Input
                value={areasServedSection.heading || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: { ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection, ...(prev.areasServedSection || {}), heading: e.target.value },
                  }), 'homepageContent.areasServedSection.heading')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.heading" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <div className="relative">
              <Textarea
                value={areasServedSection.description || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: { ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection, ...(prev.areasServedSection || {}), description: e.target.value },
                  }), 'homepageContent.areasServedSection.description')
                }
                className="min-h-[100px]"
              />
              <SavedIndicator field="homepageContent.areasServedSection.description" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA Text</Label>
            <div className="relative">
              <Input
                value={areasServedSection.ctaText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: { ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection, ...(prev.areasServedSection || {}), ctaText: e.target.value },
                  }), 'homepageContent.areasServedSection.ctaText')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.ctaText" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
