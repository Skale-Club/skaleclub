import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Globe, Image, Link2, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { AdminCard, SectionHeader } from './shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { SEOSettingsData } from './shared/types';
import { DEFAULT_PAGE_SLUGS, resolvePageSlugs, type PageSlugs } from '@shared/pageSlugs';
import { uploadFileToServer } from './shared/utils';

type SEOTab = 'meta' | 'social' | 'slugs';

const SEO_TABS: { id: SEOTab; label: string; icon: typeof Search }[] = [
  { id: 'meta', label: 'Meta Tags', icon: Search },
  { id: 'social', label: 'Social', icon: Globe },
  { id: 'slugs', label: 'URL Slugs', icon: Link2 },
];

const PAGE_SLUG_FIELDS: { key: keyof PageSlugs; label: string; placeholder: string; helpText: string }[] = [
  { key: 'contact', label: 'Contact', placeholder: 'contact', helpText: 'Public contact page.' },
  { key: 'faq', label: 'FAQ', placeholder: 'faq', helpText: 'Frequently asked questions page.' },
  { key: 'portfolio', label: 'Portfolio', placeholder: 'portfolio', helpText: 'Portfolio/services listing page.' },
  { key: 'blog', label: 'Blog', placeholder: 'blog', helpText: 'Blog index. Posts become /blog-slug/post-slug.' },
  { key: 'links', label: 'Links', placeholder: 'links', helpText: 'Bio links landing page.' },
  { key: 'vcard', label: 'VCard', placeholder: 'vcard', helpText: 'Digital card prefix. Profiles become /vcard-slug/username.' },
  { key: 'thankYou', label: 'Thank You', placeholder: 'thankyou', helpText: 'Post-form confirmation page.' },
  { key: 'privacyPolicy', label: 'Privacy Policy', placeholder: 'privacy-policy', helpText: 'Privacy policy page.' },
  { key: 'termsOfService', label: 'Terms of Service', placeholder: 'terms-of-service', helpText: 'Terms page.' },
];

