import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { randomUUID } from "crypto";
import { DEFAULT_PAGE_SLUGS, type PageSlugs } from "../pageSlugs.js";

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

// Telegram Integration Settings
export const telegramSettings = pgTable("telegram_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false),
  botToken: text("bot_token"),
  // Superseded by chatIds (autoblog-parity SC-07). Still written by the
  // migration's backfill and left in place for one release; nothing reads it.
  chatId: text("chat_id"),
  // Destinations. An entry is a chat id, optionally with a forum-topic thread:
  // "-1001234567890" or "-1001234567890:42" (MASTER §6). One column carries
  // private chats, groups, supergroups and topics.
  chatIds: text("chat_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  // Blog approval cards. A SEPARATE bot, because the one carrying a public
  // webhook should not be the one sending notifications.
  approvalsEnabled: boolean("approvals_enabled").notNull().default(false),
  approvalsBotToken: text("approvals_bot_token"),
  // Empty falls back to chatIds. Separate because chatIds is the notification
  // list: an editor added there to receive drafts would also get every alert.
  approvalsChatIds: text("approvals_chat_ids").array().notNull().default(sql`ARRAY[]::text[]`),
  // Proves a webhook call came from Telegram; a chat_id in the body does not.
  webhookSecret: text("webhook_secret"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Resend (email) Integration Settings
export const resendSettings = pgTable("resend_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false),
  apiKey: text("api_key"),
  fromName: text("from_name"),
  fromEmail: text("from_email"),
  toEmails: jsonb("to_emails").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company Settings (singleton table - only one row)
/**
 * A company's social links. Stored as jsonb, so the column can hold whatever a
 * past write put there; `normalizeSocialLinks` is what every reader should go
 * through rather than trusting the column's type.
 */
export const socialLinksSchema = z.array(
  z.object({
    platform: z.string().min(1),
    url: z.string().min(1),
  }),
);

export type SocialLink = z.infer<typeof socialLinksSchema>[number];

/** Coerces any stored value into a usable array, dropping malformed entries. */
export function normalizeSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { platform, url } = entry as Record<string, unknown>;
    if (typeof platform !== "string" || typeof url !== "string") return [];
    if (!platform.trim() || !url.trim()) return [];
    return [{ platform: platform.trim(), url: url.trim() }];
  });
}

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
  logoAvatarFull: text("logo_avatar_full").default(''),
  logoAvatarMark: text("logo_avatar_mark").default(''),
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
  pageSlugs: jsonb("page_slugs").$type<PageSlugs>().default(DEFAULT_PAGE_SLUGS),
  linksPageConfig: jsonb("links_page_config").$type<LinksPageConfig>().default({
    avatarUrl: '/attached_assets/ghl-logo.webp',
    title: 'Skale Club',
    description: 'Data-Driven Marketing & Scalable Growth Solutions',
    links: [],
    socialLinks: [],
    theme: {},
  }),
});

// Links Page — per-link, per-social, theme, and full config schemas.
// Upgrades the previous z.custom<T>() escape hatch to real runtime validation.
export const linksPageThemeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundGradient: z.string().optional(),
  backgroundImageUrl: z.string().url().or(z.literal('')).optional(),
});

export const linksPageLinkSchema = z.object({
  // id is server-stamped when absent; linksPageLinkSchema.parse(...) returns a guaranteed UUID.
  id: z.string().uuid().optional().transform((v) => v ?? randomUUID()),
  title: z.string().min(1).max(200),
  url: z.string().min(1).max(2000),
  order: z.number().int().min(0),
  // New fields are optional at the TS surface so pre-Phase-12 client code (which builds
  // plain {title,url,order} objects) still type-checks. Runtime defaults are guaranteed by
  // normalizeLinksPageConfig() on every read; Zod parse stamps them on write when omitted.
  iconType: z.enum(['lucide', 'upload', 'auto']).optional(),
  iconValue: z.string().optional(),
  visible: z.boolean().optional(),
  clickCount: z.number().int().min(0).optional(),
});

export const linksPageSocialSchema = z.object({
  platform: z.string().min(1).max(50),
  url: z.string().min(1).max(2000),
  order: z.number().int().min(0),
});

