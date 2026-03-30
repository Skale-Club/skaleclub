import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { DEFAULT_PAGE_SLUGS, type PageSlugs } from "../pageSlugs.js";
import type { FormConfig } from "./forms.js";

// GoHighLevel Integration Settings
export const integrationSettings = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("gohighlevel"),
  apiKey: text("api_key"),
  locationId: text("location_id"),
  calendarId: text("calendar_id").default("2irhr47AR6K0AQkFqEQl"),
  isEnabled: boolean("is_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Twilio Integration Settings
export const twilioSettings = pgTable("twilio_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false),
  accountSid: text("account_sid"),
  authToken: text("auth_token"),
  fromPhoneNumber: text("from_phone_number"),
  toPhoneNumber: text("to_phone_number"),
  toPhoneNumbers: jsonb("to_phone_numbers").$type<string[]>().default([]),
  notifyOnNewChat: boolean("notify_on_new_chat").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company Settings (singleton table - only one row)
export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").default('Company Name'),
  companyEmail: text("company_email").default('contact@company.com'),
  companyPhone: text("company_phone").default(''),
  companyAddress: text("company_address").default(''),
  workingHoursStart: text("working_hours_start").default('08:00'),
  workingHoursEnd: text("working_hours_end").default('18:00'),
  logoMain: text("logo_main").default(''),
  logoDark: text("logo_dark").default(''),
  logoIcon: text("logo_icon").default(''),
  sectionsOrder: text("sections_order").array(),
  socialLinks: jsonb("social_links").default([]),
  mapEmbedUrl: text("map_embed_url").default('https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d259505.12434421625!2d-71.37915684523166!3d42.296281796774615!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1767905922570!5m2!1sen!2sus'),
  heroTitle: text("hero_title").default('Your 5-Star Marketing Company'),
  heroSubtitle: text("hero_subtitle").default('Book your marketing service today and watch your business grow'),
  heroImageUrl: text("hero_image_url").default(''),
  aboutImageUrl: text("about_image_url").default(''),
  ctaText: text("cta_text").default('Book Now'),
  timeFormat: text("time_format").default('12h'),
  businessHours: jsonb("business_hours"),
  seoTitle: text("seo_title").default('Company Name - Professional Services'),
  seoDescription: text("seo_description").default('Professional marketing services for homes and businesses.'),
  ogImage: text("og_image").default(''),
  seoKeywords: text("seo_keywords").default(''),
  seoAuthor: text("seo_author").default(''),
  seoCanonicalUrl: text("seo_canonical_url").default(''),
  seoRobotsTag: text("seo_robots_tag").default('index, follow'),
  ogType: text("og_type").default('website'),
  ogSiteName: text("og_site_name").default(''),
  twitterCard: text("twitter_card").default('summary_large_image'),
  twitterSite: text("twitter_site").default(''),
  twitterCreator: text("twitter_creator").default(''),
  schemaLocalBusiness: jsonb("schema_local_business").default({}),
  gtmContainerId: text("gtm_container_id").default(''),
  ga4MeasurementId: text("ga4_measurement_id").default(''),
  facebookPixelId: text("facebook_pixel_id").default(''),
  gtmEnabled: boolean("gtm_enabled").default(false),
  ga4Enabled: boolean("ga4_enabled").default(false),
  facebookPixelEnabled: boolean("facebook_pixel_enabled").default(false),
  homepageContent: jsonb("homepage_content").$type<HomepageContent>().default({}),
  formConfig: jsonb("form_config").$type<FormConfig>(),
  pageSlugs: jsonb("page_slugs").$type<PageSlugs>().default(DEFAULT_PAGE_SLUGS),
  linksPageConfig: jsonb("links_page_config").$type<LinksPageConfig>().default({
    avatarUrl: '/attached_assets/ghl-logo.webp',
    title: 'Skale Club',
    description: 'Data-Driven Marketing & Scalable Growth Solutions',
    links: [],
    socialLinks: []
  }),
});

// Insert schemas
export const insertIntegrationSettingsSchema = createInsertSchema(integrationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export const insertTwilioSettingsSchema = createInsertSchema(twilioSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCompanySettingsSchema = createInsertSchema(companySettings, {
  homepageContent: z.custom<HomepageContent>().optional().nullable(),
  formConfig: z.custom<FormConfig>().optional().nullable(),
  pageSlugs: z.custom<PageSlugs>().optional().nullable(),
  linksPageConfig: z.custom<LinksPageConfig>().optional().nullable(),
}).omit({ id: true });

// Types
export type IntegrationSettings = typeof integrationSettings.$inferSelect;
export type InsertIntegrationSettings = z.infer<typeof insertIntegrationSettingsSchema>;
export type TwilioSettings = typeof twilioSettings.$inferSelect;
export type InsertTwilioSettings = z.infer<typeof insertTwilioSettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

// Interfaces
export interface ConsultingStep {
  order: number;
  numberLabel: string;
  icon?: string;
  title: string;
  whatWeDo: string;
  outcome: string;
}

export interface ConsultingStepsSection {
  enabled?: boolean;
  sectionId?: string;
  title?: string;
  subtitle?: string;
  steps?: ConsultingStep[];
  practicalBlockTitle?: string;
  practicalBullets?: string[];
  ctaButtonLabel?: string;
  ctaButtonLink?: string;
  helperText?: string | null;
  tagLabel?: string;
  stepLabel?: string;
  whatWeDoLabel?: string;
  outcomeLabel?: string;
  practicalBlockSubtitle?: string;
  nextStepLabel?: string;
  nextStepText?: string;
}

export interface HorizontalScrollCard {
  order: number;
  numberLabel: string;
  icon?: string;
  title: string;
  whatWeDo?: string;
  outcome?: string;
  description?: string;
  features?: string[];
}

export interface HorizontalScrollSection {
  enabled?: boolean;
  sectionId?: string;
  mode?: 'steps' | 'services';
  tagLabel?: string;
  title?: string;
  subtitle?: string;
  cards?: HorizontalScrollCard[];
  stepLabel?: string;
  whatWeDoLabel?: string;
  outcomeLabel?: string;
  practicalBlockTitle?: string;
  practicalBlockSubtitle?: string;
  practicalBullets?: string[];
  ctaButtonLabel?: string;
  ctaButtonLink?: string;
  helperText?: string | null;
  nextStepLabel?: string;
  nextStepText?: string;
}

export interface HomepageContent {
  heroBadgeImageUrl?: string;
  heroBadgeAlt?: string;
  trustBadges?: { title: string; description: string; icon?: string }[];
  categoriesSection?: { title?: string; subtitle?: string; ctaText?: string };
  reviewsSection?: { title?: string; subtitle?: string; embedUrl?: string };
  blogSection?: { title?: string; subtitle?: string; viewAllText?: string; readMoreText?: string };
  aboutSection?: {
    label?: string;
    heading?: string;
    description?: string;
    defaultImageUrl?: string;
    highlights?: { title: string; description: string }[];
  };
  areasServedSection?: { label?: string; heading?: string; description?: string; ctaText?: string };
  horizontalScrollSection?: HorizontalScrollSection;
  consultingStepsSection?: ConsultingStepsSection;
}

export interface LinksPageLink {
  title: string;
  url: string;
  icon?: string;
  order: number;
}

export interface LinksPageSocial {
  platform: string;
  url: string;
  order: number;
}

export interface LinksPageConfig {
  avatarUrl: string;
  title: string;
  description: string;
  links: LinksPageLink[];
  socialLinks: LinksPageSocial[];
}
