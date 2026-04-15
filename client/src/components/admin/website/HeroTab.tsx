import { useState, type ChangeEvent } from 'react';
import { Image, Loader2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToServer } from '../shared/utils';

interface HeroTabProps {
  heroTitle: string;
  setHeroTitle: (v: string) => void;
  heroSubtitle: string;
  setHeroSubtitle: (v: string) => void;
  ctaText: string;
  setCtaText: (v: string) => void;
  heroImageUrl: string;
  setHeroImageUrl: (v: string) => void;
  triggerAutoSave: (updates: Record<string, unknown>, fieldKeys?: string[]) => void;
  saveHeroSettings: (updates: Record<string, unknown>, fieldKeys?: string[]) => Promise<void>;
  SavedIndicator: React.FC<{ field: string }>;
}

export function HeroTab({
  heroTitle, setHeroTitle,
  heroSubtitle, setHeroSubtitle,
  ctaText, setCtaText,
  heroImageUrl, setHeroImageUrl,
  triggerAutoSave,
  saveHeroSettings,
  SavedIndicator,
}: HeroTabProps) {
  const { toast } = useToast();
  const [isUploadingHeroImage, setIsUploadingHeroImage] = useState(false);

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
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Hero Content */}
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Hero Content
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Main heading, subtitle and call-to-action displayed at the top of the page.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
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
          <div className="space-y-2">
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

      {/* Background Image */}
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Background Image
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Main background image for the hero section.</p>
        </div>

        <div className="aspect-video w-full rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden relative group">
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
    </div>
  );
}
