import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  Image,
  LayoutGrid,
  List,
  Save,
} from 'lucide-react';
import { SectionHeader } from './shared';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import type { HomepageContent } from '@shared/schema';
import type { CompanySettingsData } from './shared/types';
import { HeroTab } from './website/HeroTab';
import { TrustBadgesTab } from './website/TrustBadgesTab';
import { SectionsTab } from './website/SectionsTab';
import { ConsultingTab } from './website/ConsultingTab';

type WebsiteTab = 'hero' | 'trust' | 'sections' | 'consulting';

const WEBSITE_TABS: { id: WebsiteTab; label: string; icon: typeof Image }[] = [
  { id: 'hero', label: 'Hero', icon: Image },
  { id: 'trust', label: 'Badges', icon: BadgeCheck },
  { id: 'sections', label: 'Sections', icon: LayoutGrid },
  { id: 'consulting', label: 'Services', icon: List },
];

const HERO_DEFAULTS = {
  title: 'Learn How to Generate Your Own Clients in the USA',
  subtitle: '1-on-1 mentorship in digital marketing for Brazilian entrepreneurs.',
  ctaText: 'Schedule Free Consultation',
  image: '',
};

// No-op — keep to avoid compile errors in child tabs that reference it
const SavedIndicator = (_: { field: string }) => null;

export function WebsiteSettingsSection() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings'],
  });

  const [activeTab, setActiveTab] = useState<WebsiteTab>('hero');
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [aboutImageUrl, setAboutImageUrl] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [homepageContent, setHomepageContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  // Keep for image-upload immediate saves (no dirty tracking)
  const savedFieldTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Load settings from API
  useEffect(() => {
    if (settings) {
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
      setIsDirty(false);
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
      setIsDirty(false);
    }
  }, [isLoading, settings]);

  useEffect(() => {
    return () => {
      Object.values(savedFieldTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Immediate save used only by image upload handlers
  const saveImmediately = useCallback(async (updates: Partial<CompanySettingsData>) => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/company-settings', updates);
    } catch (error: any) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [toast]);

  // Legacy prop — passed to child tabs that call it on text-field changes.
  // Now just marks the form dirty; params are intentionally ignored.
  const triggerAutoSave = useCallback((_updates: unknown, _fieldKeys?: unknown) => {
    setIsDirty(true);
  }, []);

  // Also used directly by HeroTab image upload
  const saveHeroSettings = useCallback(async (updates: Partial<CompanySettingsData>, _fieldKeys?: string[]) => {
    await saveImmediately(updates);
  }, [saveImmediately]);

  const updateHomepageContent = useCallback((updater: (prev: HomepageContent) => HomepageContent, _fieldKey?: string) => {
    setHomepageContent(prev => updater(prev));
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/company-settings', {
        heroTitle,
        heroSubtitle,
        ctaText,
        heroImageUrl,
        aboutImageUrl,
        homepageContent,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      setIsDirty(false);
      toast({ title: 'Saved!', description: 'Settings saved successfully.', duration: 2500 });
    } catch (error: any) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [heroTitle, heroSubtitle, ctaText, heroImageUrl, aboutImageUrl, homepageContent, toast]);

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <SectionHeader
        title="Website"
        description="Customize homepage content and sections"
        icon={<Image className="w-5 h-5" />}
      />

      {/* Tab Navigation */}
      <div className="flex gap-1.5 bg-muted p-1.5 rounded-lg overflow-x-auto">
        {WEBSITE_TABS.map(tab => (
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

      {/* Tab Content */}
      {activeTab === 'hero' && (
        <HeroTab
          heroTitle={heroTitle}
          setHeroTitle={setHeroTitle}
          heroSubtitle={heroSubtitle}
          setHeroSubtitle={setHeroSubtitle}
          ctaText={ctaText}
          setCtaText={setCtaText}
          heroImageUrl={heroImageUrl}
          setHeroImageUrl={setHeroImageUrl}
          triggerAutoSave={triggerAutoSave}
          saveHeroSettings={saveHeroSettings}
          SavedIndicator={SavedIndicator}
        />
      )}

      {activeTab === 'trust' && (
        <TrustBadgesTab
          homepageContent={homepageContent}
          updateHomepageContent={updateHomepageContent}
          triggerAutoSave={triggerAutoSave}
          SavedIndicator={SavedIndicator}
        />
      )}

      {activeTab === 'sections' && (
        <SectionsTab
          homepageContent={homepageContent}
          updateHomepageContent={updateHomepageContent}
          aboutImageUrl={aboutImageUrl}
          setAboutImageUrl={setAboutImageUrl}
          saveImmediately={saveImmediately}
          SavedIndicator={SavedIndicator}
        />
      )}

      {activeTab === 'consulting' && (
        <ConsultingTab
          homepageContent={homepageContent}
          updateHomepageContent={updateHomepageContent}
          SavedIndicator={SavedIndicator}
        />
      )}

      {/* Floating Save Bar */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border shadow-xl rounded-2xl px-5 py-3 animate-in slide-in-from-bottom-4 duration-200">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Alterações não salvas</span>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#406EF1] hover:bg-[#355CD0] text-white rounded-full px-5"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Salvar alterações</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