export const linksPageConfigSchema = z.object({
  avatarUrl: z.string(),
  title: z.string(),
  description: z.string(),
  links: z.array(linksPageLinkSchema),
  socialLinks: z.array(linksPageSocialSchema),
  theme: linksPageThemeSchema.optional(),
});

// Business hours — the admin Company Settings form edits a fixed seven-day map of
// { isOpen, start, end } (client/src/components/admin/shared/types.ts → BusinessHours,
// defaults in that folder's constants.ts). Every field is optional and unknown keys pass
// through so rows written before this schema existed keep validating.
export const dayHoursSchema = z
  .object({
    isOpen: z.boolean().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
  })
  .passthrough();

export const businessHoursSchema = z
  .object({
    monday: dayHoursSchema.optional(),
    tuesday: dayHoursSchema.optional(),
    wednesday: dayHoursSchema.optional(),
    thursday: dayHoursSchema.optional(),
    friday: dayHoursSchema.optional(),
    saturday: dayHoursSchema.optional(),
    sunday: dayHoursSchema.optional(),
  })
  .passthrough();

// schema.org LocalBusiness JSON-LD overrides. Nothing reads a fixed set of keys
// (client/src/hooks/use-seo.ts builds the snippet from the other SEO fields), so
// this stays an open JSON object: the common keys are typed when present and any
// other schema.org property passes through untouched.
export const schemaLocalBusinessSchema = z
  .object({
    "@context": z.string().optional(),
    "@type": z.string().optional(),
    "@id": z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    url: z.string().optional(),
    telephone: z.string().optional(),
    email: z.string().optional(),
    // schema.org allows a URL, a list of URLs or an ImageObject here.
    image: z.union([z.string(), z.array(z.string()), z.record(z.unknown())]).optional(),
    priceRange: z.string().optional(),
    serviceType: z.string().optional(),
  })
  .passthrough();

export type DayHours = z.infer<typeof dayHoursSchema>;
export type BusinessHours = z.infer<typeof businessHoursSchema>;
export type SchemaLocalBusiness = z.infer<typeof schemaLocalBusinessSchema>;

// Insert schemas
export const insertIntegrationSettingsSchema = z.object({
  provider: z.string().default("gohighlevel"),
  apiKey: z.string().nullable().optional(),
  locationId: z.string().nullable().optional(),
  calendarId: z.string().default("2irhr47AR6K0AQkFqEQl"),
  isEnabled: z.boolean().default(false),
});

export const insertTwilioSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  accountSid: z.string().nullable().optional(),
  authToken: z.string().nullable().optional(),
  fromPhoneNumber: z.string().nullable().optional(),
  toPhoneNumber: z.string().nullable().optional(),
  toPhoneNumbers: z.array(z.string()).default([]),
  notifyOnNewChat: z.boolean().default(true),
});

export const insertTelegramSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().nullable().optional(),
  chatId: z.string().nullable().optional(),
});

export const insertResendSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  apiKey: z.string().nullable().optional(),
  fromName: z.string().nullable().optional(),
  fromEmail: z.string().nullable().optional(),
  toEmails: z.array(z.string()).default([]),
});

