import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Check, Image, LayoutGrid, List, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import { apiRequest, queryClient } from '@/lib/queryClient';
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
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFieldTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [savedFields, setSavedFields] = useState<Record<string, boolean>>({});

  const SavedIndicator = ({ field }: { field: string }) => (
    savedFields[field] ? (
      <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" />
    ) : null
  );

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
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      Object.values(savedFieldTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Shared helpers
  const markFieldsSaved = useCallback((fields: string[]) => {
    fields.forEach(field => {
      setSavedFields(prev => ({ ...prev, [field]: true }));
      if (savedFieldTimers.current[field]) clearTimeout(savedFieldTimers.current[field]);
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
    try {
      await apiRequest('PUT', '/api/company-settings', updates);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      const keysToMark = fieldKeys && fieldKeys.length > 0 ? fieldKeys : Object.keys(updates);
      if (keysToMark.length > 0) markFieldsSaved(keysToMark);
    } catch (error: any) {
      toast({ title: 'Error saving settings', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [toast, markFieldsSaved]);

  const triggerAutoSave = useCallback((updates: Partial<CompanySettingsData>, fieldKeys?: string[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Website</h1>
          <p className="text-muted-foreground">Customize homepage content and sections</p>
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving...</span>
          </div>
        )}
      </div>

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
          homepageContent={homepageContent}
          updateHomepageContent={updateHomepageContent}
          triggerAutoSave={triggerAutoSave}
          saveHeroSettings={saveHeroSettings}
          SavedIndicator={SavedIndicator}
        />
      )}

      {activeTab === 'trust' && (
        <TrustBadgesTab
          homepageContent={homepageContent}
          updateHomepageContent={updateHomepageContent}
          SavedIndicator={SavedIndicator}
        />
      )}

      {activeTab === 'sections' && (
        <SectionsTab
          homepageContent={homepageContent}
          updateHomepageContent={updateHomepageContent}
          aboutImageUrl={aboutImageUrl}
          setAboutImageUrl={setAboutImageUrl}
          triggerAutoSave={triggerAutoSave}
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
    </div>
  );
}
