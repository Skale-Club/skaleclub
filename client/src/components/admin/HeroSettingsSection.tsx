import { arrayMove } from '@dnd-kit/sortable';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, BadgeCheck, Check, Clock, FileText, FolderOpen, Heart, Image, LayoutGrid, LineChart, List, Loader2, MapPin, PhoneCall, Plus, Search, Shield, Sparkles, Star, Target, ThumbsUp, Trash2, Trophy, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ConsultingStep, HomepageContent } from '@shared/schema';
import { SIDEBAR_MENU_ITEMS } from './shared/constants';
import type { CompanySettingsData } from './shared/types';
import { uploadFileToServer } from './shared/utils';
export function HeroSettingsSection() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });
  const heroMenuTitle = SIDEBAR_MENU_ITEMS.find((item) => item.id === 'hero')?.title ?? 'Hero Section';

  const HERO_DEFAULTS = {
    title: 'Gere clientes de forma previsível',
    subtitle: 'Consultoria em marketing digital para prestadores de serviço nos EUA. Transforme seu negócio com estratégias comprovadas de aquisição e conversão de clientes.',
    ctaText: 'Agendar Conversa Gratuita',
    image: '',
  };

  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [aboutImageUrl, setAboutImageUrl] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [homepageContent, setHomepageContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingHeroImage, setIsUploadingHeroImage] = useState(false);
  const [isUploadingBadgeImage, setIsUploadingBadgeImage] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFieldTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [savedFields, setSavedFields] = useState<Record<string, boolean>>({});
  const SavedIndicator = ({ field }: { field: string }) => (
    savedFields[field] ? (
      <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" />
    ) : null
  );

  useEffect(() => {
    if (settings) {
      console.log('Loading settings, heroImageUrl from DB:', settings.heroImageUrl);
      setHeroTitle(settings.heroTitle || HERO_DEFAULTS.title);
      setHeroSubtitle(settings.heroSubtitle || HERO_DEFAULTS.subtitle);
      setHeroImageUrl(settings.heroImageUrl || HERO_DEFAULTS.image);
      setAboutImageUrl(settings.aboutImageUrl || '');
      setCtaText(settings.ctaText || HERO_DEFAULTS.ctaText);
      setHomepageContent({
        ...DEFAULT_HOMEPAGE_CONTENT,
        ...(settings.homepageContent || {}),
        trustBadges: settings.homepageContent?.trustBadges?.length
          ? settings.homepageContent.trustBadges
          : DEFAULT_HOMEPAGE_CONTENT.trustBadges,
        categoriesSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
          ...(settings.homepageContent?.categoriesSection || {}),
        },
        reviewsSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
          ...(settings.homepageContent?.reviewsSection || {}),
        },
        blogSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
          ...(settings.homepageContent?.blogSection || {}),
        },
        aboutSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.aboutSection,
          ...(settings.homepageContent?.aboutSection || {}),
        },
        areasServedSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
          ...(settings.homepageContent?.areasServedSection || {}),
        },
        consultingStepsSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection,
          ...(settings.homepageContent?.consultingStepsSection || {}),
          steps: (settings.homepageContent?.consultingStepsSection?.steps?.length
            ? settings.homepageContent.consultingStepsSection.steps
            : DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection?.steps) || [],
        },
      });
    }
  }, [settings]);

  useEffect(() => {
    if (!isLoading && !settings) {
      setHeroTitle(HERO_DEFAULTS.title);
      setHeroSubtitle(HERO_DEFAULTS.subtitle);
      setHeroImageUrl(HERO_DEFAULTS.image);
      setAboutImageUrl('');
      setCtaText(HERO_DEFAULTS.ctaText);
      setHomepageContent(DEFAULT_HOMEPAGE_CONTENT);
    }
  }, [isLoading, settings]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      Object.values(savedFieldTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  const trustBadges = homepageContent.trustBadges || [];
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
  const consultingIconOptions = [
    { label: 'Pesquisa', value: 'search', icon: Search },
    { label: 'Diferencial', value: 'sparkles', icon: Sparkles },
    { label: 'Layout', value: 'layout', icon: LayoutGrid },
    { label: 'Foco', value: 'target', icon: Target },
    { label: 'Atendimento', value: 'phone-call', icon: PhoneCall },
    { label: 'Resultados', value: 'line-chart', icon: LineChart },
  ];
  const categoriesSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
    ...(homepageContent.categoriesSection || {}),
  };
  const reviewsSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
    ...(homepageContent.reviewsSection || {}),
  };
  const blogSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
    ...(homepageContent.blogSection || {}),
  };
  const aboutSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.aboutSection,
    ...(homepageContent.aboutSection || {}),
  };
  const areasServedSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
    ...(homepageContent.areasServedSection || {}),
  };
  const consultingStepsSection = useMemo(() => {
    const base = {
      ...DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection,
      ...(homepageContent.consultingStepsSection || {}),
    };
    const steps = base.steps?.length
      ? base.steps
      : DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection?.steps || [];
    return { ...base, steps };
  }, [homepageContent.consultingStepsSection]);
  const consultingSteps = useMemo(
    () =>
      [...(consultingStepsSection.steps || [])].sort(
        (a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel)
      ),
    [consultingStepsSection.steps]
  );
  const practicalBullets =
    consultingStepsSection.practicalBullets?.length && consultingStepsSection.practicalBullets.length > 0
      ? consultingStepsSection.practicalBullets
      : DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection?.practicalBullets || [];

  const markFieldsSaved = useCallback((fields: string[]) => {
    fields.forEach(field => {
      setSavedFields(prev => ({ ...prev, [field]: true }));
      if (savedFieldTimers.current[field]) {
        clearTimeout(savedFieldTimers.current[field]);
      }
      savedFieldTimers.current[field] = setTimeout(() => {
        setSavedFields(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }, 3000);
    });
  }, []);

  const saveHeroSettings = useCallback(async (updates: Partial<CompanySettingsData>, fieldKeys?: string[]) => {
    setIsSaving(true);
    console.log('saveHeroSettings called with:', updates);
    try {
      const response = await apiRequest('PUT', '/api/company-settings', updates);
      const savedData = await response.json();
      console.log('Saved data from server:', savedData);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      const keysToMark = fieldKeys && fieldKeys.length > 0 ? fieldKeys : Object.keys(updates);
      if (keysToMark.length > 0) {
        markFieldsSaved(keysToMark);
      }
    } catch (error: any) {
      toast({ 
        title: 'Error saving hero settings', 
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  const triggerAutoSave = useCallback((updates: Partial<CompanySettingsData>, fieldKeys?: string[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveHeroSettings(updates, fieldKeys);
    }, 800);
  }, [saveHeroSettings]);

  const updateHomepageContent = useCallback((updater: (prev: HomepageContent) => HomepageContent, fieldKey?: string) => {
    setHomepageContent(prev => {
      const updated = updater(prev);
      triggerAutoSave({ homepageContent: updated }, fieldKey ? [fieldKey] : ['homepageContent']);
      return updated;
    });
  }, [triggerAutoSave]);

  const updateConsultingSection = useCallback(
    (updater: (section: NonNullable<HomepageContent['consultingStepsSection']>) => NonNullable<HomepageContent['consultingStepsSection']>, fieldKey?: string) => {
      updateHomepageContent(prev => {
        const currentSection = {
          ...DEFAULT_HOMEPAGE_CONTENT.consultingStepsSection,
          ...(prev.consultingStepsSection || {}),
        } as NonNullable<HomepageContent['consultingStepsSection']>;
        const updatedSection = updater(currentSection);
        return { ...prev, consultingStepsSection: updatedSection };
      }, fieldKey);
    },
    [updateHomepageContent]
  );

  const updateConsultingSteps = useCallback(
    (updater: (steps: ConsultingStep[]) => ConsultingStep[], fieldKey = 'homepageContent.consultingStepsSection.steps') => {
      updateConsultingSection(
        section => ({
          ...section,
          steps: updater([...(section.steps || [])]),
        }),
        fieldKey
      );
    },
    [updateConsultingSection]
  );

  const handleMoveStep = useCallback(
    (index: number, direction: -1 | 1) => {
      updateConsultingSteps(steps => {
        const ordered = [...steps].sort(
          (a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel)
        );
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= ordered.length) return ordered;
        const reordered = arrayMove(ordered, index, targetIndex).map((step, idx) => ({
          ...step,
          order: idx + 1,
        }));
        return reordered;
      });
    },
    [updateConsultingSteps]
  );

  const handleAddStep = useCallback(() => {
    const nextOrder = (consultingStepsSection.steps?.length || 0) + 1;
    const newStep: ConsultingStep = {
      order: nextOrder,
      numberLabel: String(nextOrder).padStart(2, '0'),
      icon: 'sparkles',
      title: 'Nova Etapa',
      whatWeDo: '',
      outcome: '',
    };
    updateConsultingSteps(steps => [...steps, newStep]);
  }, [consultingStepsSection.steps, updateConsultingSteps]);

  const handleDeleteStep = useCallback(
    (index: number) => {
      updateConsultingSteps(steps => {
        const ordered = [...steps].sort(
          (a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel)
        );
        const filtered = ordered.filter((_, i) => i !== index);
        return filtered.map((step, idx) => ({ ...step, order: step.order ?? idx + 1 }));
      });
    },
    [updateConsultingSteps]
  );

  const handleStepChange = useCallback(
    (index: number, updater: (step: ConsultingStep) => ConsultingStep, fieldKey: string, resort = false) => {
      updateConsultingSteps(
        steps => {
          const ordered = [...steps].sort(
            (a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel)
          );
          if (!ordered[index]) return ordered;
          ordered[index] = updater(ordered[index]);
          const next = resort
            ? [...ordered].sort(
                (a, b) => (a.order || 0) - (b.order || 0) || a.numberLabel.localeCompare(b.numberLabel)
              )
            : ordered;
          return next;
        },
        fieldKey
      );
    },
    [updateConsultingSteps]
  );

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingHeroImage(true);
    try {
      const imagePath = await uploadFileToServer(file);
      console.log('Saving hero image URL:', imagePath);
      setHeroImageUrl(imagePath);
      await saveHeroSettings({ heroImageUrl: imagePath }, ['heroImageUrl']);
      toast({ 
        title: 'Success!', 
        description: 'Hero image uploaded and saved successfully',
        duration: 3000
      });
    } catch (error: any) {
      toast({ 
        title: 'Upload failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsUploadingHeroImage(false);
    }
  };

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
          <h1 className="text-2xl font-bold">{heroMenuTitle}</h1>
          <p className="text-muted-foreground">Customize hero and homepage content</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
        </div>
      </div>
      <div className="bg-muted p-6 rounded-lg transition-all space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Hero Section
          </h2>
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="heroTitle">Hero Title</Label>
              <div className="relative">
                <Input 
                  id="heroTitle" 
                  value={heroTitle} 
                  onChange={(e) => {
                    setHeroTitle(e.target.value);
                    triggerAutoSave({ heroTitle: e.target.value }, ['heroTitle']);
                  }}
                  placeholder="Enter hero title"
                  data-testid="input-hero-title"
                />
                <SavedIndicator field="heroTitle" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
              <div className="relative">
                <Textarea 
                  id="heroSubtitle" 
                  value={heroSubtitle} 
                  onChange={(e) => {
                    setHeroSubtitle(e.target.value);
                    triggerAutoSave({ heroSubtitle: e.target.value }, ['heroSubtitle']);
                  }}
                  placeholder="Enter hero subtitle"
                  data-testid="input-hero-subtitle"
                  className="min-h-[120px]"
                />
                <SavedIndicator field="heroSubtitle" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaText">Call to Action Button Text</Label>
              <div className="relative">
                <Input 
                  id="ctaText" 
                  value={ctaText} 
                  onChange={(e) => {
                    setCtaText(e.target.value);
                    triggerAutoSave({ ctaText: e.target.value }, ['ctaText']);
                  }}
                  placeholder="Book Now"
                  data-testid="input-cta-text"
                />
                <SavedIndicator field="ctaText" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="heroImage">Hero Image</Label>
              <div className="flex flex-col gap-3">
                <div className="aspect-[4/3] w-full max-w-xs rounded-lg border-2 border-dashed border-border bg-card flex items-center justify-center overflow-hidden relative group">
                  {isUploadingHeroImage ? (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 z-10">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                      <p className="text-sm text-white font-medium">Uploading...</p>
                    </div>
                  ) : null}
                  {heroImageUrl ? (
                    <img src={heroImageUrl} alt="Hero preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <Image className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Background Image</p>
                    </div>
                  )}
                  <label className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer ${
                    isUploadingHeroImage ? 'pointer-events-none' : ''
                  }`}>
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={handleImageUpload} 
                      accept="image/*"
                      disabled={isUploadingHeroImage}
                    />
                    <Plus className="w-8 h-8 text-white" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-primary" />
            Hero Badge
          </h3>
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* Badge Image Preview */}
            <div className="space-y-2">
              <Label>Badge Image</Label>
              <div className="aspect-video w-full rounded-lg border-2 border-dashed border-border bg-card flex items-center justify-center overflow-hidden relative group">
                {isUploadingBadgeImage ? (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 z-10">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                    <p className="text-xs text-white font-medium">Uploading...</p>
                  </div>
                ) : null}
                {homepageContent.heroBadgeImageUrl ? (
                  <img src={homepageContent.heroBadgeImageUrl} alt="Badge preview" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-center p-4">
                    <BadgeCheck className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Click to upload</p>
                  </div>
                )}
                <label className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer ${
                  isUploadingBadgeImage ? 'pointer-events-none' : ''
                }`}>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    disabled={isUploadingBadgeImage}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsUploadingBadgeImage(true);
                      try {
                        const imagePath = await uploadFileToServer(file);
                        updateHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: imagePath }), 'homepageContent.heroBadgeImageUrl');
                        setHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: imagePath }));
                        triggerAutoSave({ homepageContent: { ...(homepageContent || {}), heroBadgeImageUrl: imagePath } }, ['homepageContent.heroBadgeImageUrl']);
                        toast({ 
                          title: 'Success!', 
                          description: 'Badge image uploaded and saved successfully',
                          duration: 3000
                        });
                      } catch (error: any) {
                        toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                      } finally {
                        setIsUploadingBadgeImage(false);
                        if (e.target) {
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                  <Plus className="w-6 h-6 text-white" />
                </label>
              </div>
            </div>

            {/* Badge Settings */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Badge Alt Text</Label>
                <div className="relative">
                  <Input
                    value={homepageContent.heroBadgeAlt || ''}
                    onChange={(e) =>
                      updateHomepageContent(prev => ({ ...prev, heroBadgeAlt: e.target.value }), 'homepageContent.heroBadgeAlt')
                    }
                    placeholder="Trusted Experts"
                  />
                  <SavedIndicator field="homepageContent.heroBadgeAlt" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Badge Icon</Label>
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

      <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-primary" />
            Trust Badges
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={() =>
              updateHomepageContent(prev => ({
                ...prev,
                trustBadges: [...(prev.trustBadges || []), { title: 'New Badge', description: '' }],
              }))
            }
          >
            <Plus className="w-4 h-4 mr-2" /> Add badge
          </Button>
        </div>
        <div className="space-y-4">
          {trustBadges.map((badge, index) => (
            <div
              key={index}
              className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto] items-start bg-card p-3 rounded-lg border border-border"
            >
              <div className="space-y-2">
                <Label>Title</Label>
                <div className="relative">
                  <Input
                    value={badge.title}
                    onChange={(e) =>
                      updateHomepageContent(prev => {
                        const updatedBadges = [...(prev.trustBadges || [])];
                        updatedBadges[index] = {
                          ...(updatedBadges[index] || { title: '', description: '' }),
                          title: e.target.value,
                        };
                        return { ...prev, trustBadges: updatedBadges };
                      }, `homepageContent.trustBadges.${index}.title`)
                    }
                  />
                  <SavedIndicator field={`homepageContent.trustBadges.${index}.title`} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <div className="relative">
                  <Input
                    value={badge.description}
                    onChange={(e) =>
                      updateHomepageContent(prev => {
                        const updatedBadges = [...(prev.trustBadges || [])];
                        updatedBadges[index] = {
                          ...(updatedBadges[index] || { title: '', description: '' }),
                          description: e.target.value,
                        };
                        return { ...prev, trustBadges: updatedBadges };
                      }, `homepageContent.trustBadges.${index}.description`)
                    }
                  />
                  <SavedIndicator field={`homepageContent.trustBadges.${index}.description`} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select
                  value={badge.icon || badgeIconOptions[index % badgeIconOptions.length].value}
                  onValueChange={(value) =>
                    updateHomepageContent(prev => {
                      const updatedBadges = [...(prev.trustBadges || [])];
                      updatedBadges[index] = {
                        ...(updatedBadges[index] || { title: '', description: '' }),
                        icon: value,
                      };
                      return { ...prev, trustBadges: updatedBadges };
                    }, `homepageContent.trustBadges.${index}.icon`)
                  }
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
              <div className="flex justify-end items-start pt-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    updateHomepageContent(prev => {
                      const updatedBadges = (prev.trustBadges || []).filter((_, i) => i !== index);
                      return { ...prev, trustBadges: updatedBadges };
                    })
                  }
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {trustBadges.length === 0 && (
            <p className="text-sm text-muted-foreground">No badges added yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            Categories Section
          </h2>
          <div className="space-y-2">
            <Label>Title</Label>
            <div className="relative">
              <Input
                value={categoriesSection.title || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    categoriesSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
                      ...(prev.categoriesSection || {}),
                      title: e.target.value,
                    },
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
                    categoriesSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
                      ...(prev.categoriesSection || {}),
                      subtitle: e.target.value,
                    },
                  }), 'homepageContent.categoriesSection.subtitle')
                }
                className="min-h-[100px]"
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
                    categoriesSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
                      ...(prev.categoriesSection || {}),
                      ctaText: e.target.value,
                    },
                  }), 'homepageContent.categoriesSection.ctaText')
                }
              />
              <SavedIndicator field="homepageContent.categoriesSection.ctaText" />
            </div>
          </div>
        </div>

        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            Reviews Section
          </h2>
          <div className="space-y-2">
            <Label>Heading</Label>
            <div className="relative">
              <Input
                value={reviewsSection.title || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    reviewsSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
                      ...(prev.reviewsSection || {}),
                      title: e.target.value,
                    },
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
                    reviewsSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
                      ...(prev.reviewsSection || {}),
                      subtitle: e.target.value,
                    },
                  }), 'homepageContent.reviewsSection.subtitle')
                }
                className="min-h-[100px]"
              />
              <SavedIndicator field="homepageContent.reviewsSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Review Widget Embed URL</Label>
            <div className="relative">
              <Input
                value={reviewsSection.embedUrl || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    reviewsSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
                      ...(prev.reviewsSection || {}),
                      embedUrl: e.target.value,
                    },
                  }), 'homepageContent.reviewsSection.embedUrl')
                }
                placeholder="https://..."
              />
              <SavedIndicator field="homepageContent.reviewsSection.embedUrl" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Blog Section
          </h2>
          <div className="space-y-2">
            <Label>Title</Label>
            <div className="relative">
              <Input
                value={blogSection.title || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      title: e.target.value,
                    },
                  }), 'homepageContent.blogSection.title')
                }
              />
              <SavedIndicator field="homepageContent.blogSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Textarea
                value={blogSection.subtitle || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      subtitle: e.target.value,
                    },
                  }), 'homepageContent.blogSection.subtitle')
                }
                className="min-h-[100px]"
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
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      viewAllText: e.target.value,
                    },
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
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      readMoreText: e.target.value,
                    },
                  }), 'homepageContent.blogSection.readMoreText')
                }
              />
              <SavedIndicator field="homepageContent.blogSection.readMoreText" />
            </div>
          </div>
        </div>

        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Seção Quem Somos
          </h2>
          <div className="space-y-2">
            <Label>Label</Label>
            <div className="relative">
              <Input
                value={aboutSection.label || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    aboutSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.aboutSection,
                      ...(prev.aboutSection || {}),
                      label: e.target.value,
                    },
                  }), 'homepageContent.aboutSection.label')
                }
              />
              <SavedIndicator field="homepageContent.aboutSection.label" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Título</Label>
            <div className="relative">
              <Input
                value={aboutSection.heading || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    aboutSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.aboutSection,
                      ...(prev.aboutSection || {}),
                      heading: e.target.value,
                    },
                  }), 'homepageContent.aboutSection.heading')
                }
              />
              <SavedIndicator field="homepageContent.aboutSection.heading" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <div className="relative">
              <Textarea
                value={aboutSection.description || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    aboutSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.aboutSection,
                      ...(prev.aboutSection || {}),
                      description: e.target.value,
                    },
                  }), 'homepageContent.aboutSection.description')
                }
                className="min-h-[120px]"
              />
              <SavedIndicator field="homepageContent.aboutSection.description" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Imagem de Quem Somos</Label>
            <div className="flex flex-col gap-3">
              <div className="aspect-video w-full max-w-md rounded-lg border-2 border-dashed border-border bg-card flex items-center justify-center overflow-hidden relative group">
                {aboutImageUrl ? (
                  <img src={aboutImageUrl} alt="About preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <Image className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Imagem da Seção</p>
                  </div>
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const imagePath = await uploadFileToServer(file);
                        setAboutImageUrl(imagePath);
                        triggerAutoSave({ aboutImageUrl: imagePath }, ['aboutImageUrl']);
                        toast({ title: 'Success', description: 'Image uploaded successfully!' });
                      } catch (error: any) {
                        toast({
                          title: 'Upload error',
                          description: error.message,
                          variant: 'destructive'
                        });
                      }
                    }} 
                    accept="image/*" 
                  />
                  <Plus className="w-8 h-8 text-white" />
                </label>
              </div>
              <div className="relative max-w-md">
                <Input
                  value={aboutImageUrl}
                  onChange={(e) => {
                    setAboutImageUrl(e.target.value);
                    triggerAutoSave({ aboutImageUrl: e.target.value }, ['aboutImageUrl']);
                  }}
                  placeholder="Ou cole a URL da imagem (https://...)"
                  data-testid="input-about-image"
                />
                <SavedIndicator field="aboutImageUrl" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Areas Served Section
          </h2>
          <div className="space-y-2">
            <Label>Label</Label>
            <div className="relative">
              <Input
                value={areasServedSection.label || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      label: e.target.value,
                    },
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
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      heading: e.target.value,
                    },
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
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      description: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.description')
                }
                className="min-h-[120px]"
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
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      ctaText: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.ctaText')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.ctaText" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-muted p-6 rounded-lg transition-all space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-primary" />
              Consultoria - Como Funciona
            </h2>
            <p className="text-sm text-muted-foreground">Edite o passo a passo exibido na landing.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={consultingStepsSection.enabled ?? true}
                onCheckedChange={(checked) =>
                  updateConsultingSection(
                    section => ({ ...section, enabled: checked }),
                    'homepageContent.consultingStepsSection.enabled'
                  )
                }
              />
              <span className="text-sm text-muted-foreground">
                {consultingStepsSection.enabled ? 'Section active' : 'Section hidden'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Título</Label>
            <div className="relative">
              <Input
                value={consultingStepsSection.title || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, title: e.target.value }),
                    'homepageContent.consultingStepsSection.title'
                  )
                }
                placeholder="How the Consulting Works"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <div className="relative">
              <Textarea
                value={consultingStepsSection.subtitle || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, subtitle: e.target.value }),
                    'homepageContent.consultingStepsSection.subtitle'
                  )
                }
                className="min-h-[96px]"
                placeholder="A clear, step-by-step process to generate clients predictably in the USA."
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Slug/ID da seção</Label>
            <div className="relative">
              <Input
                value={consultingStepsSection.sectionId || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, sectionId: e.target.value }),
                    'homepageContent.consultingStepsSection.sectionId'
                  )
                }
                placeholder="como-funciona"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.sectionId" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Texto auxiliar (opcional)</Label>
            <div className="relative">
              <Textarea
                value={consultingStepsSection.helperText || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, helperText: e.target.value }),
                    'homepageContent.consultingStepsSection.helperText'
                  )
                }
                className="min-h-[80px]"
                placeholder="Texto curto abaixo do CTA"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.helperText" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA - Texto do botão</Label>
            <div className="relative">
              <Input
                value={consultingStepsSection.ctaButtonLabel || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, ctaButtonLabel: e.target.value }),
                    'homepageContent.consultingStepsSection.ctaButtonLabel'
                  )
                }
                placeholder="Agendar Conversa Gratuita"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.ctaButtonLabel" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA - Link/ação</Label>
            <div className="relative">
              <Input
                value={consultingStepsSection.ctaButtonLink || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, ctaButtonLink: e.target.value }),
                    'homepageContent.consultingStepsSection.ctaButtonLink'
                  )
                }
                placeholder="#lead-form"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.ctaButtonLink" />
            </div>
            <p className="text-xs text-muted-foreground">Use an anchor (#lead-form) or an internal link.</p>
          </div>
          <div className="space-y-2">
            <Label>Practical Block - Title</Label>
            <div className="relative">
              <Input
                value={consultingStepsSection.practicalBlockTitle || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, practicalBlockTitle: e.target.value }),
                    'homepageContent.consultingStepsSection.practicalBlockTitle'
                  )
                }
                placeholder="In practice"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.practicalBlockTitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Practical Block - Subtitle</Label>
            <div className="relative">
              <Input
                value={consultingStepsSection.practicalBlockSubtitle || ''}
                onChange={(e) =>
                  updateConsultingSection(
                    section => ({ ...section, practicalBlockSubtitle: e.target.value }),
                    'homepageContent.consultingStepsSection.practicalBlockSubtitle'
                  )
                }
                placeholder="How the work happens day by day"
              />
              <SavedIndicator field="homepageContent.consultingStepsSection.practicalBlockSubtitle" />
            </div>
          </div>
        </div>
        
        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold">Custom Labels</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Tag Label (e.g., Consulting)</Label>
              <div className="relative">
                <Input
                  value={consultingStepsSection.tagLabel || ''}
                  onChange={(e) =>
                    updateConsultingSection(
                      section => ({ ...section, tagLabel: e.target.value }),
                      'homepageContent.consultingStepsSection.tagLabel'
                    )
                  }
                  placeholder="Consulting"
                />
                <SavedIndicator field="homepageContent.consultingStepsSection.tagLabel" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Stage Label (e.g., Stage)</Label>
              <div className="relative">
                <Input
                  value={consultingStepsSection.stepLabel || ''}
                  onChange={(e) =>
                    updateConsultingSection(
                      section => ({ ...section, stepLabel: e.target.value }),
                      'homepageContent.consultingStepsSection.stepLabel'
                    )
                  }
                  placeholder="Stage"
                />
                <SavedIndicator field="homepageContent.consultingStepsSection.stepLabel" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>What We Do Label</Label>
              <div className="relative">
                <Input
                  value={consultingStepsSection.whatWeDoLabel || ''}
                  onChange={(e) =>
                    updateConsultingSection(
                      section => ({ ...section, whatWeDoLabel: e.target.value }),
                      'homepageContent.consultingStepsSection.whatWeDoLabel'
                    )
                  }
                  placeholder="What we do"
                />
                <SavedIndicator field="homepageContent.consultingStepsSection.whatWeDoLabel" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Outcome Label (e.g., You leave with)</Label>
              <div className="relative">
                <Input
                  value={consultingStepsSection.outcomeLabel || ''}
                  onChange={(e) =>
                    updateConsultingSection(
                      section => ({ ...section, outcomeLabel: e.target.value }),
                      'homepageContent.consultingStepsSection.outcomeLabel'
                    )
                  }
                  placeholder="You leave with"
                />
                <SavedIndicator field="homepageContent.consultingStepsSection.outcomeLabel" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Next Step Label</Label>
              <div className="relative">
                <Input
                  value={consultingStepsSection.nextStepLabel || ''}
                  onChange={(e) =>
                    updateConsultingSection(
                      section => ({ ...section, nextStepLabel: e.target.value }),
                      'homepageContent.consultingStepsSection.nextStepLabel'
                    )
                  }
                  placeholder="Next step"
                />
                <SavedIndicator field="homepageContent.consultingStepsSection.nextStepLabel" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Next Step Text</Label>
              <div className="relative">
                <Input
                  value={consultingStepsSection.nextStepText || ''}
                  onChange={(e) =>
                    updateConsultingSection(
                      section => ({ ...section, nextStepText: e.target.value }),
                      'homepageContent.consultingStepsSection.nextStepText'
                    )
                  }
                  placeholder="Open schedule for new projects"
                />
                <SavedIndicator field="homepageContent.consultingStepsSection.nextStepText" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Label>Practical Block Bullets</Label>
            {practicalBullets.length < 6 && (
              <Button
                variant="outline"
                size="sm"
                className="border-dashed"
                onClick={() =>
                  updateConsultingSection(
                    section => ({
                      ...section,
                      practicalBullets: [...(section.practicalBullets || []), 'New bullet'],
                    }),
                    'homepageContent.consultingStepsSection.practicalBullets'
                  )
                }
              >
                <Plus className="w-4 h-4 mr-2" /> Add bullet
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {practicalBullets.map((bullet, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="relative flex-1">
                  <Input
                    value={bullet}
                    onChange={(e) =>
                      updateConsultingSection(
                        section => {
                          const current = [...(section.practicalBullets || practicalBullets)];
                          current[index] = e.target.value;
                          return { ...section, practicalBullets: current };
                        },
                        `homepageContent.consultingStepsSection.practicalBullets.${index}`
                      )
                    }
                  />
                  <SavedIndicator field={`homepageContent.consultingStepsSection.practicalBullets.${index}`} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={practicalBullets.length <= 1}
                  onClick={() =>
                    updateConsultingSection(
                      section => {
                        const current = [...(section.practicalBullets || practicalBullets)];
                        return { ...section, practicalBullets: current.filter((_, i) => i !== index) };
                      },
                      'homepageContent.consultingStepsSection.practicalBullets'
                    )
                  }
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            {practicalBullets.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem bullets cadastrados.</p>
            )}
          </div>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <List className="w-4 h-4 text-primary" />
                Etapas (cards)
              </h3>
              <p className="text-sm text-muted-foreground">Reordene pelas setas ou ajustando o campo Ordem.</p>
            </div>
            <Button variant="outline" size="sm" className="border-dashed" onClick={handleAddStep}>
              <Plus className="w-4 h-4 mr-2" /> Add stage
            </Button>
          </div>

          <div className="space-y-3">
            {consultingSteps.map((step, index) => (
              <div
                key={`${step.numberLabel}-${index}`}
                className="bg-card border border-border rounded-lg p-4 space-y-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                      {step.numberLabel || String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">{step.title || 'Etapa'}</p>
                      <p className="text-xs text-muted-foreground">Ordem {step.order ?? index + 1}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => handleMoveStep(index, -1)}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === consultingSteps.length - 1}
                      onClick={() => handleMoveStep(index, 1)}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteStep(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Ordem</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={step.order ?? index + 1}
                        onChange={(e) =>
                          handleStepChange(
                            index,
                            current => ({ ...current, order: Number(e.target.value) || index + 1 }),
                            `homepageContent.consultingStepsSection.steps.${index}.order`,
                            true
                          )
                        }
                      />
                      <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.order`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Number</Label>
                    <div className="relative">
                      <Input
                        value={step.numberLabel || ''}
                        onChange={(e) =>
                          handleStepChange(
                            index,
                            current => ({ ...current, numberLabel: e.target.value }),
                            `homepageContent.consultingStepsSection.steps.${index}.numberLabel`
                          )
                        }
                        placeholder="01"
                      />
                      <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.numberLabel`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Icon</Label>
                    <Select
                      value={step.icon || consultingIconOptions[0].value}
                      onValueChange={(value) =>
                        handleStepChange(
                          index,
                          current => ({ ...current, icon: value }),
                          `homepageContent.consultingStepsSection.steps.${index}.icon`
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {consultingIconOptions.map(option => (
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

                <div className="space-y-2">
                  <Label>Title</Label>
                  <div className="relative">
                    <Input
                      value={step.title}
                      onChange={(e) =>
                        handleStepChange(
                          index,
                          current => ({ ...current, title: e.target.value }),
                          `homepageContent.consultingStepsSection.steps.${index}.title`
                        )
                      }
                    />
                    <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.title`} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>O que fazemos</Label>
                    <div className="relative">
                      <Textarea
                        value={step.whatWeDo}
                        onChange={(e) =>
                          handleStepChange(
                            index,
                            current => ({ ...current, whatWeDo: e.target.value }),
                            `homepageContent.consultingStepsSection.steps.${index}.whatWeDo`
                          )
                        }
                        className="min-h-[110px]"
                      />
                      <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.whatWeDo`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Você sai com</Label>
                    <div className="relative">
                      <Textarea
                        value={step.outcome}
                        onChange={(e) =>
                          handleStepChange(
                            index,
                            current => ({ ...current, outcome: e.target.value }),
                            `homepageContent.consultingStepsSection.steps.${index}.outcome`
                          )
                        }
                        className="min-h-[110px]"
                      />
                      <SavedIndicator field={`homepageContent.consultingStepsSection.steps.${index}.outcome`} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {consultingSteps.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

