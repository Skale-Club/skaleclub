import { db } from "./db.js";
import { scoreItem } from "./lib/rssTopicSelector.js";
import { DEFAULT_FORM_CONFIG, calculateFormScoresWithConfig, classifyLead } from "#shared/form.js";
import { normalizeLinksPageConfig } from "#shared/links.js";
import {
  formLeads,
  forms,
  chatSettings,
  chatIntegrations,
  twilioSettings,
  telegramSettings,
  resendSettings,
  conversations,
  conversationMessages,
  companySettings,
  faqs,
  redirects,
  integrationSettings,
  blogPosts,
  blogSettings,
  blogGenerationJobs,
  blogRssSources,
  blogRssItems,
  hubLives,
  hubParticipants,
  hubRegistrations,
  hubAccessEvents,
  notificationTemplates,
  portfolioServices,
  visitorSessions,
  attributionConversions,
  estimates,
  estimateViews,
  presentations,
  presentationViews,
  brandGuidelines,
  estimateGuidelines,
  landingPages,
  type CompanySettings,
  type ChatSettings,
  type ChatIntegrations,
  type TwilioSettings,
  type TelegramSettings,
  type ResendSettings,
  type Conversation,
  type ConversationMessage,
  type FormLead,
  type FormConfig,
  type Form,
  type InsertFormInput,
  type UpdateFormInput,
  type LeadStatus,
  type LeadClassification,
  type Faq,
  type IntegrationSettings,
  type BlogPost,
  type BlogSettings,
  type BlogGenerationJob,
  type HubLive,
  type InsertHubLive,
  type HubLiveStatus,
  type HubParticipant,
  type HubRegistration,
  type HubAccessEvent,
  type InsertHubAccessEvent,
  type HubLiveSummary,
  type HubRegistrationSummary,
  type HubDashboardSummary,
  type HubParticipantHistory,
  type UpsertHubParticipantInput,
  type HubParticipantIdentityLookup,
  type UpsertHubRegistrationInput,
  type PortfolioService,
  type Estimate,
  type InsertEstimate,
  type EstimateWithStats,
  type Presentation,
  type InsertPresentation,
  type PresentationView,
  type PresentationWithStats,
  type BrandGuidelines,
  type EstimateGuidelines,
  type SlideBlock,
  type LandingPage,
  type InsertLandingPageInput,
  type InsertPortfolioService,
  type InsertChatSettings,
  type InsertChatIntegrations,
  type InsertTwilioSettings,
  type InsertTelegramSettings,
  type InsertResendSettings,
  type InsertConversation,
  type InsertConversationMessage,
  type FormLeadProgressInput,
  type InsertFaq,
  type Redirect,
  type InsertRedirect,
  type InsertIntegrationSettings,
  type InsertBlogPost,
  type InsertBlogSettings,
  type InsertBlogGenerationJob,
  type BlogRssSource,
  type InsertBlogRssSource,
  type BlogRssItem,
  type InsertBlogRssItem,
  type BlogRssItemStatus,
  normalizeHubPhone,
  normalizeHubEmail,
  type NotificationTemplate,
  type InsertNotificationTemplate,
  type VisitorSession,
  type InsertVisitorSession,
  type AttributionConversion,
  type InsertAttributionConversion,
} from "#shared/schema.js";
import type {
  MarketingFilters,
  MarketingOverview,
  MarketingBySource,
  MarketingByCampaign,
  VisitorJourney,
} from "#shared/marketing-types.js";
import { eq, and, or, ilike, gte, lte, lt, desc, asc, sql, ne, inArray, count, getTableColumns } from "drizzle-orm";

// Phase 37 — read-side joined shapes for admin RSS UI (BLOG2-08, BLOG2-10).
// Exported so Plan 02 (REST endpoints) and Plan 03 (frontend types) can import.
export interface RssItemWithSource extends BlogRssItem {
  sourceName: string | null;
  // D-05: real-time relevance score for `pending` rows; null for `used` / `skipped`.
  score: number | null;
}

// Phase 38 BLOG2-15: durationsMs is inherited from BlogGenerationJob
// ($inferSelect after Plan 38-01 adds the JSONB column). The interface
// itself does NOT redeclare the field — the SELECT projections below
// must include `durationsMs: blogGenerationJobs.durationsMs` for the
// value to actually round-trip on the wire.
export interface BlogGenerationJobWithRssItem extends BlogGenerationJob {
  rssItemTitle: string | null;
  rssItemId: number | null;
}

const companySettingsSchemaPatches = [
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "seo_keywords" text DEFAULT ''`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "seo_author" text DEFAULT ''`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "seo_canonical_url" text DEFAULT ''`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "seo_robots_tag" text DEFAULT 'index, follow'`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "og_type" text DEFAULT 'website'`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "og_site_name" text DEFAULT ''`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "twitter_card" text DEFAULT 'summary_large_image'`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "twitter_site" text DEFAULT ''`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "twitter_creator" text DEFAULT ''`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "schema_local_business" jsonb DEFAULT '{}'::jsonb`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "gtm_container_id" text DEFAULT ''`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "ga4_measurement_id" text DEFAULT ''`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "facebook_pixel_id" text DEFAULT ''`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "gtm_enabled" boolean DEFAULT false`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "ga4_enabled" boolean DEFAULT false`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "facebook_pixel_enabled" boolean DEFAULT false`,
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "page_slugs" jsonb DEFAULT '{"thankYou":"thankyou","privacyPolicy":"privacy-policy","termsOfService":"terms-of-service","contact":"contact","faq":"faq","blog":"blog","portfolio":"portfolio","hub":"skale-hub","links":"links","vcard":"vcard"}'::jsonb`,
];

const chatSettingsSchemaPatches = [
  sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "excluded_url_rules" jsonb DEFAULT '[]'::jsonb`,
];


let companySettingsSchemaReady = false;
let chatSettingsSchemaReady = false;

async function ensureCompanySettingsSchema() {
  if (companySettingsSchemaReady) return;
  for (const statement of companySettingsSchemaPatches) {
    await db.execute(statement);
  }
  companySettingsSchemaReady = true;
}

async function ensureChatSettingsSchema() {
  if (chatSettingsSchemaReady) return;
  for (const statement of chatSettingsSchemaPatches) {
    await db.execute(statement);
  }
  chatSettingsSchemaReady = true;
}

export interface IStorage {
  // Company Settings
  getCompanySettings(): Promise<CompanySettings>;
  updateCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings>;

  // FAQs
  getFaqs(): Promise<Faq[]>;
  createFaq(faq: InsertFaq): Promise<Faq>;
  updateFaq(id: number, faq: Partial<InsertFaq>): Promise<Faq>;
  deleteFaq(id: number): Promise<void>;

  // Redirects
  getRedirects(): Promise<Redirect[]>;
  getRedirectBySlug(slug: string): Promise<Redirect | undefined>;
  createRedirect(r: InsertRedirect): Promise<Redirect>;
  updateRedirect(id: number, r: Partial<InsertRedirect>): Promise<Redirect>;
  deleteRedirect(id: number): Promise<void>;

  // Integration Settings
  getIntegrationSettings(provider: string): Promise<IntegrationSettings | undefined>;
  upsertIntegrationSettings(settings: InsertIntegrationSettings): Promise<IntegrationSettings>;

  // Chat
  getChatSettings(): Promise<ChatSettings>;
  updateChatSettings(settings: Partial<InsertChatSettings>): Promise<ChatSettings>;
  getChatIntegration(provider: string): Promise<ChatIntegrations | undefined>;
  upsertChatIntegration(settings: InsertChatIntegrations): Promise<ChatIntegrations>;

  // Twilio Integration
  getTwilioSettings(): Promise<TwilioSettings | undefined>;
  saveTwilioSettings(settings: InsertTwilioSettings): Promise<TwilioSettings>;

  // Telegram Integration
  getTelegramSettings(): Promise<TelegramSettings | undefined>;
  saveTelegramSettings(settings: InsertTelegramSettings): Promise<TelegramSettings>;
  getResendSettings(): Promise<ResendSettings | undefined>;
  saveResendSettings(settings: InsertResendSettings): Promise<ResendSettings>;

  listConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(id: string): Promise<void>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  addConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;

  // Forms (multi-form support — see Milestone 3)
  listForms(includeInactive?: boolean): Promise<Form[]>;
  getForm(id: number): Promise<Form | undefined>;
  getFormBySlug(slug: string): Promise<Form | undefined>;
  getDefaultForm(): Promise<Form | undefined>;
  ensureDefaultForm(): Promise<Form>;
  createForm(input: InsertFormInput): Promise<Form>;
  updateForm(id: number, updates: UpdateFormInput): Promise<Form>;
  softDeleteForm(id: number): Promise<void>;
  duplicateForm(id: number, overrides?: { slug?: string; name?: string }): Promise<Form>;
  setDefaultForm(id: number): Promise<Form>;
  countLeadsForForm(formId: number): Promise<number>;
  listLeadsForForm(formId: number, limit: number, offset: number): Promise<{ data: (typeof formLeads.$inferSelect)[]; total: number }>;

  // Leads
  upsertFormLeadProgress(progress: FormLeadProgressInput, metadata?: { userAgent?: string; conversationId?: string; source?: string; formId?: number }, formConfig?: FormConfig): Promise<FormLead>;
  getFormLeadBySession(sessionId: string): Promise<FormLead | undefined>;
  getFormLeadByConversationId(conversationId: string): Promise<FormLead | undefined>;
  listFormLeads(filters?: { status?: LeadStatus; classificacao?: LeadClassification; formCompleto?: boolean; completionStatus?: 'completo' | 'em_progresso' | 'abandonado'; search?: string; formId?: number }): Promise<FormLead[]>;
  updateFormLead(id: number, updates: Partial<Pick<FormLead, "status" | "observacoes" | "notificacaoEnviada" | "ghlContactId" | "ghlSyncStatus">>): Promise<FormLead | undefined>;
  getFormLeadByEmail(email: string): Promise<FormLead | undefined>;
  deleteFormLead(id: number): Promise<boolean>;

