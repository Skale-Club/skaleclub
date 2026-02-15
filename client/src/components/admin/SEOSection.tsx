import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Globe, Image, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { SEOSettingsData } from './shared/types';
import { uploadFileToServer } from './shared/utils';
export function SEOSection() {
  const { toast } = useToast();
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
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ [field]: value });
    }, 800);
  }, [saveSettings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">SEO Settings</h1>
          <p className="text-muted-foreground">Optimize your site for search engines and social media</p>
        </div>
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Basic SEO
            </h2>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="seoTitle">Page Title</Label>
                <Input 
                  id="seoTitle" 
                  value={settings.seoTitle || ''} 
                  onChange={(e) => updateField('seoTitle', e.target.value)}
                  placeholder="Your Business - Main Service"
                  data-testid="input-seo-title"
                />
                <p className="text-xs text-muted-foreground">
                  Appears in browser tab and search results (50-60 characters recommended)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoDescription">Meta Description</Label>
                <Textarea 
                  id="seoDescription" 
                  value={settings.seoDescription || ''} 
                  onChange={(e) => updateField('seoDescription', e.target.value)}
                  placeholder="Brief description of your business and services..."
                  rows={3}
                  data-testid="input-seo-description"
                />
                <p className="text-xs text-muted-foreground">
                  Shown in search results (150-160 characters recommended)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoKeywords">Keywords</Label>
                <Input 
                  id="seoKeywords" 
                  value={settings.seoKeywords || ''} 
                  onChange={(e) => updateField('seoKeywords', e.target.value)}
                  placeholder="marketing services, business consulting, professional marketers"
                  data-testid="input-seo-keywords"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated keywords relevant to your business
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Your main website URL (prevents duplicate content issues)
                </p>
              </div>

              <div className="space-y-2">
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
                <p className="text-xs text-muted-foreground">
                  Controls how search engines crawl and index your site
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Open Graph (Social Sharing)
            </h2>
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
                <p className="text-xs text-muted-foreground mb-2">
                  Image shown when shared on Facebook, LinkedIn, etc. (1200x630px recommended)
                </p>
                <div className="flex flex-col gap-3">
                  <div className="aspect-[1.91/1] w-full max-w-xs rounded-lg border-2 border-dashed border-border bg-card flex items-center justify-center overflow-hidden relative group">
                    {settings.ogImage ? (
                      <img src={settings.ogImage} alt="OG Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">1200 x 630 px</p>
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
          </div>

          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Twitter Cards
            </h2>
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
                <Label htmlFor="twitterSite">Twitter @username (Site)</Label>
                <Input 
                  id="twitterSite" 
                  value={settings.twitterSite || ''} 
                  onChange={(e) => updateField('twitterSite', e.target.value)}
                  placeholder="@yourbusiness"
                  data-testid="input-twitter-site"
                />
                <p className="text-xs text-muted-foreground">
                  Your business Twitter handle
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterCreator">Twitter @username (Creator)</Label>
                <Input 
                  id="twitterCreator" 
                  value={settings.twitterCreator || ''} 
                  onChange={(e) => updateField('twitterCreator', e.target.value)}
                  placeholder="@yourhandle"
                  data-testid="input-twitter-creator"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