export const insertCompanySettingsSchema = z.object({
  companyName: z.string().default('Company Name'),
  companyEmail: z.string().email().default('contact@company.com'),
  companyPhone: z.string().default(''),
  companyAddress: z.string().default(''),
  workingHoursStart: z.string().default('08:00'),
  workingHoursEnd: z.string().default('18:00'),
  logoMain: z.string().default(''),
  logoDark: z.string().default(''),
  logoIcon: z.string().default(''),
  logoAvatarFull: z.string().default(''),
  logoAvatarMark: z.string().default(''),
  sectionsOrder: z.array(z.string()).nullable().optional(),
  // Was `z.any()`, which accepted anything — production ended up holding `{}`
  // for this field, and every consumer that guards with `Array.isArray` then
  // rendered no social links at all, silently. Validate the real shape.
  socialLinks: socialLinksSchema.default([]),
  mapEmbedUrl: z.string().default('https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d259505.12434421625!2d-71.37915684523166!3d42.296281796774615!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1767905922570!5m2!1sen!2sus'),
  heroTitle: z.string().default('Your 5-Star Marketing Company'),
  heroSubtitle: z.string().default('Book your marketing service today and watch your business grow'),
  heroImageUrl: z.string().default(''),
  aboutImageUrl: z.string().default(''),
  ctaText: z.string().default('Book Now'),
  timeFormat: z.string().default('12h'),
  businessHours: businessHoursSchema.nullable().optional(),
  seoTitle: z.string().default('Company Name - Professional Services'),
  seoDescription: z.string().default('Professional marketing services for homes and businesses.'),
  ogImage: z.string().default(''),
  seoKeywords: z.string().default(''),
  seoAuthor: z.string().default(''),
  seoCanonicalUrl: z.string().default(''),
  seoRobotsTag: z.string().default('index, follow'),
  ogType: z.string().default('website'),
  ogSiteName: z.string().default(''),
  twitterCard: z.string().default('summary_large_image'),
  twitterSite: z.string().default(''),
  twitterCreator: z.string().default(''),
  schemaLocalBusiness: schemaLocalBusinessSchema.nullable().default({}),
  gtmContainerId: z.string().default(''),
  ga4MeasurementId: z.string().default(''),
  facebookPixelId: z.string().default(''),
  gtmEnabled: z.boolean().default(false),
  ga4Enabled: z.boolean().default(false),
  facebookPixelEnabled: z.boolean().default(false),
  homepageContent: z.custom<HomepageContent>().optional().nullable(),
  pageSlugs: z.custom<PageSlugs>().optional().nullable(),
  linksPageConfig: linksPageConfigSchema.optional().nullable(),
});

// Types
export type IntegrationSettings = typeof integrationSettings.$inferSelect;
export type InsertIntegrationSettings = typeof integrationSettings.$inferInsert;
export type TwilioSettings = typeof twilioSettings.$inferSelect;
export type InsertTwilioSettings = typeof twilioSettings.$inferInsert;
export type TelegramSettings = typeof telegramSettings.$inferSelect;
export type InsertTelegramSettings = typeof telegramSettings.$inferInsert;
export type ResendSettings = typeof resendSettings.$inferSelect;
export type InsertResendSettings = typeof resendSettings.$inferInsert;
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = typeof companySettings.$inferInsert;

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

export interface OurServicesCard {
  order: number;
  enabled?: boolean;
  imageUrl?: string;
  title: string;
  subtitle?: string;
  description?: string;
  features?: string[];
}

export interface OurServicesSection {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  cards?: OurServicesCard[];
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
  ourServicesSection?: OurServicesSection;
  portfolioHero?: {
    badge?: string;
    title?: string;
    subtitle?: string;
    buttonText?: string;
    backgroundImage?: string;
  };
  portfolioServicesSection?: {
    showTitle?: boolean;
  };
  portfolioCtaSection?: {
    title?: string;
    subtitle?: string;
    buttonText?: string;
    backgroundImage?: string;
  };
}

// Derive TS types from the Zod schemas using `z.input` so pre-Phase-12 client code
// (which builds plain {title,url,order} objects in LinksSection.addLink()) still
// type-checks — the id-transform on linksPageLinkSchema makes Zod's OUTPUT type have
// a required `id: string`, but INPUT allows it to be omitted. Runtime UUID stamping
// still happens via the transform inside linksPageLinkSchema.parse(), and
// normalizeLinksPageConfig() fills defaults on every read — so runtime data is
// always fully normalized even though compile-time types are looser.
export type LinksPageTheme = z.input<typeof linksPageThemeSchema>;
export type LinksPageLink = z.input<typeof linksPageLinkSchema>;
export type LinksPageSocial = z.input<typeof linksPageSocialSchema>;
export type LinksPageConfig = z.input<typeof linksPageConfigSchema>;

// Strict post-parse / post-normalize types — every field guaranteed present, `id`
// guaranteed to be a UUID string. Use these in server code paths that have run
// linksPageLinkSchema.parse() or normalizeLinksPageConfig().
export type LinksPageLinkNormalized = z.output<typeof linksPageLinkSchema>;
export type LinksPageConfigNormalized = z.output<typeof linksPageConfigSchema>;
