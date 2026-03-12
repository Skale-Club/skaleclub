import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Plus, Trash2, GripVertical, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { CompanySettingsData } from './shared/types';
import type { LinksPageConfig, LinksPageLink, LinksPageSocial } from '@shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

const LINKS_PAGE_DEFAULTS: LinksPageConfig = {
  avatarUrl: '/attached_assets/ghl-logo.webp',
  title: 'Skale Club',
  description: 'Data-Driven Marketing & Scalable Growth Solutions',
  links: [],
  socialLinks: []
};

export function LinksSection() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings'],
  });

  const [config, setConfig] = useState<LinksPageConfig>(LINKS_PAGE_DEFAULTS);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFields, setSavedFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (settings?.linksPageConfig) {
      setConfig(settings.linksPageConfig);
    }
  }, [settings]);

  const saveSettings = useCallback(async (newConfig: LinksPageConfig, fieldKey: string) => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/company-settings', { linksPageConfig: newConfig });
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      
      setSavedFields(prev => ({ ...prev, [fieldKey]: true }));
      setTimeout(() => {
        setSavedFields(prev => {
          const next = { ...prev };
          delete next[fieldKey];
          return next;
        });
      }, 3000);
    } catch (error: any) {
      toast({ 
        title: 'Error saving links configuration', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const updateConfig = (updates: Partial<LinksPageConfig>, fieldKey: string) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    // Use a small timeout for text fields to avoid too many requests
    saveSettings(newConfig, fieldKey);
  };

  const addLink = () => {
    const newLinks = [
      ...config.links,
      { title: 'New Link', url: 'https://', order: config.links.length }
    ];
    updateConfig({ links: newLinks }, 'links');
  };

  const removeLink = (index: number) => {
    const newLinks = config.links.filter((_, i) => i !== index);
    updateConfig({ links: newLinks }, 'links');
  };

  const updateLink = (index: number, updates: Partial<LinksPageLink>) => {
    const newLinks = [...config.links];
    newLinks[index] = { ...newLinks[index], ...updates };
    updateConfig({ links: newLinks }, 'links');
  };

  const addSocial = () => {
    const newSocials = [
      ...config.socialLinks,
      { platform: 'instagram', url: 'https://instagram.com/', order: config.socialLinks.length }
    ];
    updateConfig({ socialLinks: newSocials }, 'socialLinks');
  };

  const removeSocial = (index: number) => {
    const newSocials = config.socialLinks.filter((_, i) => i !== index);
    updateConfig({ socialLinks: newSocials }, 'socialLinks');
  };

  const updateSocial = (index: number, updates: Partial<LinksPageSocial>) => {
    const newSocials = [...config.socialLinks];
    newSocials[index] = { ...newSocials[index], ...updates };
    updateConfig({ socialLinks: newSocials }, 'socialLinks');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const SavedIndicator = ({ field }: { field: string }) => (
    savedFields[field] ? (
      <div className="flex items-center gap-1 text-green-600 text-xs animate-in fade-in duration-300">
        <Check className="w-3 h-3" />
        <span>Saved</span>
      </div>
    ) : null
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Links Page</h1>
          <p className="text-muted-foreground">Manage your bio links and social media profiles</p>
        </div>
        <div className="flex items-center gap-3">
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href="/links" target="_blank" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              View Page
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Settings */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile Information</CardTitle>
              <CardDescription>How you appear on the links page</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="avatarUrl">Avatar URL</Label>
                  <SavedIndicator field="avatarUrl" />
                </div>
                <Input 
                  id="avatarUrl"
                  value={config.avatarUrl}
                  onChange={(e) => setConfig({ ...config, avatarUrl: e.target.value })}
                  onBlur={() => saveSettings(config, 'avatarUrl')}
                  placeholder="/attached_assets/logo.png"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="title">Page Title</Label>
                  <SavedIndicator field="title" />
                </div>
                <Input 
                  id="title"
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  onBlur={() => saveSettings(config, 'title')}
                  placeholder="Skale Club"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="description">Short Bio</Label>
                  <SavedIndicator field="description" />
                </div>
                <Textarea 
                  id="description"
                  value={config.description}
                  onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  onBlur={() => saveSettings(config, 'description')}
                  placeholder="Marketing agency specializing in growth..."
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Social Links</CardTitle>
                  <CardDescription>Icons at the bottom</CardDescription>
                </div>
                <Button size="icon" variant="outline" onClick={addSocial} className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.socialLinks.map((social, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <Input 
                      value={social.platform}
                      onChange={(e) => updateSocial(index, { platform: e.target.value })}
                      placeholder="instagram, linkedin..."
                    />
                    <Input 
                      value={social.url}
                      onChange={(e) => updateSocial(index, { url: e.target.value })}
                      placeholder="URL"
                    />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeSocial(index)} className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {config.socialLinks.length === 0 && (
                <p className="text-center py-4 text-sm text-muted-foreground italic">
                  No social links added yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Links */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Main Links</CardTitle>
                  <CardDescription>The primary action buttons on your page</CardDescription>
                </div>
                <Button onClick={addLink} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add New Link
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.links.map((link, index) => (
                <div key={index} className="p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/20 group relative">
                  <div className="flex gap-4">
                    <div className="mt-2 text-muted-foreground group-hover:text-foreground cursor-grab">
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                      <div className="space-y-2">
                        <Label>Link Title</Label>
                        <Input 
                          value={link.title}
                          onChange={(e) => updateLink(index, { title: e.target.value })}
                          placeholder="My Portfolio"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Destination URL</Label>
                        <Input 
                          value={link.url}
                          onChange={(e) => updateLink(index, { url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => removeLink(index)} 
                      className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {config.links.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground">You haven't added any links yet.</p>
                  <Button variant="ghost" onClick={addLink}>Add your first link</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
