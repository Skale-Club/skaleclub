import { useEffect, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getImageUrl, uploadFileToServer } from '../shared/utils';
import type { CompanySettings, HomepageContent } from '@shared/schema';

type PortfolioHero = NonNullable<HomepageContent['portfolioHero']>;
type PortfolioCtaSection = NonNullable<HomepageContent['portfolioCtaSection']>;

export function PortfolioHeroSettings() {
  const { toast } = useToast();

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });

  const [badge, setBadge] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [ctaTitle, setCtaTitle] = useState('');
  const [ctaSubtitle, setCtaSubtitle] = useState('');
  const [ctaButtonText, setCtaButtonText] = useState('');
  const [ctaBackgroundImage, setCtaBackgroundImage] = useState('');
  const [isCtaUploading, setIsCtaUploading] = useState(false);

  useEffect(() => {
    const ph = companySettings?.homepageContent?.portfolioHero;
    setBadge(ph?.badge ?? '');
    setTitle(ph?.title ?? '');
    setSubtitle(ph?.subtitle ?? '');
    setButtonText(ph?.buttonText ?? '');
    setBackgroundImage(ph?.backgroundImage ?? '');

    const cta = companySettings?.homepageContent?.portfolioCtaSection;
    setCtaTitle(cta?.title ?? '');
    setCtaSubtitle(cta?.subtitle ?? '');
    setCtaButtonText(cta?.buttonText ?? '');
    setCtaBackgroundImage(cta?.backgroundImage ?? '');
  }, [companySettings]);

  const save = useMutation({
    mutationFn: async (data: { hero: PortfolioHero; cta: PortfolioCtaSection }) => {
      const homepageContent = {
        ...(companySettings?.homepageContent || {}),
        portfolioHero: data.hero,
        portfolioCtaSection: data.cta,
      };
      const res = await apiRequest('PUT', '/api/company-settings', { homepageContent });
      return res.json() as Promise<CompanySettings>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<CompanySettings>(['/api/company-settings'], updated);
      toast({ title: 'Portfolio settings saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    },
  });

  const persist = (overrides: Partial<PortfolioHero>) =>
    save.mutate({
      hero: { badge, title, subtitle, buttonText, backgroundImage, ...overrides },
      cta: { title: ctaTitle, subtitle: ctaSubtitle, buttonText: ctaButtonText, backgroundImage: ctaBackgroundImage },
    });

  const persistCta = (overrides: Partial<PortfolioCtaSection>) =>
    save.mutate({
      hero: { badge, title, subtitle, buttonText, backgroundImage },
      cta: { title: ctaTitle, subtitle: ctaSubtitle, buttonText: ctaButtonText, backgroundImage: ctaBackgroundImage, ...overrides },
    });

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const path = await uploadFileToServer(file);
      setBackgroundImage(path);
      persist({ backgroundImage: path });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = () => {
    setBackgroundImage('');
    persist({ backgroundImage: '' });
  };

  const handleCtaImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCtaUploading(true);
    try {
      const path = await uploadFileToServer(file);
      setCtaBackgroundImage(path);
      persistCta({ backgroundImage: path });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsCtaUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveCtaImage = () => {
    setCtaBackgroundImage('');
    persistCta({ backgroundImage: '' });
  };

  return (
    <div className="bg-card p-6 sm:p-8 space-y-6">
      <DialogHeader className="space-y-2 text-left">
        <DialogTitle className="flex items-center gap-2 text-xl">
          <ImageIcon className="w-5 h-5 text-primary" />
          Portfolio Hero
        </DialogTitle>
        <DialogDescription>
          The badge, title, subtitle, button and background image shown at the top of the portfolio page.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="portfolioHeroBadge">Badge text</Label>
            <Input
              id="portfolioHeroBadge"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              placeholder="Our Services"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="portfolioHeroTitle">Title</Label>
            <Input
              id="portfolioHeroTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Scale Your Business"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="portfolioHeroSubtitle">Subtitle</Label>
            <Input
              id="portfolioHeroSubtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Explore the tools and services we've built to help businesses grow."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="portfolioHeroButtonText">Button text</Label>
            <Input
              id="portfolioHeroButtonText"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder="Book a Strategy Session"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Background image</Label>
          <div className="aspect-video w-full rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden relative group">
            {isUploading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <p className="text-sm font-medium text-white">Uploading...</p>
              </div>
            )}

            {backgroundImage ? (
              <img
                src={getImageUrl(backgroundImage, { width: 800, quality: 80 })}
                alt="Portfolio hero background preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-4">
                <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Click to upload background image</p>
              </div>
            )}

            <label className={`absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 ${isUploading ? 'pointer-events-none' : ''}`}>
              <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" disabled={isUploading} />
              <Plus className="w-8 h-8 text-white" />
            </label>

            {backgroundImage && !isUploading && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-red-500/80"
                title="Remove image"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Uploaded images are converted to WebP automatically.</p>
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-6">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Bottom CTA</h3>
          <p className="text-sm text-muted-foreground">
            The call-to-action section shown at the bottom of the portfolio page.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="portfolioCtaTitle">Title</Label>
              <Input
                id="portfolioCtaTitle"
                value={ctaTitle}
                onChange={(e) => setCtaTitle(e.target.value)}
                placeholder="Ready to Redefine Your Potential?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolioCtaButtonText">Button text</Label>
              <Input
                id="portfolioCtaButtonText"
                value={ctaButtonText}
                onChange={(e) => setCtaButtonText(e.target.value)}
                placeholder="Book a Strategy Session"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="portfolioCtaSubtitle">Subtitle</Label>
              <Input
                id="portfolioCtaSubtitle"
                value={ctaSubtitle}
                onChange={(e) => setCtaSubtitle(e.target.value)}
                placeholder="Join the forward-thinking companies already scaling with Skale Club."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Background image</Label>
            <div className="aspect-video w-full rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden relative group">
              {isCtaUploading && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                  <p className="text-sm font-medium text-white">Uploading...</p>
                </div>
              )}

              {ctaBackgroundImage ? (
                <img
                  src={getImageUrl(ctaBackgroundImage, { width: 800, quality: 80 })}
                  alt="Portfolio CTA background preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload background image</p>
                </div>
              )}

              <label className={`absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 ${isCtaUploading ? 'pointer-events-none' : ''}`}>
                <input type="file" className="hidden" onChange={handleCtaImageUpload} accept="image/*" disabled={isCtaUploading} />
                <Plus className="w-8 h-8 text-white" />
              </label>

              {ctaBackgroundImage && !isCtaUploading && (
                <button
                  type="button"
                  onClick={handleRemoveCtaImage}
                  className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-red-500/80"
                  title="Remove image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Uploaded images are converted to WebP automatically.</p>
          </div>
        </div>
      </div>

      <Button
        size="sm"
        onClick={() => persistCta({})}
        disabled={save.isPending}
      >
        {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Save
      </Button>
    </div>
  );
}
