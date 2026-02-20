import { useState, type ChangeEvent } from 'react';
import { BadgeCheck, Image, Loader2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import type { HomepageContent } from '@shared/schema';
import { uploadFileToServer } from '../shared/utils';
import { Clock, Heart, Shield, Sparkles, Star, ThumbsUp, Trophy } from 'lucide-react';

const badgeIconOptions = [
  { label: 'Star', value: 'star', icon: Star },
  { label: 'Shield', value: 'shield', icon: Shield },
  { label: 'Clock', value: 'clock', icon: Clock },
  { label: 'Sparkles', value: 'sparkles', icon: Sparkles },
  { label: 'Heart', value: 'heart', icon: Heart },
  { label: 'Badge Check', value: 'badgeCheck', icon: BadgeCheck },
  { label: 'Thumbs Up', value: 'thumbsUp', icon: ThumbsUp },
  { label: 'Trophy', value: 'trophy', icon: Trophy },
];

interface HeroTabProps {
  heroTitle: string;
  setHeroTitle: (v: string) => void;
  heroSubtitle: string;
  setHeroSubtitle: (v: string) => void;
  ctaText: string;
  setCtaText: (v: string) => void;
  heroImageUrl: string;
  setHeroImageUrl: (v: string) => void;
  homepageContent: HomepageContent;
  updateHomepageContent: (updater: (prev: HomepageContent) => HomepageContent, fieldKey?: string) => void;
  triggerAutoSave: (updates: Record<string, unknown>, fieldKeys?: string[]) => void;
  saveHeroSettings: (updates: Record<string, unknown>, fieldKeys?: string[]) => Promise<void>;
  SavedIndicator: React.FC<{ field: string }>;
}

export function HeroTab({
  heroTitle, setHeroTitle,
  heroSubtitle, setHeroSubtitle,
  ctaText, setCtaText,
  heroImageUrl, setHeroImageUrl,
  homepageContent,
  updateHomepageContent,
  triggerAutoSave,
  saveHeroSettings,
  SavedIndicator,
}: HeroTabProps) {
  const { toast } = useToast();
  const [isUploadingHeroImage, setIsUploadingHeroImage] = useState(false);
  const [isUploadingBadgeImage, setIsUploadingBadgeImage] = useState(false);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingHeroImage(true);
    try {
      const imagePath = await uploadFileToServer(file);
      setHeroImageUrl(imagePath);
      await saveHeroSettings({ heroImageUrl: imagePath }, ['heroImageUrl']);
      toast({ title: 'Success!', description: 'Hero image uploaded and saved successfully', duration: 3000 });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploadingHeroImage(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Content */}
      <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Hero Content
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Main heading, subtitle and call-to-action displayed at the top of the page.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="heroTitle">Title</Label>
            <div className="relative">
              <Input
                id="heroTitle"
                value={heroTitle}
                onChange={(e) => { setHeroTitle(e.target.value); triggerAutoSave({ heroTitle: e.target.value }, ['heroTitle']); }}
                placeholder="Enter hero title"
              />
              <SavedIndicator field="heroTitle" />
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="heroSubtitle">Subtitle</Label>
            <div className="relative">
              <Textarea
                id="heroSubtitle"
                value={heroSubtitle}
                onChange={(e) => { setHeroSubtitle(e.target.value); triggerAutoSave({ heroSubtitle: e.target.value }, ['heroSubtitle']); }}
                placeholder="Enter hero subtitle"
                className="min-h-[100px]"
              />
              <SavedIndicator field="heroSubtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ctaText">CTA Button Text</Label>
            <div className="relative">
              <Input
                id="ctaText"
                value={ctaText}
                onChange={(e) => { setCtaText(e.target.value); triggerAutoSave({ ctaText: e.target.value }, ['ctaText']); }}
                placeholder="Schedule Free Consultation"
              />
              <SavedIndicator field="ctaText" />
            </div>
          </div>
        </div>
      </div>

      {/* Hero Image */}
      <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Background Image
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Main background image for the hero section.</p>
        </div>

        <div className="aspect-[16/7] w-full max-w-lg rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden relative group">
          {isUploadingHeroImage && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 z-10">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <p className="text-sm text-white font-medium">Uploading...</p>
            </div>
          )}
          {heroImageUrl ? (
            <img src={heroImageUrl} alt="Hero preview" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center p-4">
              <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Click to upload background image</p>
            </div>
          )}
          <label className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer ${isUploadingHeroImage ? 'pointer-events-none' : ''}`}>
            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" disabled={isUploadingHeroImage} />
            <Plus className="w-8 h-8 text-white" />
          </label>
        </div>
      </div>

      {/* Hero Badge */}
      <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-primary" />
            Hero Badge
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Trust badge displayed on the hero section.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
          <div className="space-y-2">
            <Label>Badge Image</Label>
            <div className="aspect-square w-full rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden relative group">
              {isUploadingBadgeImage && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 z-10">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                  <p className="text-xs text-white font-medium">Uploading...</p>
                </div>
              )}
              {homepageContent.heroBadgeImageUrl ? (
                <img src={homepageContent.heroBadgeImageUrl} alt="Badge preview" className="w-full h-full object-contain p-3" />
              ) : (
                <div className="text-center p-4">
                  <BadgeCheck className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Click to upload</p>
                </div>
              )}
              <label className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer ${isUploadingBadgeImage ? 'pointer-events-none' : ''}`}>
                <input
                  type="file" className="hidden" accept="image/*" disabled={isUploadingBadgeImage}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsUploadingBadgeImage(true);
                    try {
                      const imagePath = await uploadFileToServer(file);
                      updateHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: imagePath }), 'homepageContent.heroBadgeImageUrl');
                      triggerAutoSave({ homepageContent: { ...(homepageContent || {}), heroBadgeImageUrl: imagePath } }, ['homepageContent.heroBadgeImageUrl']);
                      toast({ title: 'Success!', description: 'Badge image uploaded', duration: 3000 });
                    } catch (error: any) {
                      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                    } finally {
                      setIsUploadingBadgeImage(false);
                      if (e.target) e.target.value = '';
                    }
                  }}
                />
                <Plus className="w-6 h-6 text-white" />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Alt Text</Label>
              <div className="relative">
                <Input
                  value={homepageContent.heroBadgeAlt || ''}
                  onChange={(e) => updateHomepageContent(prev => ({ ...prev, heroBadgeAlt: e.target.value }), 'homepageContent.heroBadgeAlt')}
                  placeholder="Trusted Experts"
                />
                <SavedIndicator field="homepageContent.heroBadgeAlt" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <Select
                value={homepageContent.trustBadges?.[0]?.icon || 'star'}
                onValueChange={(value) => {
                  updateHomepageContent(prev => {
                    const badges = [...(prev.trustBadges || DEFAULT_HOMEPAGE_CONTENT.trustBadges || [])];
                    badges[0] = { ...(badges[0] || {}), icon: value };
                    return { ...prev, trustBadges: badges };
                  }, 'homepageContent.trustBadges.0.icon');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {badgeIconOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="w-4 h-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