export function SEOSection() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SEOTab>('meta');
  const [settings, setSettings] = useState<SEOSettingsData>({
    seoTitle: '',
    seoDescription: '',
    ogImage: '',
    seoKeywords: '',
    seoAuthor: '',
    seoCanonicalUrl: '',
    seoRobotsTag: 'index, follow',
    ogType: 'website',
    ogSiteName: '',
    twitterCard: 'summary_large_image',
    twitterSite: '',
    twitterCreator: '',
    schemaLocalBusiness: null,
    pageSlugs: DEFAULT_PAGE_SLUGS,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: fetchedSettings, isLoading } = useQuery<SEOSettingsData>({
    queryKey: ['/api/company-settings']
  });

  useEffect(() => {
    if (fetchedSettings) {
      setSettings(prev => ({
        ...prev,
        seoTitle: fetchedSettings.seoTitle || '',
        seoDescription: fetchedSettings.seoDescription || '',
        ogImage: fetchedSettings.ogImage || '',
        seoKeywords: fetchedSettings.seoKeywords || '',
        seoAuthor: fetchedSettings.seoAuthor || '',
        seoCanonicalUrl: fetchedSettings.seoCanonicalUrl || '',
        seoRobotsTag: fetchedSettings.seoRobotsTag || 'index, follow',
        ogType: fetchedSettings.ogType || 'website',
        ogSiteName: fetchedSettings.ogSiteName || '',
        twitterCard: fetchedSettings.twitterCard || 'summary_large_image',
        twitterSite: fetchedSettings.twitterSite || '',
        twitterCreator: fetchedSettings.twitterCreator || '',
        schemaLocalBusiness: fetchedSettings.schemaLocalBusiness || null,
        pageSlugs: resolvePageSlugs(fetchedSettings.pageSlugs),
      }));
    }
  }, [fetchedSettings]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveSettings = useCallback(async (newSettings: Partial<SEOSettingsData>) => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/company-settings', newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      setLastSaved(new Date());
    } catch (error: any) {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const updateField = useCallback(<K extends keyof SEOSettingsData>(field: K, value: SEOSettingsData[K]) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ [field]: value });
    }, 800);
  }, [saveSettings]);

  const updatePageSlug = useCallback((field: keyof PageSlugs, value: string) => {
    const nextPageSlugs = {
      ...(settings.pageSlugs || DEFAULT_PAGE_SLUGS),
      [field]: value,
    };
    setSettings(prev => ({ ...prev, pageSlugs: nextPageSlugs }));
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const sanitized = resolvePageSlugs(nextPageSlugs);
      setSettings(prev => ({ ...prev, pageSlugs: sanitized }));
      saveSettings({ pageSlugs: sanitized });
    }, 800);
  }, [saveSettings, settings.pageSlugs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="SEO"
        description="Meta tags, social sharing and URL configuration"
        icon={<Search className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span>Auto-saved</span>
              </>
            ) : null}
          </div>
        }
      />

      {/* Tab Navigation */}
      <div className="flex gap-1.5 bg-muted p-1.5 rounded-lg overflow-x-auto">
        {SEO_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex-1 min-w-0 justify-center ${
              activeTab === tab.id
                ? 'bg-white dark:bg-card border-border shadow-sm'
                : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-card/50'
            }`}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Meta Tags Tab */}
      {activeTab === 'meta' && (
        <AdminCard className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Meta Tags
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Basic tags that appear in search results and browser tabs.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="seoTitle">Page Title</Label>
              <Input
                id="seoTitle"
                value={settings.seoTitle || ''}
                onChange={(e) => updateField('seoTitle', e.target.value)}
                placeholder="Your Business - Main Service"
                data-testid="input-seo-title"
              />
              <p className="text-xs text-muted-foreground">Appears in browser tab and search results (50–60 characters recommended)</p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="seoDescription">Meta Description</Label>
              <Textarea
                id="seoDescription"
                value={settings.seoDescription || ''}
                onChange={(e) => updateField('seoDescription', e.target.value)}
                placeholder="Brief description of your business and services..."
                rows={3}
                data-testid="input-seo-description"
              />
              <p className="text-xs text-muted-foreground">Shown in search results (150–160 characters recommended)</p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="seoKeywords">Keywords</Label>
              <Input
                id="seoKeywords"
                value={settings.seoKeywords || ''}
                onChange={(e) => updateField('seoKeywords', e.target.value)}
                placeholder="marketing services, business consulting, professional marketers"
                data-testid="input-seo-keywords"
              />
              <p className="text-xs text-muted-foreground">Comma-separated keywords relevant to your business</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seoAuthor">Author / Publisher</Label>
              <Input
                id="seoAuthor"
                value={settings.seoAuthor || ''}
                onChange={(e) => updateField('seoAuthor', e.target.value)}
                placeholder="Your Company Name"
                data-testid="input-seo-author"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seoCanonicalUrl">Canonical URL</Label>
              <Input
                id="seoCanonicalUrl"
                value={settings.seoCanonicalUrl || ''}
                onChange={(e) => updateField('seoCanonicalUrl', e.target.value)}
                placeholder="https://yourdomain.com"
                data-testid="input-seo-canonical"
              />
              <p className="text-xs text-muted-foreground">Your main website URL (prevents duplicate content issues)</p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="seoRobotsTag">Robots Tag</Label>
              <Select
                value={settings.seoRobotsTag || 'index, follow'}
                onValueChange={(value) => updateField('seoRobotsTag', value)}
              >
                <SelectTrigger data-testid="select-robots-tag">
                  <SelectValue placeholder="Select robots directive" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="index, follow">Index, Follow (recommended)</SelectItem>
                  <SelectItem value="index, nofollow">Index, No Follow</SelectItem>
                  <SelectItem value="noindex, follow">No Index, Follow</SelectItem>
                  <SelectItem value="noindex, nofollow">No Index, No Follow</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Controls how search engines crawl and index your site</p>
            </div>
          </div>
        </AdminCard>
      )}

      {/* Social Tab */}
      {activeTab === 'social' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <AdminCard className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Open Graph
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Shown when your page is shared on Facebook, LinkedIn, etc.</p>
            </div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="ogSiteName">Site Name</Label>
                <Input
                  id="ogSiteName"
                  value={settings.ogSiteName || ''}
                  onChange={(e) => updateField('ogSiteName', e.target.value)}
                  placeholder="Your Business Name"
                  data-testid="input-og-site-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ogType">Content Type</Label>
                <Select
                  value={settings.ogType || 'website'}
                  onValueChange={(value) => updateField('ogType', value)}
                >
                  <SelectTrigger data-testid="select-og-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="business.business">Business</SelectItem>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>OG Image</Label>
                <p className="text-xs text-muted-foreground">Image shown when shared on social (1200×630px recommended)</p>
                <div className="flex flex-col gap-3">
                  <div className="aspect-[1.91/1] w-full rounded-lg border-2 border-dashed border-border bg-card flex items-center justify-center overflow-hidden relative group">
                    {settings.ogImage ? (
                      <img src={settings.ogImage} alt="OG Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">1200 × 630 px</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Input
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const imagePath = await uploadFileToServer(file);
                            setSettings(prev => ({ ...prev, ogImage: imagePath }));
                            await saveSettings({ ogImage: imagePath });
                            toast({ title: 'Open Graph image uploaded' });
                          } catch (error: any) {
                            toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                          }
                        }}
                        accept="image/*"
                      />
                      <Plus className="w-8 h-8 text-white" />
                    </label>
                  </div>
                  {settings.ogImage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, ogImage: '' }));
                        saveSettings({ ogImage: '' });
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Remove Image
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </AdminCard>

          <AdminCard className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Twitter / X Cards
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Controls how your page looks when shared on Twitter/X.</p>
            </div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="twitterCard">Card Type</Label>
                <Select
                  value={settings.twitterCard || 'summary_large_image'}
                  onValueChange={(value) => updateField('twitterCard', value)}
                >
                  <SelectTrigger data-testid="select-twitter-card">
                    <SelectValue placeholder="Select card type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Summary</SelectItem>
                    <SelectItem value="summary_large_image">Summary with Large Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterSite">@username (Site)</Label>
                <Input
                  id="twitterSite"
                  value={settings.twitterSite || ''}
                  onChange={(e) => updateField('twitterSite', e.target.value)}
                  placeholder="@yourbusiness"
                  data-testid="input-twitter-site"
                />
                <p className="text-xs text-muted-foreground">Your business Twitter handle</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterCreator">@username (Creator)</Label>
                <Input
                  id="twitterCreator"
                  value={settings.twitterCreator || ''}
                  onChange={(e) => updateField('twitterCreator', e.target.value)}
                  placeholder="@yourhandle"
                  data-testid="input-twitter-creator"
                />
              </div>
            </div>
          </AdminCard>
        </div>
      )}

      {/* URL Slugs Tab */}
      {activeTab === 'slugs' && (
        <AdminCard className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              URL Slugs
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Customize the URL path for each public page.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PAGE_SLUG_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`page-slug-${field.key}`}>{field.label}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/</span>
                  <Input
                    id={`page-slug-${field.key}`}
                    value={settings.pageSlugs?.[field.key] || ''}
                    onChange={(e) => updatePageSlug(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="pl-7"
                    data-testid={`input-page-slug-${field.key}`}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
              </div>
            ))}
          </div>
        </AdminCard>
      )}
    </div>
  );
}
