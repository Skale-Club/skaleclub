import type { HomepageContent } from '@shared/schema';

export type AdminSection =
  | 'dashboard'
  | 'leads'
  | 'hero'
  | 'company'
  | 'seo'
  | 'faqs'
  | 'users'
  | 'chat'
  | 'integrations'
  | 'blog';

export interface DayHours {
  isOpen: boolean;
  start: string;
  end: string;
}

export interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface CompanySettingsData {
  id?: number;
  companyName: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  logoMain: string | null;
  logoDark: string | null;
  logoIcon: string | null;
  sectionsOrder: AdminSection[] | null;
  socialLinks: { platform: string; url: string }[] | null;
  mapEmbedUrl: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  aboutImageUrl: string | null;
  ctaText: string | null;
  homepageContent: HomepageContent | null;
  timeFormat: string | null;
  businessHours: BusinessHours | null;
}

export interface SEOSettingsData {
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  seoKeywords: string | null;
  seoAuthor: string | null;
  seoCanonicalUrl: string | null;
  seoRobotsTag: string | null;
  ogType: string | null;
  ogSiteName: string | null;
  twitterCard: string | null;
  twitterSite: string | null;
  twitterCreator: string | null;
  schemaLocalBusiness: Record<string, any> | null;
}

export type UrlRule = {
  pattern: string;
  match: 'contains' | 'starts_with' | 'equals';
};

export type IntakeObjective = {
  id: 'zipcode' | 'name' | 'phone' | 'serviceType' | 'serviceDetails' | 'date' | 'address';
  label: string;
  description: string;
  enabled: boolean;
};

export interface ChatSettingsData {
  enabled: boolean;
  agentName: string;
  agentAvatarUrl?: string;
  systemPrompt?: string;
  welcomeMessage: string;
  avgResponseTime?: string;
  calendarProvider?: string;
  calendarId?: string;
  calendarStaff?: { name: string; calendarId: string }[];
  languageSelectorEnabled?: boolean;
  defaultLanguage?: string;
  lowPerformanceSmsEnabled?: boolean;
  lowPerformanceThresholdSeconds?: number;
  intakeObjectives?: IntakeObjective[];
  excludedUrlRules: UrlRule[];
  useFaqs?: boolean;
  activeAiProvider?: string;
}

export interface ConversationSummary {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  firstPageUrl?: string | null;
  visitorName?: string | null;
  visitorEmail?: string | null;
  visitorPhone?: string | null;
  lastMessage?: string;
  lastMessageRole?: string | null;
  messageCount?: number;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
  metadata?: Record<string, any> | null;
}

export interface GHLSettings {
  provider: string;
  apiKey: string;
  locationId: string;
  calendarId: string;
  isEnabled: boolean;
}

export interface OpenAISettings {
  provider: string;
  enabled: boolean;
  model: string;
  hasKey: boolean;
}

export interface TwilioSettings {
  enabled: boolean;
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string;
  toPhoneNumber: string;
  toPhoneNumbers: string[];
  notifyOnNewChat: boolean;
}

export interface AnalyticsSettings {
  gtmContainerId: string;
  ga4MeasurementId: string;
  facebookPixelId: string;
  gtmEnabled: boolean;
  ga4Enabled: boolean;
  facebookPixelEnabled: boolean;
}