  // Blog Posts
  getBlogPosts(status?: string): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getPublishedBlogPosts(limit?: number, offset?: number): Promise<BlogPost[]>;
  getRelatedBlogPosts(postId: number, limit?: number): Promise<BlogPost[]>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: number): Promise<void>;
  countPublishedBlogPosts(): Promise<number>;
  getBlogSettings(): Promise<BlogSettings | undefined>;
  upsertBlogSettings(data: InsertBlogSettings): Promise<BlogSettings>;
  createBlogGenerationJob(data: InsertBlogGenerationJob): Promise<BlogGenerationJob>;
  updateBlogGenerationJob(id: number, data: Partial<InsertBlogGenerationJob>): Promise<BlogGenerationJob>;
  getLatestBlogGenerationJob(): Promise<BlogGenerationJob | undefined>;

  // Blog RSS Sources & Items (Phase 34 — RSS-04)
  listRssSources(): Promise<BlogRssSource[]>;
  getRssSource(id: number): Promise<BlogRssSource | undefined>;
  createRssSource(input: InsertBlogRssSource): Promise<BlogRssSource>;
  updateRssSource(id: number, patch: Partial<InsertBlogRssSource>): Promise<BlogRssSource | undefined>;
  deleteRssSource(id: number): Promise<void>;
  upsertRssItem(item: InsertBlogRssItem): Promise<BlogRssItem>;
  listPendingRssItems(limit?: number): Promise<BlogRssItem[]>;
  markRssItemUsed(itemId: number, postId: number): Promise<void>;
  markRssItemSkipped(itemId: number, reason?: string): Promise<void>;

  // Phase 37 — read-side joins for admin UI (BLOG2-08, BLOG2-10)
  // D-05: when status === 'pending', each row carries a real-time relevance score
  // computed via scoreItem() against the current blog_settings.seoKeywords.
  // For 'used' / 'skipped' rows, score is null (relevance is moot post-decision).
  listRssItemsByStatus(
    status: BlogRssItemStatus,
    limit: number,
    offset: number,
  ): Promise<RssItemWithSource[]>;
  listBlogGenerationJobs(limit: number): Promise<BlogGenerationJobWithRssItem[]>;
  getBlogGenerationJob(id: number): Promise<BlogGenerationJob | undefined>;
  // Phase 37 Info-9: joined single-row variant for retry handler — avoids the
  // O(N) listBlogGenerationJobs(200).find() pattern in Plan 02.
  getBlogGenerationJobWithRssItem(id: number): Promise<BlogGenerationJobWithRssItem | undefined>;

  getHubLives(status?: HubLiveStatus): Promise<HubLive[]>;
  getCurrentHubLive(): Promise<HubLive | undefined>;
  getHubLive(id: number): Promise<HubLive | undefined>;
  getHubLiveBySlug(slug: string): Promise<HubLive | undefined>;
  createHubLive(data: InsertHubLive): Promise<HubLive>;
  updateHubLive(id: number, data: Partial<InsertHubLive>): Promise<HubLive>;
  activateHubLive(id: number): Promise<HubLive>;

  getHubParticipant(id: number): Promise<HubParticipant | undefined>;
  findHubParticipantByIdentity(identity: HubParticipantIdentityLookup): Promise<HubParticipant | undefined>;
  upsertHubParticipant(data: UpsertHubParticipantInput): Promise<HubParticipant>;
  updateHubParticipantGhlSync(id: number, updates: {
    ghlContactId?: string | null;
    ghlSyncStatus?: string;
    ghlLastSyncedAt?: Date | null;
    ghlSyncError?: string | null;
  }): Promise<HubParticipant | undefined>;

  getHubRegistration(liveId: number, participantId: number): Promise<HubRegistration | undefined>;
  upsertHubRegistration(data: UpsertHubRegistrationInput): Promise<HubRegistration>;

  logHubAccessEvent(data: InsertHubAccessEvent): Promise<HubAccessEvent>;
  updateHubAccessEventGhlSync(id: number, updates: {
    ghlNoteId?: string | null;
    ghlSyncStatus?: string;
    ghlSyncedAt?: Date | null;
    ghlSyncError?: string | null;
  }): Promise<HubAccessEvent | undefined>;
  listHubAccessEvents(liveId: number, limit?: number): Promise<HubAccessEvent[]>;
  getHubLiveSummary(liveId: number): Promise<HubLiveSummary>;
  listHubLiveSummaries(status?: HubLiveStatus): Promise<HubLiveSummary[]>;
  getHubDashboardSummary(): Promise<HubDashboardSummary>;
  listHubParticipantHistory(search?: string): Promise<HubParticipantHistory[]>;
  listHubRegistrationSummaries(liveId: number): Promise<HubRegistrationSummary[]>;

  // Portfolio Services
  getPortfolioServices(): Promise<PortfolioService[]>;
  getPortfolioService(id: number): Promise<PortfolioService | undefined>;
  getPortfolioServiceBySlug(slug: string): Promise<PortfolioService | undefined>;
  createPortfolioService(service: InsertPortfolioService): Promise<PortfolioService>;
  updatePortfolioService(id: number, service: Partial<InsertPortfolioService>): Promise<PortfolioService>;
  deletePortfolioService(id: number): Promise<void>;

  // Brand Guidelines (PRES-03 / Phase 17)
  getBrandGuidelines(): Promise<BrandGuidelines | undefined>;
  upsertBrandGuidelines(content: string): Promise<BrandGuidelines>;
  getEstimateGuidelines(): Promise<EstimateGuidelines | undefined>;
  upsertEstimateGuidelines(content: string): Promise<EstimateGuidelines>;

  // Presentations (PRES-05 – PRES-08)
  listPresentations(limit?: number, offset?: number, search?: string): Promise<{ data: PresentationWithStats[], total: number }>;
  getPresentation(id: string): Promise<Presentation | undefined>;
  getPresentationBySlug(slug: string): Promise<Presentation | undefined>;
  createPresentation(data: InsertPresentation): Promise<Presentation>;
  updatePresentation(id: string, data: Partial<InsertPresentation>): Promise<Presentation>;
  deletePresentation(id: string): Promise<void>;
  recordPresentationView(presentationId: string, ipHash?: string): Promise<void>;

  // Landing Pages (Phase 43)
  listLandingPages(): Promise<LandingPage[]>;
  getLandingPage(id: string): Promise<LandingPage | undefined>;
  getLandingPageBySlug(slug: string): Promise<LandingPage | undefined>;
  createLandingPage(data: InsertLandingPageInput): Promise<LandingPage>;
  updateLandingPage(id: string, data: Partial<InsertLandingPageInput>): Promise<LandingPage>;
  deleteLandingPage(id: string): Promise<void>;

  // Brand Guidelines (PRES-09)
  getBrandGuidelines(): Promise<BrandGuidelines | undefined>;
  upsertBrandGuidelines(content: string): Promise<BrandGuidelines>;
  getEstimateGuidelines(): Promise<EstimateGuidelines | undefined>;
  upsertEstimateGuidelines(content: string): Promise<EstimateGuidelines>;

  // Notification Templates (NOTIF-01, NOTIF-02)
  getNotificationTemplates(eventKey?: string): Promise<NotificationTemplate[]>;
  upsertNotificationTemplate(template: InsertNotificationTemplate & { id?: number }): Promise<NotificationTemplate>;
  deleteNotificationTemplate(id: number): Promise<void>;

  // === Marketing Attribution (Phase 45) ===
  // Visitor session upsert (FT immutable, LT mutable per call).
  upsertVisitorSession(session: InsertVisitorSession): Promise<VisitorSession>;
  // Append-only conversion event (lead_created, phone_click, form_submitted, booking_started).
  createAttributionConversion(conversion: InsertAttributionConversion): Promise<AttributionConversion>;
  // Resolve visitor UUID → visitor_sessions.id, stamp it on form_leads.visitor_id, return the integer FK.
  linkLeadToVisitor(leadId: number, visitorId: string): Promise<number | null>;
  // === Marketing queries (5 aggregation methods) ===
  getMarketingOverview(filters?: MarketingFilters): Promise<MarketingOverview>;
  getMarketingBySource(filters?: MarketingFilters): Promise<MarketingBySource[]>;
  getMarketingByCampaign(filters?: MarketingFilters): Promise<MarketingByCampaign[]>;
  getMarketingConversions(filters?: MarketingFilters): Promise<Array<AttributionConversion & { visitorUuid: string | null }>>;
  getVisitorJourney(visitorId: string): Promise<VisitorJourney | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getCompanySettings(): Promise<CompanySettings> {
    await ensureCompanySettingsSchema();

    const [settings] = await db.select().from(companySettings);
    if (settings) {
      return {
        ...settings,
        linksPageConfig: normalizeLinksPageConfig(settings.linksPageConfig as any),
      } as CompanySettings;
    }

    // Create default settings if none exist
    const [newSettings] = await db.insert(companySettings).values({}).returning();
    return {
      ...newSettings,
      linksPageConfig: normalizeLinksPageConfig(newSettings.linksPageConfig as any),
    } as CompanySettings;
  }

  async updateCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings> {
    const existing = await this.getCompanySettings();
    const [updated] = await db.update(companySettings).set(settings).where(eq(companySettings.id, existing.id)).returning();
    return updated;
  }

  async getFaqs(): Promise<Faq[]> {
    return await db.select().from(faqs).orderBy(faqs.order);
  }

  async createFaq(faq: InsertFaq): Promise<Faq> {
    const [newFaq] = await db.insert(faqs).values(faq).returning();
    return newFaq;
  }

  async updateFaq(id: number, faq: Partial<InsertFaq>): Promise<Faq> {
    const [updated] = await db.update(faqs).set(faq).where(eq(faqs.id, id)).returning();
    return updated;
  }

  async deleteFaq(id: number): Promise<void> {
    await db.delete(faqs).where(eq(faqs.id, id));
  }

  async getRedirects(): Promise<Redirect[]> {
    return await db.select().from(redirects).orderBy(redirects.createdAt);
  }

  async getRedirectBySlug(slug: string): Promise<Redirect | undefined> {
    const [row] = await db.select().from(redirects).where(eq(redirects.slug, slug)).limit(1);
    return row;
  }

  async createRedirect(r: InsertRedirect): Promise<Redirect> {
    const [row] = await db.insert(redirects).values(r).returning();
    return row;
  }

  async updateRedirect(id: number, r: Partial<InsertRedirect>): Promise<Redirect> {
    const [row] = await db.update(redirects).set({ ...r, updatedAt: new Date() }).where(eq(redirects.id, id)).returning();
    return row;
  }

  async deleteRedirect(id: number): Promise<void> {
    await db.delete(redirects).where(eq(redirects.id, id));
  }

  async getIntegrationSettings(provider: string): Promise<IntegrationSettings | undefined> {
    const [settings] = await db.select().from(integrationSettings).where(eq(integrationSettings.provider, provider));
    return settings;
  }

  async upsertIntegrationSettings(settings: InsertIntegrationSettings): Promise<IntegrationSettings> {
    const existing = await this.getIntegrationSettings(settings.provider || "gohighlevel");

    if (existing) {
      const [updated] = await db
        .update(integrationSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(integrationSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(integrationSettings).values(settings).returning();
      return created;
    }
  }

  async getChatSettings(): Promise<ChatSettings> {
    await ensureChatSettingsSchema();

    const [settings] = await db.select().from(chatSettings);
    if (settings) return settings;

    const [created] = await db.insert(chatSettings).values({}).returning();
    return created;
  }

  async updateChatSettings(settings: Partial<InsertChatSettings>): Promise<ChatSettings> {
    const existing = await this.getChatSettings();
    const [updated] = await db
      .update(chatSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(chatSettings.id, existing.id))
      .returning();
    return updated;
  }

  async getChatIntegration(provider: string): Promise<ChatIntegrations | undefined> {
    const [integration] = await db.select().from(chatIntegrations).where(eq(chatIntegrations.provider, provider));
    return integration;
  }

  async upsertChatIntegration(settings: InsertChatIntegrations): Promise<ChatIntegrations> {
    const existing = await this.getChatIntegration(settings.provider || "openai");
    if (existing) {
      const payload = {
        ...settings,
        apiKey: settings.apiKey ?? existing.apiKey,
        updatedAt: new Date(),
      };
      const [updated] = await db
        .update(chatIntegrations)
        .set(payload)
        .where(eq(chatIntegrations.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(chatIntegrations).values(settings).returning();
    return created;
  }

  async getTwilioSettings(): Promise<TwilioSettings | undefined> {
    const [settings] = await db.select().from(twilioSettings).orderBy(asc(twilioSettings.id)).limit(1);
    if (settings) return settings;

    // Keep Twilio settings as a singleton row to simplify reads/updates.
    const [created] = await db.insert(twilioSettings).values({}).returning();
    return created;
  }

  async saveTwilioSettings(settings: InsertTwilioSettings): Promise<TwilioSettings> {
    const existing = await this.getTwilioSettings();
    const toPhoneNumbers = Array.isArray(settings.toPhoneNumbers)
      ? settings.toPhoneNumbers.map(num => num?.toString() || "").filter(Boolean)
      : Array.isArray(existing?.toPhoneNumbers)
        ? (existing.toPhoneNumbers as string[]).map(num => num?.toString() || "").filter(Boolean)
        : [];

    if (existing) {
      const payload = {
        ...settings,
        toPhoneNumbers,
        authToken: settings.authToken ?? existing.authToken,
        updatedAt: new Date(),
      };
      const [updated] = await db
        .update(twilioSettings)
        .set(payload)
        .where(eq(twilioSettings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(twilioSettings).values({
      ...settings,
      toPhoneNumbers,
    }).returning();
    return created;
  }

  async getTelegramSettings(): Promise<TelegramSettings | undefined> {
    const [settings] = await db.select().from(telegramSettings).orderBy(asc(telegramSettings.id)).limit(1);
    if (settings) return settings;

    // Singleton auto-create — same pattern as getTwilioSettings
    const [created] = await db.insert(telegramSettings).values({}).returning();
    return created;
  }

  async saveTelegramSettings(settings: InsertTelegramSettings): Promise<TelegramSettings> {
    const existing = await this.getTelegramSettings();

    if (existing) {
      const [updated] = await db
        .update(telegramSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(telegramSettings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(telegramSettings).values(settings).returning();
    return created;
  }

  async getResendSettings(): Promise<ResendSettings | undefined> {
    const [settings] = await db.select().from(resendSettings).orderBy(asc(resendSettings.id)).limit(1);
    if (settings) return settings;

    // Singleton auto-create — same pattern as getTwilioSettings/getTelegramSettings
    const [created] = await db.insert(resendSettings).values({}).returning();
    return created;
  }

  async saveResendSettings(settings: InsertResendSettings): Promise<ResendSettings> {
    const existing = await this.getResendSettings();

    if (existing) {
      const [updated] = await db
        .update(resendSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(resendSettings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(resendSettings).values(settings).returning();
    return created;
  }

  async listConversations(): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .orderBy(desc(sql`COALESCE(${conversations.lastMessageAt}, ${conversations.createdAt})`));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const [updated] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  async deleteConversation(id: string): Promise<void> {
    await db.delete(conversationMessages).where(eq(conversationMessages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [created] = await db.insert(conversations).values(conversation).returning();
    return created;
  }

  async addConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
    const [created] = await db.insert(conversationMessages).values(message).returning();
    return created;
  }

  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    return await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(asc(conversationMessages.createdAt));
  }

  // ──────────────────────────────────────────────────────────
  // Forms (multi-form support — Milestone 3)
  // ──────────────────────────────────────────────────────────

  async listForms(includeInactive = false): Promise<Form[]> {
    const rows = includeInactive
      ? await db.select().from(forms).orderBy(desc(forms.isDefault), asc(forms.name))
      : await db.select().from(forms).where(eq(forms.isActive, true)).orderBy(desc(forms.isDefault), asc(forms.name));
    return rows;
  }

  async getForm(id: number): Promise<Form | undefined> {
    const [row] = await db.select().from(forms).where(eq(forms.id, id));
    return row;
  }

  async getFormBySlug(slug: string): Promise<Form | undefined> {
    const [row] = await db.select().from(forms).where(eq(forms.slug, slug));
    return row;
  }

  async getDefaultForm(): Promise<Form | undefined> {
    const [row] = await db.select().from(forms).where(eq(forms.isDefault, true));
    return row;
  }

  // Provisions a default form from DEFAULT_FORM_CONFIG if none exists yet.
  async ensureDefaultForm(): Promise<Form> {
    const existing = await this.getDefaultForm();
    if (existing) return existing;

    const [created] = await db.insert(forms).values({
      slug: "default",
      name: "Default Form",
      description: "Auto-provisioned default form",
      isDefault: true,
      isActive: true,
      config: DEFAULT_FORM_CONFIG,
    }).returning();

    // Backfill any orphan leads (form_id IS NULL) to the newly created default form.
    await db.update(formLeads)
      .set({ formId: created.id })
      .where(sql`${formLeads.formId} IS NULL`);

    return created;
  }

  async createForm(input: InsertFormInput): Promise<Form> {
    // If this new form is marked default, unmark the current default first.
    if (input.isDefault) {
      await db.update(forms).set({ isDefault: false }).where(eq(forms.isDefault, true));
    }
    const [created] = await db.insert(forms).values({
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      config: input.config,
    }).returning();
    return created;
  }

  async updateForm(id: number, updates: UpdateFormInput): Promise<Form> {
    // If promoting to default, demote any current default first.
    if (updates.isDefault === true) {
      await db.update(forms).set({ isDefault: false }).where(and(eq(forms.isDefault, true), ne(forms.id, id)));
    }
    const [updated] = await db.update(forms).set({
      ...(updates.slug !== undefined && { slug: updates.slug }),
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description ?? null }),
      ...(updates.isDefault !== undefined && { isDefault: updates.isDefault }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      ...(updates.config !== undefined && { config: updates.config }),
      updatedAt: new Date(),
    }).where(eq(forms.id, id)).returning();
    if (!updated) throw new Error(`Form ${id} not found`);
    return updated;
  }

  async softDeleteForm(id: number): Promise<void> {
    const target = await this.getForm(id);
    if (!target) return;
    if (target.isDefault) {
      throw new Error("Cannot delete the default form. Set another form as default first.");
    }
    await db.update(forms).set({ isActive: false, updatedAt: new Date() }).where(eq(forms.id, id));
  }

  async duplicateForm(id: number, overrides?: { slug?: string; name?: string }): Promise<Form> {
    const source = await this.getForm(id);
    if (!source) throw new Error(`Form ${id} not found`);

    // Derive a unique slug if none provided.
    let candidateSlug = overrides?.slug ?? `${source.slug}-copy`;
    let counter = 2;
    while (await this.getFormBySlug(candidateSlug)) {
      candidateSlug = `${overrides?.slug ?? source.slug}-copy-${counter}`;
      counter++;
    }

    const [created] = await db.insert(forms).values({
      slug: candidateSlug,
      name: overrides?.name ?? `${source.name} (copy)`,
      description: source.description,
      isDefault: false,
      isActive: true,
      config: source.config,
    }).returning();
    return created;
  }

  async setDefaultForm(id: number): Promise<Form> {
    // Transactional swap: demote current default, promote target.
    await db.update(forms).set({ isDefault: false }).where(eq(forms.isDefault, true));
    const [updated] = await db.update(forms)
      .set({ isDefault: true, isActive: true, updatedAt: new Date() })
      .where(eq(forms.id, id))
      .returning();
    if (!updated) throw new Error(`Form ${id} not found`);
    return updated;
  }

  async countLeadsForForm(formId: number): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(formLeads)
      .where(eq(formLeads.formId, formId));
    return row?.count ?? 0;
  }

  async listLeadsForForm(formId: number, limit: number, offset: number): Promise<{ data: (typeof formLeads.$inferSelect)[]; total: number }> {
    const [countRow, data] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(formLeads).where(eq(formLeads.formId, formId)),
      db.select().from(formLeads).where(eq(formLeads.formId, formId)).orderBy(desc(formLeads.createdAt)).limit(limit).offset(offset),
    ]);
    return { data, total: countRow[0]?.count ?? 0 };
  }

  // ──────────────────────────────────────────────────────────
  // Form Leads
  // ──────────────────────────────────────────────────────────

  async getFormLeadBySession(sessionId: string): Promise<FormLead | undefined> {
    const [lead] = await db.select().from(formLeads).where(eq(formLeads.sessionId, sessionId));
    return lead;
  }

  async getFormLeadByConversationId(conversationId: string): Promise<FormLead | undefined> {
    const [lead] = await db.select().from(formLeads).where(eq(formLeads.conversationId, conversationId));
    return lead;
  }

  async getFormLeadByEmail(email: string): Promise<FormLead | undefined> {
    const [lead] = await db.select().from(formLeads).where(eq(formLeads.email, email));
    return lead;
  }

  async upsertFormLeadProgress(progress: FormLeadProgressInput, metadata: { userAgent?: string; conversationId?: string; source?: string; formId?: number } = {}, formConfig?: FormConfig): Promise<FormLead> {
    // For chat source, try to find by conversationId first
    let existing = metadata.conversationId
      ? await this.getFormLeadByConversationId(metadata.conversationId)
      : await this.getFormLeadBySession(progress.sessionId);

    if (!existing) {
      existing = await this.getFormLeadBySession(progress.sessionId);
    }
    // Resolve which form this lead belongs to.
    // Priority: explicit metadata.formId → existing lead's formId → default form (provisioned if missing).
    let resolvedFormId: number | null = metadata.formId ?? existing?.formId ?? null;
    let resolvedConfig: FormConfig;
    if (formConfig) {
      resolvedConfig = formConfig;
      if (!resolvedFormId) {
        const def = await this.ensureDefaultForm();
        resolvedFormId = def.id;
      }
    } else if (resolvedFormId) {
      const form = await this.getForm(resolvedFormId);
      resolvedConfig = (form?.config as FormConfig | undefined) ?? DEFAULT_FORM_CONFIG;
    } else {
      const def = await this.ensureDefaultForm();
      resolvedFormId = def.id;
      resolvedConfig = def.config as FormConfig;
    }
    const config = resolvedConfig;
    const totalQuestions = config.questions.length || DEFAULT_FORM_CONFIG.questions.length;
    const safeQuestionNumber = Math.max(1, Math.min(progress.questionNumber, totalQuestions));

    const mergedCustomAnswers = Object.fromEntries(
      Object.entries({
        ...(existing?.customAnswers || {}),
        ...(progress.customAnswers || {}),
      }).filter(([_, value]) => typeof value === "string" && value.trim().length > 0)
    );

    const answersForScoring: Record<string, string | undefined> = {
      ...mergedCustomAnswers,
      nome: progress.nome ?? existing?.nome ?? undefined,
      email: progress.email ?? existing?.email ?? undefined,
      telefone: progress.telefone ?? existing?.telefone ?? undefined,
      cidadeEstado: progress.cidadeEstado ?? existing?.cidadeEstado ?? undefined,
      tipoNegocio: progress.tipoNegocio ?? existing?.tipoNegocio ?? undefined,
      tipoNegocioOutro: progress.tipoNegocioOutro ?? existing?.tipoNegocioOutro ?? undefined,
      tempoNegocio: progress.tempoNegocio ?? existing?.tempoNegocio ?? undefined,
      experienciaMarketing: progress.experienciaMarketing ?? existing?.experienciaMarketing ?? undefined,
      orcamentoAnuncios: progress.orcamentoAnuncios ?? existing?.orcamentoAnuncios ?? undefined,
      principalDesafio: progress.principalDesafio ?? existing?.principalDesafio ?? undefined,
      disponibilidade: progress.disponibilidade ?? existing?.disponibilidade ?? undefined,
      expectativaResultado: progress.expectativaResultado ?? existing?.expectativaResultado ?? undefined,
    };

    const scoreResult = calculateFormScoresWithConfig(answersForScoring, config);
    const isComplete = progress.formCompleto || safeQuestionNumber >= totalQuestions;
    const classification: LeadClassification | undefined = isComplete
      ? classifyLead(scoreResult.total, config.thresholds)
      : (existing?.classificacao ?? (progress.classificacao as LeadClassification | undefined));
    const now = new Date();
    const latestQuestion = Math.max(safeQuestionNumber, existing?.ultimaPerguntaRespondida ?? 0);

    const payload: Partial<typeof formLeads.$inferInsert> = {
      sessionId: progress.sessionId,
      tenantId: existing?.tenantId ?? 1,
      formId: resolvedFormId,
      nome: progress.nome ?? existing?.nome ?? "",
      email: progress.email ?? existing?.email,
      telefone: progress.telefone ?? existing?.telefone,
      cidadeEstado: progress.cidadeEstado ?? existing?.cidadeEstado,
      tipoNegocio: progress.tipoNegocio ?? existing?.tipoNegocio,
      tipoNegocioOutro: progress.tipoNegocioOutro ?? existing?.tipoNegocioOutro,
      tempoNegocio: progress.tempoNegocio ?? existing?.tempoNegocio,
      experienciaMarketing: progress.experienciaMarketing ?? existing?.experienciaMarketing,
      orcamentoAnuncios: progress.orcamentoAnuncios ?? existing?.orcamentoAnuncios,
      principalDesafio: progress.principalDesafio ?? existing?.principalDesafio,
      disponibilidade: progress.disponibilidade ?? existing?.disponibilidade,
      expectativaResultado: progress.expectativaResultado ?? existing?.expectativaResultado,
      customAnswers: mergedCustomAnswers,
      scoreTotal: scoreResult.total,
      classificacao: classification,
      scoreTipoNegocio: scoreResult.breakdown.scoreTipoNegocio ?? existing?.scoreTipoNegocio ?? 0,
      scoreTempoNegocio: scoreResult.breakdown.scoreTempoNegocio ?? existing?.scoreTempoNegocio ?? 0,
      scoreExperiencia: scoreResult.breakdown.scoreExperiencia ?? existing?.scoreExperiencia ?? 0,
      scoreOrcamento: scoreResult.breakdown.scoreOrcamento ?? existing?.scoreOrcamento ?? 0,
      scoreDesafio: scoreResult.breakdown.scoreDesafio ?? existing?.scoreDesafio ?? 0,
      scoreDisponibilidade: scoreResult.breakdown.scoreDisponibilidade ?? existing?.scoreDisponibilidade ?? 0,
      scoreExpectativa: scoreResult.breakdown.scoreExpectativa ?? existing?.scoreExpectativa ?? 0,
      tempoTotalSegundos: progress.tempoTotalSegundos ?? existing?.tempoTotalSegundos,
      userAgent: metadata.userAgent ?? existing?.userAgent,
      urlOrigem: progress.urlOrigem ?? existing?.urlOrigem,
      utmSource: progress.utmSource ?? existing?.utmSource,
      utmMedium: progress.utmMedium ?? existing?.utmMedium,
      utmCampaign: progress.utmCampaign ?? existing?.utmCampaign,
      status: existing?.status ?? "novo",
      formCompleto: isComplete || existing?.formCompleto || false,
      ultimaPerguntaRespondida: latestQuestion,
      notificacaoEnviada: existing?.notificacaoEnviada ?? false,
      updatedAt: now,
      ghlContactId: existing?.ghlContactId ?? null,
      ghlSyncStatus: existing?.ghlSyncStatus ?? "pending",
      source: metadata.source ?? existing?.source ?? "form",
      conversationId: metadata.conversationId ?? existing?.conversationId ?? null,
    };

    if (!existing) {
      const startedAt = progress.startedAt ? new Date(progress.startedAt) : now;
      const safeStartedAt = isNaN(startedAt.getTime()) ? now : startedAt;
      const insertPayload: typeof formLeads.$inferInsert = {
        sessionId: progress.sessionId,
        tenantId: 1,
        formId: resolvedFormId,
        nome: progress.nome || "",
        email: payload.email,
        telefone: payload.telefone,
        cidadeEstado: payload.cidadeEstado,
        tipoNegocio: payload.tipoNegocio,
        tipoNegocioOutro: payload.tipoNegocioOutro,
        tempoNegocio: payload.tempoNegocio,
        experienciaMarketing: payload.experienciaMarketing,
        orcamentoAnuncios: payload.orcamentoAnuncios,
        principalDesafio: payload.principalDesafio,
        disponibilidade: payload.disponibilidade,
        expectativaResultado: payload.expectativaResultado,
        customAnswers: mergedCustomAnswers,
        scoreTotal: payload.scoreTotal ?? 0,
        classificacao: payload.classificacao ?? null,
        scoreTipoNegocio: payload.scoreTipoNegocio ?? 0,
        scoreTempoNegocio: payload.scoreTempoNegocio ?? 0,
        scoreExperiencia: payload.scoreExperiencia ?? 0,
        scoreOrcamento: payload.scoreOrcamento ?? 0,
        scoreDesafio: payload.scoreDesafio ?? 0,
        scoreDisponibilidade: payload.scoreDisponibilidade ?? 0,
        scoreExpectativa: payload.scoreExpectativa ?? 0,
        tempoTotalSegundos: payload.tempoTotalSegundos ?? null,
        userAgent: payload.userAgent ?? null,
        urlOrigem: payload.urlOrigem ?? null,
        utmSource: payload.utmSource ?? null,
        utmMedium: payload.utmMedium ?? null,
        utmCampaign: payload.utmCampaign ?? null,
        status: payload.status ?? "novo",
        formCompleto: payload.formCompleto ?? false,
        ultimaPerguntaRespondida: payload.ultimaPerguntaRespondida ?? latestQuestion,
        notificacaoEnviada: payload.notificacaoEnviada ?? false,
        dataContato: null,
        observacoes: payload.observacoes ?? null,
        ghlContactId: null,
        ghlSyncStatus: payload.ghlSyncStatus ?? "pending",
        source: metadata.source ?? "form",
        conversationId: metadata.conversationId ?? null,
        createdAt: safeStartedAt,
        updatedAt: now,
      };
      try {
        const [created] = await db.insert(formLeads).values(insertPayload).returning();
        return created;
      } catch (err: any) {
        if (err?.code === "23505") {
          const existingBySession = await this.getFormLeadBySession(progress.sessionId);
          if (existingBySession) {
            const [updatedExisting] = await db
              .update(formLeads)
              .set(payload)
              .where(eq(formLeads.id, existingBySession.id))
              .returning();
            return updatedExisting;
          }
        }
        throw err;
      }
    }

    const [updated] = await db
      .update(formLeads)
      .set(payload)
      .where(eq(formLeads.id, existing.id))
      .returning();
    return updated;
  }

  async listFormLeads(filters: { status?: LeadStatus; classificacao?: LeadClassification; formCompleto?: boolean; completionStatus?: 'completo' | 'em_progresso' | 'abandonado'; search?: string; formId?: number } = {}): Promise<FormLead[]> {
    const conditions: any[] = [];
    if (filters.status) conditions.push(eq(formLeads.status, filters.status));
    if (filters.classificacao) conditions.push(eq(formLeads.classificacao, filters.classificacao));
    if (typeof filters.formId === 'number') conditions.push(eq(formLeads.formId, filters.formId));

    // New 3-stage completion filter
    if (filters.completionStatus) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (filters.completionStatus === 'completo') {
        conditions.push(eq(formLeads.formCompleto, true));
      } else if (filters.completionStatus === 'em_progresso') {
        // Not complete AND updated within last 24 hours
        conditions.push(eq(formLeads.formCompleto, false));
        conditions.push(gte(formLeads.updatedAt, oneDayAgo));
      } else if (filters.completionStatus === 'abandonado') {
        // Not complete AND updated more than 24 hours ago
        conditions.push(eq(formLeads.formCompleto, false));
        conditions.push(lt(formLeads.updatedAt, oneDayAgo));
      }
    } else if (typeof filters.formCompleto === "boolean") {
      // Legacy filter support
      conditions.push(eq(formLeads.formCompleto, filters.formCompleto));
    }

    if (filters.search) {
      const likeValue = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        or(
          ilike(formLeads.nome, likeValue),
          ilike(formLeads.email, likeValue),
          ilike(formLeads.telefone, likeValue),
        )
      );
    }

    if (conditions.length) {
      return await db.select().from(formLeads).where(and(...conditions)).orderBy(desc(formLeads.createdAt));
    }
    return await db.select().from(formLeads).orderBy(desc(formLeads.createdAt));
  }

  async updateFormLead(id: number, updates: Partial<Pick<FormLead, "status" | "observacoes" | "notificacaoEnviada" | "ghlContactId" | "ghlSyncStatus">>): Promise<FormLead | undefined> {
    const [existing] = await db.select().from(formLeads).where(eq(formLeads.id, id));
    if (!existing) return undefined;

    const [updated] = await db
      .update(formLeads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(formLeads.id, id))
      .returning();
    return updated;
  }

  async deleteFormLead(id: number): Promise<boolean> {
    const [existing] = await db.select().from(formLeads).where(eq(formLeads.id, id));
    if (!existing) return false;
    await db.delete(formLeads).where(eq(formLeads.id, id));
    return true;
  }

  async getBlogPosts(status?: string): Promise<BlogPost[]> {
    if (status) {
      return await db.select().from(blogPosts).where(eq(blogPosts.status, status)).orderBy(desc(blogPosts.createdAt));
    }
    return await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async getPublishedBlogPosts(limit: number = 10, offset: number = 0): Promise<BlogPost[]> {
    return await db.select()
      .from(blogPosts)
      .where(eq(blogPosts.status, 'published'))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  async getRelatedBlogPosts(postId: number, limit: number = 4): Promise<BlogPost[]> {
    return await db.select()
      .from(blogPosts)
      .where(and(
        eq(blogPosts.status, 'published'),
        ne(blogPosts.id, postId)
      ))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit);
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [newPost] = await db.insert(blogPosts).values(post).returning();
    return newPost;
  }

  async updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [updated] = await db.update(blogPosts)
      .set({ ...post, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return updated;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async countPublishedBlogPosts(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(blogPosts)
      .where(eq(blogPosts.status, 'published'));
    return Number(result[0]?.count || 0);
  }

  async getBlogSettings(): Promise<BlogSettings | undefined> {
    const [settings] = await db.select().from(blogSettings).orderBy(asc(blogSettings.id)).limit(1);
    return settings;
  }

  async upsertBlogSettings(data: InsertBlogSettings): Promise<BlogSettings> {
    const existing = await this.getBlogSettings();

    if (existing) {
      const [updated] = await db
        .update(blogSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(blogSettings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(blogSettings).values(data).returning();
    return created;
  }

  async createBlogGenerationJob(data: InsertBlogGenerationJob): Promise<BlogGenerationJob> {
    const [created] = await db.insert(blogGenerationJobs).values(data).returning();
    return created;
  }

  async updateBlogGenerationJob(id: number, data: Partial<InsertBlogGenerationJob>): Promise<BlogGenerationJob> {
    const [updated] = await db
      .update(blogGenerationJobs)
      .set(data)
      .where(eq(blogGenerationJobs.id, id))
      .returning();
    return updated;
  }

  async getLatestBlogGenerationJob(): Promise<BlogGenerationJob | undefined> {
    const [job] = await db
      .select()
      .from(blogGenerationJobs)
      .orderBy(desc(blogGenerationJobs.id))
      .limit(1);
    return job;
  }

  // ─── Blog RSS Sources & Items (Phase 34 — RSS-04) ─────────────────────────

  async listRssSources(): Promise<BlogRssSource[]> {
    return await db
      .select()
      .from(blogRssSources)
      .orderBy(desc(blogRssSources.createdAt));
  }

  async getRssSource(id: number): Promise<BlogRssSource | undefined> {
    const [row] = await db
      .select()
      .from(blogRssSources)
      .where(eq(blogRssSources.id, id))
      .limit(1);
    return row;
  }

  async createRssSource(input: InsertBlogRssSource): Promise<BlogRssSource> {
    const [created] = await db
      .insert(blogRssSources)
      .values(input)
      .returning();
    return created;
  }

  async updateRssSource(
    id: number,
    patch: Partial<InsertBlogRssSource>,
  ): Promise<BlogRssSource | undefined> {
    const [updated] = await db
      .update(blogRssSources)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(blogRssSources.id, id))
      .returning();
    return updated;
  }

  async deleteRssSource(id: number): Promise<void> {
    await db.delete(blogRssSources).where(eq(blogRssSources.id, id));
    // FK ON DELETE CASCADE drops all blog_rss_items rows automatically (D-01).
  }

  async upsertRssItem(item: InsertBlogRssItem): Promise<BlogRssItem> {
    // Dedupe on the (source_id, guid) UNIQUE INDEX (D-06.2). On conflict,
    // refresh metadata only — never touch status/used_*/skip_reason.
    const [row] = await db
      .insert(blogRssItems)
      .values(item)
      .onConflictDoUpdate({
        target: [blogRssItems.sourceId, blogRssItems.guid],
        set: {
          url: item.url,
          title: item.title,
          summary: item.summary ?? null,
          publishedAt: item.publishedAt ?? null,
        },
      })
      .returning();
    return row;
  }

  async listPendingRssItems(limit?: number): Promise<BlogRssItem[]> {
    // Order by published_at DESC NULLS LAST so newest stories rank highest;
    // items with no published_at fall to the bottom (rare but possible).
    const query = db
      .select()
      .from(blogRssItems)
      .where(eq(blogRssItems.status, "pending"))
      .orderBy(sql`${blogRssItems.publishedAt} DESC NULLS LAST`);

    if (typeof limit === "number" && limit > 0) {
      return await query.limit(limit);
    }
    return await query;
  }

  async markRssItemUsed(itemId: number, postId: number): Promise<void> {
    await db
      .update(blogRssItems)
      .set({
        status: "used",
        usedAt: new Date(),
        usedPostId: postId,
      })
      .where(eq(blogRssItems.id, itemId));
  }

  async markRssItemSkipped(itemId: number, reason?: string): Promise<void> {
    await db
      .update(blogRssItems)
      .set({
        status: "skipped",
        skipReason: reason ?? null,
      })
      .where(eq(blogRssItems.id, itemId));
  }

  // Phase 37 — read-side joins for admin UI

  async listRssItemsByStatus(
    status: BlogRssItemStatus,
    limit: number,
    offset: number,
  ): Promise<RssItemWithSource[]> {
    // Order: published_at DESC NULLS LAST so newest items rank highest;
    // matches the convention from listPendingRssItems (Phase 34-02).
    const rows = await db
      .select({
        // All blogRssItems columns (listed explicitly to keep return shape stable):
        id: blogRssItems.id,
        sourceId: blogRssItems.sourceId,
        guid: blogRssItems.guid,
        url: blogRssItems.url,
        title: blogRssItems.title,
        summary: blogRssItems.summary,
        publishedAt: blogRssItems.publishedAt,
        status: blogRssItems.status,
        usedAt: blogRssItems.usedAt,
        usedPostId: blogRssItems.usedPostId,
        skipReason: blogRssItems.skipReason,
        createdAt: blogRssItems.createdAt,
        sourceName: blogRssSources.name,
      })
      .from(blogRssItems)
      .leftJoin(blogRssSources, eq(blogRssItems.sourceId, blogRssSources.id))
      .where(eq(blogRssItems.status, status))
      .orderBy(sql`${blogRssItems.publishedAt} DESC NULLS LAST`)
      .limit(limit)
      .offset(offset);

    // Phase 37 D-05: attach real-time relevance score for pending rows ONLY.
    // For used/skipped, score is null (the decision is already made).
    if (status === "pending") {
      const settings = await this.getBlogSettings();
      if (settings) {
        const now = new Date();
        return rows.map((r) => ({
          ...(r as RssItemWithSource),
          score: scoreItem(r as BlogRssItem, settings, now),
        }));
      }
      // No settings = cannot score; return null score for all pending rows.
      return rows.map((r) => ({ ...(r as RssItemWithSource), score: null }));
    }
    return rows.map((r) => ({ ...(r as RssItemWithSource), score: null }));
  }

  async listBlogGenerationJobs(limit: number): Promise<BlogGenerationJobWithRssItem[]> {
    // Join chain: blogGenerationJobs.postId -> blogRssItems.usedPostId
    // (jobs have no direct rssItemId column; the only link is through the
    // post they produced. Skipped/failed jobs that never created a post
    // will have rssItemTitle=null and rssItemId=null — correct semantics.)
    const rows = await db
      .select({
        id: blogGenerationJobs.id,
        status: blogGenerationJobs.status,
        reason: blogGenerationJobs.reason,
        postId: blogGenerationJobs.postId,
        startedAt: blogGenerationJobs.startedAt,
        completedAt: blogGenerationJobs.completedAt,
        error: blogGenerationJobs.error,
        durationsMs: blogGenerationJobs.durationsMs,
        rssItemTitle: blogRssItems.title,
        rssItemId: blogRssItems.id,
      })
      .from(blogGenerationJobs)
      .leftJoin(
        blogRssItems,
        eq(blogGenerationJobs.postId, blogRssItems.usedPostId),
      )
      .orderBy(desc(blogGenerationJobs.id))
      .limit(limit);

    return rows as BlogGenerationJobWithRssItem[];
  }

  async getBlogGenerationJob(id: number): Promise<BlogGenerationJob | undefined> {
    const [row] = await db
      .select()
      .from(blogGenerationJobs)
      .where(eq(blogGenerationJobs.id, id))
      .limit(1);
    return row;
  }

  async getBlogGenerationJobWithRssItem(
    id: number,
  ): Promise<BlogGenerationJobWithRssItem | undefined> {
    // Same join shape as listBlogGenerationJobs, scoped to a single id.
    // Used by the retry handler (Plan 02) to recover rssItemId without an O(N) scan.
    const [row] = await db
      .select({
        id: blogGenerationJobs.id,
        status: blogGenerationJobs.status,
        reason: blogGenerationJobs.reason,
        postId: blogGenerationJobs.postId,
        startedAt: blogGenerationJobs.startedAt,
        completedAt: blogGenerationJobs.completedAt,
        error: blogGenerationJobs.error,
        durationsMs: blogGenerationJobs.durationsMs,
        rssItemTitle: blogRssItems.title,
        rssItemId: blogRssItems.id,
      })
      .from(blogGenerationJobs)
      .leftJoin(
        blogRssItems,
        eq(blogGenerationJobs.postId, blogRssItems.usedPostId),
      )
      .where(eq(blogGenerationJobs.id, id))
      .limit(1);
    return row as BlogGenerationJobWithRssItem | undefined;
  }

  async getHubLives(status?: HubLiveStatus): Promise<HubLive[]> {
    let query = db.select().from(hubLives).orderBy(desc(hubLives.startsAt)).$dynamic();

    if (status) {
      query = query.where(eq(hubLives.status, status));
    }

    return await query;
  }

  async getCurrentHubLive(): Promise<HubLive | undefined> {
    const [live] = await db
      .select()
      .from(hubLives)
      .where(eq(hubLives.status, "live"))
      .orderBy(desc(hubLives.startsAt))
      .limit(1);

    return live;
  }

  async getHubLive(id: number): Promise<HubLive | undefined> {
    const [live] = await db.select().from(hubLives).where(eq(hubLives.id, id));
    return live;
  }

  async getHubLiveBySlug(slug: string): Promise<HubLive | undefined> {
    const [live] = await db.select().from(hubLives).where(eq(hubLives.slug, slug));
    return live;
  }

  async createHubLive(data: InsertHubLive): Promise<HubLive> {
    const [live] = await db.insert(hubLives).values(data).returning();
    return live;
  }

  async updateHubLive(id: number, data: Partial<InsertHubLive>): Promise<HubLive> {
    const [live] = await db
      .update(hubLives)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(hubLives.id, id))
      .returning();

    if (!live) {
      throw new Error(`Hub live ${id} not found`);
    }

    return live;
  }

  async activateHubLive(id: number): Promise<HubLive> {
    return await db.transaction(async (tx) => {
      await tx
        .update(hubLives)
        .set({ status: "scheduled", updatedAt: new Date() })
        .where(and(eq(hubLives.status, "live"), ne(hubLives.id, id)));

      const [live] = await tx
        .update(hubLives)
        .set({ status: "live", updatedAt: new Date() })
        .where(eq(hubLives.id, id))
        .returning();

      if (!live) {
        throw new Error(`Hub live ${id} not found`);
      }

      return live;
    });
  }

  async getHubParticipant(id: number): Promise<HubParticipant | undefined> {
    const [participant] = await db.select().from(hubParticipants).where(eq(hubParticipants.id, id));
    return participant;
  }

  async findHubParticipantByIdentity(identity: HubParticipantIdentityLookup): Promise<HubParticipant | undefined> {
    const phoneNormalized = normalizeHubPhone(identity.phoneNormalized ?? identity.phone);
    const emailNormalized = normalizeHubEmail(identity.emailNormalized ?? identity.email);

    if (phoneNormalized) {
      const [participant] = await db
        .select()
        .from(hubParticipants)
        .where(eq(hubParticipants.phoneNormalized, phoneNormalized))
        .limit(1);

      if (participant) {
        return participant;
      }
    }

    if (emailNormalized) {
      const [participant] = await db
        .select()
        .from(hubParticipants)
        .where(eq(hubParticipants.emailNormalized, emailNormalized))
        .limit(1);

      if (participant) {
        return participant;
      }
    }

    return undefined;
  }

  async upsertHubParticipant(data: UpsertHubParticipantInput): Promise<HubParticipant> {
    const existing = await this.findHubParticipantByIdentity({
      phone: data.phoneRaw ?? null,
      email: data.emailRaw ?? null,
      phoneNormalized: data.phoneNormalized,
      emailNormalized: data.emailNormalized,
    });
    const phoneNormalized = normalizeHubPhone(data.phoneNormalized ?? data.phoneRaw);
    const emailNormalized = normalizeHubEmail(data.emailNormalized ?? data.emailRaw);

    if (existing) {
      const [participant] = await db
        .update(hubParticipants)
        .set({
          fullName: data.fullName,
          phoneRaw: data.phoneRaw ?? null,
          phoneNormalized,
          emailRaw: data.emailRaw ?? null,
          emailNormalized,
          source: data.source,
          notes: data.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(hubParticipants.id, existing.id))
        .returning();

      return participant;
    }

    const [participant] = await db.insert(hubParticipants).values({
      fullName: data.fullName,
      phoneRaw: data.phoneRaw ?? null,
      phoneNormalized,
      emailRaw: data.emailRaw ?? null,
      emailNormalized,
      source: data.source,
      notes: data.notes ?? null,
    }).returning();

    return participant;
  }

  async updateHubParticipantGhlSync(id: number, updates: {
    ghlContactId?: string | null;
    ghlSyncStatus?: string;
    ghlLastSyncedAt?: Date | null;
    ghlSyncError?: string | null;
  }): Promise<HubParticipant | undefined> {
    const [participant] = await db
      .update(hubParticipants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(hubParticipants.id, id))
      .returning();

    return participant;
  }

  async getHubRegistration(liveId: number, participantId: number): Promise<HubRegistration | undefined> {
    const [registration] = await db
      .select()
      .from(hubRegistrations)
      .where(and(eq(hubRegistrations.liveId, liveId), eq(hubRegistrations.participantId, participantId)));
    return registration;
  }

  async upsertHubRegistration(data: UpsertHubRegistrationInput): Promise<HubRegistration> {
    const existing = await this.getHubRegistration(data.liveId, data.participantId);

    if (existing) {
      const [registration] = await db
        .update(hubRegistrations)
        .set({
          status: data.status,
          source: data.source,
          notes: data.notes ?? null,
          registeredAt: data.registeredAt,
          cancelledAt: data.cancelledAt,
          attendedAt: data.attendedAt,
          lastAccessAt: data.lastAccessAt,
          updatedAt: new Date(),
        })
        .where(eq(hubRegistrations.id, existing.id))
        .returning();

      return registration;
    }

    const [registration] = await db.insert(hubRegistrations).values({
      liveId: data.liveId,
      participantId: data.participantId,
      status: data.status,
      source: data.source,
      notes: data.notes ?? null,
      registeredAt: data.registeredAt,
      cancelledAt: data.cancelledAt,
      attendedAt: data.attendedAt,
      lastAccessAt: data.lastAccessAt,
    }).returning();

    return registration;
  }

  async logHubAccessEvent(data: InsertHubAccessEvent): Promise<HubAccessEvent> {
    const phoneNormalized = normalizeHubPhone(data.phoneNormalized ?? data.phoneRaw);
    const emailNormalized = normalizeHubEmail(data.emailNormalized ?? data.emailRaw);

    let registrationId = data.registrationId ?? null;
    if (!registrationId && data.participantId != null) {
      const registration = await this.getHubRegistration(data.liveId, data.participantId);
      registrationId = registration?.id ?? null;
    }

    const [event] = await db.insert(hubAccessEvents).values({
      liveId: data.liveId,
      participantId: data.participantId ?? null,
      registrationId,
      eventType: data.eventType,
      outcome: data.outcome,
      matchedBy: data.matchedBy ?? "none",
      phoneRaw: data.phoneRaw ?? null,
      phoneNormalized,
      emailRaw: data.emailRaw ?? null,
      emailNormalized,
      ipHash: data.ipHash ?? null,
      userAgent: data.userAgent ?? null,
      metadata: data.metadata ?? {},
      createdAt: data.createdAt,
    }).returning();

    if (event.outcome === "granted" && registrationId) {
      await db
        .update(hubRegistrations)
        .set({ lastAccessAt: event.createdAt ?? new Date(), updatedAt: new Date() })
        .where(eq(hubRegistrations.id, registrationId));
    }

    return event;
  }

  async updateHubAccessEventGhlSync(id: number, updates: {
    ghlNoteId?: string | null;
    ghlSyncStatus?: string;
    ghlSyncedAt?: Date | null;
    ghlSyncError?: string | null;
  }): Promise<HubAccessEvent | undefined> {
    const [event] = await db
      .update(hubAccessEvents)
      .set(updates)
      .where(eq(hubAccessEvents.id, id))
      .returning();

    return event;
  }

  async listHubAccessEvents(liveId: number, limit = 50): Promise<HubAccessEvent[]> {
    return await db
      .select()
      .from(hubAccessEvents)
      .where(eq(hubAccessEvents.liveId, liveId))
      .orderBy(desc(hubAccessEvents.createdAt))
      .limit(limit);
  }

  async getHubLiveSummary(liveId: number): Promise<HubLiveSummary> {
    const [summary] = await db
      .select({
        id: hubLives.id,
        slug: hubLives.slug,
        title: hubLives.title,
        description: hubLives.description,
        hostName: hubLives.hostName,
        timezone: hubLives.timezone,
        startsAt: hubLives.startsAt,
        endsAt: hubLives.endsAt,
        registrationOpensAt: hubLives.registrationOpensAt,
        registrationClosesAt: hubLives.registrationClosesAt,
        streamUrl: hubLives.streamUrl,
        replayUrl: hubLives.replayUrl,
        status: hubLives.status,
        capacity: hubLives.capacity,
        createdAt: hubLives.createdAt,
        updatedAt: hubLives.updatedAt,
        registrationCount: sql<number>`count(distinct ${hubRegistrations.id})::int`,
        grantedAccessCount: sql<number>`count(distinct case when ${hubAccessEvents.outcome} = 'granted' then ${hubAccessEvents.id} end)::int`,
        deniedAccessCount: sql<number>`count(distinct case when ${hubAccessEvents.outcome} = 'denied' then ${hubAccessEvents.id} end)::int`,
        uniqueParticipantCount: sql<number>`count(distinct ${hubRegistrations.participantId})::int`,
        lastAccessAt: sql<Date | null>`max(${hubAccessEvents.createdAt})`,
      })
      .from(hubLives)
      .leftJoin(hubRegistrations, eq(hubRegistrations.liveId, hubLives.id))
      .leftJoin(hubAccessEvents, eq(hubAccessEvents.liveId, hubLives.id))
      .where(eq(hubLives.id, liveId))
      .groupBy(hubLives.id);

    if (!summary) {
      throw new Error(`Hub live ${liveId} not found`);
    }

    return summary;
  }

  async listHubLiveSummaries(status?: HubLiveStatus): Promise<HubLiveSummary[]> {
    let query = db
      .select({
        id: hubLives.id,
        slug: hubLives.slug,
        title: hubLives.title,
        description: hubLives.description,
        hostName: hubLives.hostName,
        timezone: hubLives.timezone,
        startsAt: hubLives.startsAt,
        endsAt: hubLives.endsAt,
        registrationOpensAt: hubLives.registrationOpensAt,
        registrationClosesAt: hubLives.registrationClosesAt,
        streamUrl: hubLives.streamUrl,
        replayUrl: hubLives.replayUrl,
        status: hubLives.status,
        capacity: hubLives.capacity,
        createdAt: hubLives.createdAt,
        updatedAt: hubLives.updatedAt,
        registrationCount: sql<number>`count(distinct ${hubRegistrations.id})::int`,
        grantedAccessCount: sql<number>`count(distinct case when ${hubAccessEvents.outcome} = 'granted' then ${hubAccessEvents.id} end)::int`,
        deniedAccessCount: sql<number>`count(distinct case when ${hubAccessEvents.outcome} = 'denied' then ${hubAccessEvents.id} end)::int`,
        uniqueParticipantCount: sql<number>`count(distinct ${hubRegistrations.participantId})::int`,
        lastAccessAt: sql<Date | null>`max(${hubAccessEvents.createdAt})`,
      })
      .from(hubLives)
      .leftJoin(hubRegistrations, eq(hubRegistrations.liveId, hubLives.id))
      .leftJoin(hubAccessEvents, eq(hubAccessEvents.liveId, hubLives.id))
      .groupBy(hubLives.id)
      .orderBy(desc(hubLives.startsAt))
      .$dynamic();

    if (status) {
      query = query.where(eq(hubLives.status, status));
    }

    return await query;
  }

  async getHubDashboardSummary(): Promise<HubDashboardSummary> {
    const [totals] = await db
      .select({
        totalLives: sql<number>`(select count(*)::int from ${hubLives})`,
        totalParticipants: sql<number>`(select count(*)::int from ${hubParticipants})`,
        totalRegistrations: sql<number>`(select count(*)::int from ${hubRegistrations})`,
        grantedAccessCount: sql<number>`coalesce((select count(*)::int from ${hubAccessEvents} where ${hubAccessEvents.outcome} = 'granted'), 0)`,
        deniedAccessCount: sql<number>`coalesce((select count(*)::int from ${hubAccessEvents} where ${hubAccessEvents.outcome} = 'denied'), 0)`,
        lastAccessAt: sql<Date | null>`(select max(${hubAccessEvents.createdAt}) from ${hubAccessEvents})`,
      })
      .from(hubLives)
      .limit(1);

    const activeLive = await this.getCurrentHubLive();
    const liveSummaries = await this.listHubLiveSummaries();

    return {
      totalLives: totals?.totalLives ?? 0,
      totalParticipants: totals?.totalParticipants ?? 0,
      totalRegistrations: totals?.totalRegistrations ?? 0,
      grantedAccessCount: totals?.grantedAccessCount ?? 0,
      deniedAccessCount: totals?.deniedAccessCount ?? 0,
      lastAccessAt: totals?.lastAccessAt ?? null,
      activeLiveId: activeLive?.id ?? null,
      liveSummaries,
    };
  }

  async listHubParticipantHistory(search?: string): Promise<HubParticipantHistory[]> {
    let query = db
      .select({
        id: hubParticipants.id,
        fullName: hubParticipants.fullName,
        phoneRaw: hubParticipants.phoneRaw,
        phoneNormalized: hubParticipants.phoneNormalized,
        emailRaw: hubParticipants.emailRaw,
        emailNormalized: hubParticipants.emailNormalized,
        source: hubParticipants.source,
        ghlContactId: hubParticipants.ghlContactId,
        ghlSyncStatus: hubParticipants.ghlSyncStatus,
        ghlLastSyncedAt: hubParticipants.ghlLastSyncedAt,
        ghlSyncError: hubParticipants.ghlSyncError,
        createdAt: hubParticipants.createdAt,
        updatedAt: hubParticipants.updatedAt,
        registrationCount: sql<number>`count(distinct ${hubRegistrations.id})::int`,
        livesAccessedCount: sql<number>`count(distinct case when ${hubAccessEvents.outcome} = 'granted' then ${hubAccessEvents.liveId} end)::int`,
        grantedAccessCount: sql<number>`count(case when ${hubAccessEvents.outcome} = 'granted' then 1 end)::int`,
        deniedAccessCount: sql<number>`count(case when ${hubAccessEvents.outcome} = 'denied' then 1 end)::int`,
        lastRegisteredAt: sql<Date | null>`max(${hubRegistrations.registeredAt})`,
        lastAccessAt: sql<Date | null>`max(${hubAccessEvents.createdAt})`,
      })
      .from(hubParticipants)
      .leftJoin(hubRegistrations, eq(hubRegistrations.participantId, hubParticipants.id))
      .leftJoin(hubAccessEvents, eq(hubAccessEvents.participantId, hubParticipants.id))
      .groupBy(hubParticipants.id)
      .$dynamic();

    if (search?.trim()) {
      const likeValue = `%${search.trim()}%`;
      query = query.where(
        or(
          ilike(hubParticipants.fullName, likeValue),
          ilike(hubParticipants.phoneRaw, likeValue),
          ilike(hubParticipants.emailRaw, likeValue)
        )
      );
    }

    const rows = await query;

    rows.sort((a, b) => {
      const aAccess = a.lastAccessAt ? new Date(a.lastAccessAt).getTime() : -Infinity;
      const bAccess = b.lastAccessAt ? new Date(b.lastAccessAt).getTime() : -Infinity;
      if (aAccess !== bAccess) return bAccess - aAccess;

      const aRegistered = a.lastRegisteredAt ? new Date(a.lastRegisteredAt).getTime() : -Infinity;
      const bRegistered = b.lastRegisteredAt ? new Date(b.lastRegisteredAt).getTime() : -Infinity;
      if (aRegistered !== bRegistered) return bRegistered - aRegistered;

      return a.fullName.localeCompare(b.fullName);
    });

    const participantIds = rows.map((row) => row.id);
    const lastLiveMap = new Map<number, HubParticipantHistory["lastLive"]>();

    if (participantIds.length > 0) {
      const lastLiveRows = await db
        .select({
          participantId: hubAccessEvents.participantId,
          liveId: hubLives.id,
          slug: hubLives.slug,
          title: hubLives.title,
          startsAt: hubLives.startsAt,
          status: hubLives.status,
          createdAt: hubAccessEvents.createdAt,
        })
        .from(hubAccessEvents)
        .innerJoin(hubLives, eq(hubLives.id, hubAccessEvents.liveId))
        .where(
          and(
            inArray(hubAccessEvents.participantId, participantIds),
            eq(hubAccessEvents.outcome, "granted")
          )
        )
        .orderBy(desc(hubAccessEvents.createdAt));

      for (const row of lastLiveRows) {
        if (row.participantId == null || lastLiveMap.has(row.participantId)) {
          continue;
        }

        lastLiveMap.set(row.participantId, {
          id: row.liveId,
          slug: row.slug,
          title: row.title,
          startsAt: row.startsAt,
          status: row.status,
        });
      }
    }

    return rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      phoneRaw: row.phoneRaw,
      phoneNormalized: row.phoneNormalized,
      emailRaw: row.emailRaw,
      emailNormalized: row.emailNormalized,
      source: row.source,
      ghlContactId: row.ghlContactId,
      ghlSyncStatus: row.ghlSyncStatus,
      ghlLastSyncedAt: row.ghlLastSyncedAt,
      ghlSyncError: row.ghlSyncError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      registrationCount: row.registrationCount,
      livesAccessedCount: row.livesAccessedCount,
      grantedAccessCount: row.grantedAccessCount,
      deniedAccessCount: row.deniedAccessCount,
      lastRegisteredAt: row.lastRegisteredAt,
      lastAccessAt: row.lastAccessAt,
      lastLive: lastLiveMap.get(row.id) ?? null,
    }));
  }

  async listHubRegistrationSummaries(liveId: number): Promise<HubRegistrationSummary[]> {
    const rows = await db
      .select({
        id: hubRegistrations.id,
        liveId: hubRegistrations.liveId,
        participantId: hubRegistrations.participantId,
        status: hubRegistrations.status,
        source: hubRegistrations.source,
        notes: hubRegistrations.notes,
        registeredAt: hubRegistrations.registeredAt,
        cancelledAt: hubRegistrations.cancelledAt,
        attendedAt: hubRegistrations.attendedAt,
        lastAccessAtRegistration: hubRegistrations.lastAccessAt,
        createdAt: hubRegistrations.createdAt,
        updatedAt: hubRegistrations.updatedAt,
        participantIdValue: hubParticipants.id,
        participantFullName: hubParticipants.fullName,
        participantPhoneRaw: hubParticipants.phoneRaw,
        participantPhoneNormalized: hubParticipants.phoneNormalized,
        participantEmailRaw: hubParticipants.emailRaw,
        participantEmailNormalized: hubParticipants.emailNormalized,
        grantedAccessCount: sql<number>`count(case when ${hubAccessEvents.outcome} = 'granted' then 1 end)::int`,
        deniedAccessCount: sql<number>`count(case when ${hubAccessEvents.outcome} = 'denied' then 1 end)::int`,
        lastAccessAtEvent: sql<Date | null>`max(${hubAccessEvents.createdAt})`,
      })
      .from(hubRegistrations)
      .innerJoin(hubParticipants, eq(hubParticipants.id, hubRegistrations.participantId))
      .leftJoin(hubAccessEvents, eq(hubAccessEvents.registrationId, hubRegistrations.id))
      .where(eq(hubRegistrations.liveId, liveId))
      .groupBy(
        hubRegistrations.id,
        hubParticipants.id,
        hubParticipants.fullName,
        hubParticipants.phoneRaw,
        hubParticipants.phoneNormalized,
        hubParticipants.emailRaw,
        hubParticipants.emailNormalized
      )
      .orderBy(desc(hubRegistrations.registeredAt));

    return rows.map((row) => ({
      id: row.id,
      liveId: row.liveId,
      participantId: row.participantId,
      status: row.status,
      source: row.source,
      notes: row.notes,
      registeredAt: row.registeredAt,
      cancelledAt: row.cancelledAt,
      attendedAt: row.attendedAt,
      lastAccessAt: row.lastAccessAtEvent ?? row.lastAccessAtRegistration,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      participant: {
        id: row.participantIdValue,
        fullName: row.participantFullName,
        phoneRaw: row.participantPhoneRaw,
        phoneNormalized: row.participantPhoneNormalized,
        emailRaw: row.participantEmailRaw,
        emailNormalized: row.participantEmailNormalized,
      },
      grantedAccessCount: row.grantedAccessCount,
      deniedAccessCount: row.deniedAccessCount,
    }));
  }

  // Portfolio Services
  async getPortfolioServices(): Promise<PortfolioService[]> {
    return await db.select().from(portfolioServices).where(eq(portfolioServices.isActive, true)).orderBy(asc(portfolioServices.order));
  }

  async getPortfolioService(id: number): Promise<PortfolioService | undefined> {
    const [service] = await db.select().from(portfolioServices).where(eq(portfolioServices.id, id));
    return service;
  }

  async getPortfolioServiceBySlug(slug: string): Promise<PortfolioService | undefined> {
    const [service] = await db.select().from(portfolioServices).where(eq(portfolioServices.slug, slug));
    return service;
  }

  async createPortfolioService(service: InsertPortfolioService): Promise<PortfolioService> {
    const [newService] = await db.insert(portfolioServices).values(service).returning();
    return newService;
  }

  async updatePortfolioService(id: number, service: Partial<InsertPortfolioService>): Promise<PortfolioService> {
    const [updated] = await db.update(portfolioServices)
      .set({ ...service, updatedAt: new Date() })
      .where(eq(portfolioServices.id, id))
      .returning();
    return updated;
  }

  async deletePortfolioService(id: number): Promise<void> {
    await db.delete(portfolioServices).where(eq(portfolioServices.id, id));
  }

  // Estimates
  async listEstimates(limit?: number, offset?: number, search?: string): Promise<{ data: EstimateWithStats[]; total: number }> {
    let query = db
      .select({
        id: estimates.id,
        clientName: estimates.clientName,
        companyName: estimates.companyName,
        contactName: estimates.contactName,
        slug: estimates.slug,
        note: estimates.note,
        services: estimates.services,
        accessCode: estimates.accessCode,
        thumbnailUrl: estimates.thumbnailUrl,
        thumbnailSignature: estimates.thumbnailSignature,
        createdAt: estimates.createdAt,
        updatedAt: estimates.updatedAt,
        viewCount: sql<number>`count(${estimateViews.id})::int`,
        lastViewedAt: sql<Date | null>`max(${estimateViews.viewedAt})`,
      })
      .from(estimates)
      .leftJoin(estimateViews, eq(estimateViews.estimateId, estimates.id))
      .groupBy(estimates.id)
      .orderBy(desc(estimates.createdAt))
      .$dynamic();

    if (search) {
      const terms = search.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        const conditions = terms.map(term => {
          const likeValue = `%${term.toLowerCase()}%`;
          return or(
            ilike(estimates.clientName, likeValue),
            ilike(estimates.companyName, likeValue),
            ilike(estimates.contactName, likeValue),
            ilike(estimates.note, likeValue),
            ilike(sql`${estimates.services}::text`, likeValue)
          );
        });
        query = query.where(and(...conditions));
      }
    }

    if (limit !== undefined) query = query.limit(limit);
    if (offset !== undefined) query = query.offset(offset);

    const rows = await query;
    
    let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(estimates).$dynamic();
    if (search) {
      const terms = search.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        const conditions = terms.map(term => {
          const likeValue = `%${term.toLowerCase()}%`;
          return or(
            ilike(estimates.clientName, likeValue),
            ilike(estimates.companyName, likeValue),
            ilike(estimates.contactName, likeValue),
            ilike(estimates.note, likeValue),
            ilike(sql`${estimates.services}::text`, likeValue)
          );
        });
        countQuery = countQuery.where(and(...conditions));
      }
    }
    const [{ count }] = await countQuery;

    return { data: rows as EstimateWithStats[], total: count };
  }

  async getEstimate(id: number): Promise<Estimate | undefined> {
    const [estimate] = await db.select().from(estimates).where(eq(estimates.id, id));
    return estimate;
  }

  async getEstimateBySlug(slug: string): Promise<Estimate | undefined> {
    const [estimate] = await db.select().from(estimates).where(eq(estimates.slug, slug));
    return estimate;
  }

  async createEstimate(data: InsertEstimate): Promise<Estimate> {
    const [estimate] = await db.insert(estimates).values(data).returning();
    return estimate;
  }

  async updateEstimate(id: number, data: Partial<InsertEstimate>): Promise<Estimate> {
    const [updated] = await db.update(estimates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(estimates.id, id))
      .returning();
    return updated;
  }

  async deleteEstimate(id: number): Promise<void> {
    await db.delete(estimates).where(eq(estimates.id, id));
  }

  async recordEstimateView(estimateId: number, ipAddress?: string): Promise<void> {
    await db.insert(estimateViews).values({
      estimateId,
      ipAddress: ipAddress ?? null,
    });
  }

  // Presentations (Phase 16 implements full CRUD; Phase 15 adds typed stubs)
  async listPresentations(limit?: number, offset?: number, search?: string): Promise<{ data: PresentationWithStats[]; total: number }> {
    let query = db
      .select({
        id:                presentations.id,
        slug:              presentations.slug,
        title:             presentations.title,
        slides:            presentations.slides,
        guidelinesSnapshot: presentations.guidelinesSnapshot,
        thumbnailUrl:      presentations.thumbnailUrl,
        thumbnailSignature: presentations.thumbnailSignature,
        version:           presentations.version,
        createdAt:         presentations.createdAt,
        updatedAt:         presentations.updatedAt,
        slideCount:        sql<number>`jsonb_array_length(${presentations.slides})::int`,
        viewCount:         sql<number>`count(${presentationViews.id})::int`,
      })
      .from(presentations)
      .leftJoin(presentationViews, eq(presentationViews.presentationId, presentations.id))
      .groupBy(presentations.id)
      .orderBy(desc(presentations.createdAt))
      .$dynamic();

    if (search) {
      const terms = search.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        const conditions = terms.map(term => {
          const likeValue = `%${term.toLowerCase()}%`;
          return or(
            ilike(presentations.title, likeValue),
            ilike(presentations.slug, likeValue),
            ilike(sql`${presentations.slides}::text`, likeValue)
          );
        });
        query = query.where(and(...conditions));
      }
    }

    if (limit !== undefined) query = query.limit(limit);
    if (offset !== undefined) query = query.offset(offset);

    const rows = await query;
    
    let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(presentations).$dynamic();
    if (search) {
      const terms = search.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        const conditions = terms.map(term => {
          const likeValue = `%${term.toLowerCase()}%`;
          return or(
            ilike(presentations.title, likeValue),
            ilike(presentations.slug, likeValue),
            ilike(sql`${presentations.slides}::text`, likeValue)
          );
        });
        countQuery = countQuery.where(and(...conditions));
      }
    }
    const [{ count }] = await countQuery;

    return { data: rows as PresentationWithStats[], total: count };
  }

  async getPresentation(id: string): Promise<Presentation | undefined> {
    const [row] = await db.select().from(presentations).where(eq(presentations.id, id));
    return row;
  }

  async getPresentationBySlug(slug: string): Promise<Presentation | undefined> {
    const [row] = await db.select().from(presentations).where(eq(presentations.slug, slug));
    return row;
  }

  async createPresentation(data: InsertPresentation): Promise<Presentation> {
    const [row] = await db.insert(presentations).values(data).returning();
    return row;
  }

  async updatePresentation(id: string, data: Partial<InsertPresentation>): Promise<Presentation> {
    const [row] = await db
      .update(presentations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(presentations.id, id))
      .returning();
    return row;
  }

  async deletePresentation(id: string): Promise<void> {
    await db.delete(presentations).where(eq(presentations.id, id));
  }

  async recordPresentationView(presentationId: string, ipHash?: string): Promise<void> {
    await db.insert(presentationViews).values({
      presentationId,
      ipHash: ipHash ?? null,
    });
  }

  // Landing Pages (Phase 43)
  async listLandingPages(): Promise<LandingPage[]> {
    return db.select().from(landingPages).orderBy(desc(landingPages.createdAt));
  }

  async getLandingPage(id: string): Promise<LandingPage | undefined> {
    const [row] = await db.select().from(landingPages).where(eq(landingPages.id, id));
    return row;
  }

  async getLandingPageBySlug(slug: string): Promise<LandingPage | undefined> {
    const [row] = await db.select().from(landingPages).where(eq(landingPages.slug, slug));
    return row;
  }

  async createLandingPage(data: InsertLandingPageInput): Promise<LandingPage> {
    const [row] = await db.insert(landingPages).values(data).returning();
    return row;
  }

  async updateLandingPage(id: string, data: Partial<InsertLandingPageInput>): Promise<LandingPage> {
    const [row] = await db
      .update(landingPages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(landingPages.id, id))
      .returning();
    return row;
  }

  async deleteLandingPage(id: string): Promise<void> {
    await db.delete(landingPages).where(eq(landingPages.id, id));
  }

  // Brand Guidelines (Phase 17 implements full upsert; Phase 15 adds typed stubs)
  async getBrandGuidelines(): Promise<BrandGuidelines | undefined> {
    const [row] = await db.select().from(brandGuidelines);
    return row;
  }

  async upsertBrandGuidelines(content: string): Promise<BrandGuidelines> {
    const existing = await this.getBrandGuidelines();
    if (existing) {
      const [row] = await db
        .update(brandGuidelines)
        .set({ content, updatedAt: new Date() })
        .where(eq(brandGuidelines.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(brandGuidelines).values({ content }).returning();
    return row;
  }

  // Estimate Guidelines (Phase 49 — mirror of brandGuidelines)
  async getEstimateGuidelines(): Promise<EstimateGuidelines | undefined> {
    const [row] = await db.select().from(estimateGuidelines);
    return row;
  }

  async upsertEstimateGuidelines(content: string): Promise<EstimateGuidelines> {
    const existing = await this.getEstimateGuidelines();
    if (existing) {
      const [row] = await db
        .update(estimateGuidelines)
        .set({ content, updatedAt: new Date() })
        .where(eq(estimateGuidelines.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(estimateGuidelines).values({ content }).returning();
    return row;
  }

  // Notification Templates (NOTIF-01, NOTIF-02)
  async getNotificationTemplates(eventKey?: string): Promise<NotificationTemplate[]> {
    if (eventKey) {
      return db.select().from(notificationTemplates)
        .where(eq(notificationTemplates.eventKey, eventKey));
    }
    return db.select().from(notificationTemplates);
  }

  async upsertNotificationTemplate(
    template: InsertNotificationTemplate & { id?: number }
  ): Promise<NotificationTemplate> {
    if (template.id) {
      const [updated] = await db
        .update(notificationTemplates)
        .set({ ...template, updatedAt: new Date() })
        .where(eq(notificationTemplates.id, template.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(notificationTemplates)
      .values(template)
      .returning();
    return created;
  }

  async deleteNotificationTemplate(id: number): Promise<void> {
    await db.delete(notificationTemplates).where(eq(notificationTemplates.id, id));
  }

  // ===========================================================================
  // Marketing Attribution (Phase 45) — ported from skaleclub-websites,
  // single-tenant adapted (no tenant_id scoping anywhere).
  // ===========================================================================

  async upsertVisitorSession(session: InsertVisitorSession): Promise<VisitorSession> {
    const [row] = await db
      .insert(visitorSessions)
      .values(session)
      .onConflictDoUpdate({
        target: visitorSessions.visitorId,
        set: {
          // Last-touch (mutable on every visit)
          ltSource: sql`excluded.lt_source`,
          ltMedium: sql`excluded.lt_medium`,
          ltCampaign: sql`excluded.lt_campaign`,
          ltTerm: sql`excluded.lt_term`,
          ltContent: sql`excluded.lt_content`,
          ltId: sql`excluded.lt_id`,
          ltLandingPage: sql`excluded.lt_landing_page`,
          ltReferrer: sql`excluded.lt_referrer`,
          ltSourceChannel: sql`excluded.lt_source_channel`,
          // Metadata
          deviceType: sql`excluded.device_type`,
          lastSeenAt: sql`excluded.last_seen_at`,
          // Monotonic converted flag — once true, never false.
          converted: sql`GREATEST(visitor_sessions.converted::int, excluded.converted::int)::boolean`,
          // INTENTIONALLY OMITTED: ftSource, ftMedium, ftCampaign, ftTerm, ftContent,
          // ftId, ftLandingPage, ftReferrer, ftSourceChannel, firstSeenAt.
          // First-touch is immutable after the initial INSERT.
        },
      })
      .returning();
    return row;
  }

  async createAttributionConversion(
    conversion: InsertAttributionConversion,
  ): Promise<AttributionConversion> {
    const [row] = await db
      .insert(attributionConversions)
      .values({
        ...conversion,
        conversionType: conversion.conversionType as 'lead_created' | 'phone_click' | 'form_submitted' | 'booking_started',
      })
      .returning();
    return row;
  }

  /**
   * Stamp form_leads.visitor_id on an existing lead by looking up the visitor's
   * integer PK from the UUID. Returns the integer FK (so callers can chain into
   * createAttributionConversion without a second DB round-trip) or null when no
   * visitor_sessions row matches.
   *
   * Caller MUST wrap this in try/catch — attribution failures must NEVER block
   * the lead-create critical path.
   */
  async linkLeadToVisitor(leadId: number, visitorId: string): Promise<number | null> {
    const [session] = await db
      .select({ id: visitorSessions.id })
      .from(visitorSessions)
      .where(eq(visitorSessions.visitorId, visitorId));
    if (!session) return null;
    await db
      .update(formLeads)
      .set({ visitorId: session.id })
      .where(eq(formLeads.id, leadId));
    return session.id;
  }

  async getMarketingOverview(filters?: MarketingFilters): Promise<MarketingOverview> {
    const from = filters?.from ?? new Date(Date.now() - 30 * 86400_000);
    const to = filters?.to ?? new Date();

    const conditions = [
      gte(visitorSessions.firstSeenAt, from),
      lte(visitorSessions.firstSeenAt, to),
      ...(filters?.channel ? [eq(visitorSessions.ftSourceChannel, filters.channel)] : []),
      ...(filters?.campaign ? [eq(visitorSessions.ftCampaign, filters.campaign)] : []),
    ];

    const [visitsRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(visitorSessions)
      .where(and(...conditions));
    const totalVisits = Number(visitsRow?.count ?? 0);

    const [leadsRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(attributionConversions)
      .where(and(
        eq(attributionConversions.conversionType, 'lead_created'),
        gte(attributionConversions.convertedAt, from),
        lte(attributionConversions.convertedAt, to),
      ));
    const totalLeads = Number(leadsRow?.count ?? 0);

    const [topSourceRow] = await db
      .select({ channel: visitorSessions.ftSourceChannel, count: sql<number>`count(*)` })
      .from(visitorSessions)
      .where(and(...conditions))
      .groupBy(visitorSessions.ftSourceChannel)
      .orderBy(desc(sql`count(*)`))
      .limit(1);

    const [topCampaignRow] = await db
      .select({ campaign: visitorSessions.ftCampaign, count: sql<number>`count(*)` })
      .from(visitorSessions)
      .where(and(...conditions))
      .groupBy(visitorSessions.ftCampaign)
      .orderBy(desc(sql`count(*)`))
      .limit(1);

    const [topLandingPageRow] = await db
      .select({ page: visitorSessions.ftLandingPage, count: sql<number>`count(*)` })
      .from(visitorSessions)
      .where(and(...conditions))
      .groupBy(visitorSessions.ftLandingPage)
      .orderBy(desc(sql`count(*)`))
      .limit(1);

    const timeSeriesRows = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${visitorSessions.firstSeenAt}), 'YYYY-MM-DD')`,
        visits: sql<number>`count(distinct ${visitorSessions.id})`,
      })
      .from(visitorSessions)
      .where(and(...conditions))
      .groupBy(sql`date_trunc('day', ${visitorSessions.firstSeenAt})`)
      .orderBy(sql`date_trunc('day', ${visitorSessions.firstSeenAt})`);

    const conversionsByDay = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${attributionConversions.convertedAt}), 'YYYY-MM-DD')`,
        conversions: sql<number>`count(*)`,
      })
      .from(attributionConversions)
      .where(and(
        eq(attributionConversions.conversionType, 'lead_created'),
        gte(attributionConversions.convertedAt, from),
        lte(attributionConversions.convertedAt, to),
      ))
      .groupBy(sql`date_trunc('day', ${attributionConversions.convertedAt})`);

    const convMap = new Map(conversionsByDay.map(r => [r.date, Number(r.conversions)]));

    const timeSeries = timeSeriesRows.map(r => ({
      date: r.date,
      visits: Number(r.visits),
      conversions: convMap.get(r.date) ?? 0,
    }));

    return {
      totalVisits,
      totalLeads,
      conversionRate: totalVisits > 0 ? totalLeads / totalVisits : 0,
      topSource: topSourceRow?.channel ?? null,
      topCampaign: topCampaignRow?.campaign ?? null,
      topLandingPage: topLandingPageRow?.page ?? null,
      timeSeries,
    };
  }

  async getMarketingBySource(filters?: MarketingFilters): Promise<MarketingBySource[]> {
    const from = filters?.from ?? new Date(Date.now() - 30 * 86400_000);
    const to = filters?.to ?? new Date();

    const conditions = [
      gte(visitorSessions.firstSeenAt, from),
      lte(visitorSessions.firstSeenAt, to),
      ...(filters?.channel ? [eq(visitorSessions.ftSourceChannel, filters.channel)] : []),
      ...(filters?.campaign ? [eq(visitorSessions.ftCampaign, filters.campaign)] : []),
    ];

    // Hot/warm/cold use the destination's enum values (HOT/WARM/COLD).
    const rows = await db
      .select({
        channel: visitorSessions.ftSourceChannel,
        visits: sql<number>`count(distinct ${visitorSessions.id})`,
        leads: sql<number>`count(distinct ${formLeads.id})`,
        hotLeads: sql<number>`count(distinct ${formLeads.id}) filter (where ${formLeads.classificacao} = 'HOT')`,
        warmLeads: sql<number>`count(distinct ${formLeads.id}) filter (where ${formLeads.classificacao} = 'WARM')`,
        coldLeads: sql<number>`count(distinct ${formLeads.id}) filter (where ${formLeads.classificacao} = 'COLD')`,
      })
      .from(visitorSessions)
      .leftJoin(formLeads, eq(formLeads.visitorId, visitorSessions.id))
      .where(and(...conditions))
      .groupBy(visitorSessions.ftSourceChannel);

    return rows.map(r => ({
      channel: r.channel ?? 'Unknown',
      visits: Number(r.visits),
      leads: Number(r.leads),
      hotLeads: Number(r.hotLeads),
      warmLeads: Number(r.warmLeads),
      coldLeads: Number(r.coldLeads),
      conversionRate: Number(r.visits) > 0 ? Number(r.leads) / Number(r.visits) : 0,
    }));
  }

  async getMarketingByCampaign(filters?: MarketingFilters): Promise<MarketingByCampaign[]> {
    const from = filters?.from ?? new Date(Date.now() - 30 * 86400_000);
    const to = filters?.to ?? new Date();

    const conditions = [
      gte(visitorSessions.firstSeenAt, from),
      lte(visitorSessions.firstSeenAt, to),
      ...(filters?.channel ? [eq(visitorSessions.ftSourceChannel, filters.channel)] : []),
      ...(filters?.campaign ? [eq(visitorSessions.ftCampaign, filters.campaign)] : []),
    ];

    const rows = await db
      .select({
        campaign: visitorSessions.ftCampaign,
        source: visitorSessions.ftSource,
        channel: visitorSessions.ftSourceChannel,
        visits: sql<number>`count(distinct ${visitorSessions.id})`,
        leads: sql<number>`count(distinct ${formLeads.id})`,
        landingPages: sql<string[]>`array_agg(distinct ${visitorSessions.ftLandingPage})`,
      })
      .from(visitorSessions)
      .leftJoin(formLeads, eq(formLeads.visitorId, visitorSessions.id))
      .where(and(...conditions))
      .groupBy(visitorSessions.ftCampaign, visitorSessions.ftSource, visitorSessions.ftSourceChannel);

    return rows.map(r => {
      const allPages = (r.landingPages ?? []).filter(Boolean) as string[];
      return {
        campaign: r.campaign ?? 'Unknown',
        source: r.source ?? 'Unknown',
        channel: r.channel ?? 'Unknown',
        visits: Number(r.visits),
        leads: Number(r.leads),
        conversionRate: Number(r.visits) > 0 ? Number(r.leads) / Number(r.visits) : 0,
        topLandingPages: allPages.slice(0, 3),
      };
    });
  }

  async getMarketingConversions(filters?: MarketingFilters): Promise<Array<AttributionConversion & { visitorUuid: string | null }>> {
    const from = filters?.from ?? new Date(Date.now() - 30 * 86400_000);
    const to = filters?.to ?? new Date();

    const rows = await db
      .select({
        ...getTableColumns(attributionConversions),
        visitorUuid: visitorSessions.visitorId,
      })
      .from(attributionConversions)
      .leftJoin(visitorSessions, eq(attributionConversions.visitorId, visitorSessions.id))
      .where(and(
        gte(attributionConversions.convertedAt, from),
        lte(attributionConversions.convertedAt, to),
      ))
      .orderBy(desc(attributionConversions.convertedAt))
      .limit(500);

    return rows;
  }

  async getVisitorJourney(visitorIdUuid: string): Promise<VisitorJourney | undefined> {
    const [session] = await db
      .select()
      .from(visitorSessions)
      .where(eq(visitorSessions.visitorId, visitorIdUuid));
    if (!session) return undefined;

    const conversions = await db
      .select()
      .from(attributionConversions)
      .where(eq(attributionConversions.visitorId, session.id))
      .orderBy(asc(attributionConversions.convertedAt));

    return { session, conversions };
  }
}

export const storage = new DatabaseStorage();

