import { db, pool } from "./db";
import { DEFAULT_FORM_CONFIG, calculateFormScoresWithConfig, classifyLead } from "@shared/form";
import {
  categories,
  subcategories,
  services,
  serviceAddons,
  bookings,
  bookingItems,
  formLeads,
  chatSettings,
  chatIntegrations,
  twilioSettings,
  conversations,
  conversationMessages,
  companySettings,
  faqs,
  integrationSettings,
  blogPosts,
  blogPostServices,
  knowledgeBaseCategories,
  knowledgeBaseArticles,
  knowledgeBaseAssistantLink,
  type Category,
  type Subcategory,
  type Service,
  type ServiceAddon,
  type Booking,
  type BookingItem,
  type CompanySettings,
  type ChatSettings,
  type ChatIntegrations,
  type TwilioSettings,
  type Conversation,
  type ConversationMessage,
  type FormLead,
  type FormConfig,
  type LeadStatus,
  type LeadClassification,
  type Faq,
  type IntegrationSettings,
  type BlogPost,
  type BlogPostService,
  type KnowledgeBaseCategory,
  type KnowledgeBaseArticle,
  type KnowledgeBaseAssistantLink,
  type InsertCategory,
  type InsertService,
  type InsertServiceAddon,
  type InsertBooking,
  type InsertChatSettings,
  type InsertChatIntegrations,
  type InsertTwilioSettings,
  type InsertConversation,
  type InsertConversationMessage,
  type FormLeadProgressInput,
  type InsertFaq,
  type InsertIntegrationSettings,
  type InsertBlogPost,
  type InsertKnowledgeBaseCategory,
  type InsertKnowledgeBaseArticle,
} from "@shared/schema";
import { eq, and, or, ilike, gte, lte, inArray, desc, asc, sql, ne } from "drizzle-orm";
import { z } from "zod";

// Ensure optional GHL columns exist even if migration hasn't been applied yet
let ensureGhlColumnsPromise: Promise<void> | null = null;
async function ensureFormLeadGhlColumns() {
  if (ensureGhlColumnsPromise) return ensureGhlColumnsPromise;
  ensureGhlColumnsPromise = pool
    .query(`
      ALTER TABLE form_leads ADD COLUMN IF NOT EXISTS ghl_contact_id text;
      ALTER TABLE form_leads ADD COLUMN IF NOT EXISTS ghl_sync_status text DEFAULT 'pending';
    `)
    .then(() => undefined)
    .catch((err) => {
      ensureGhlColumnsPromise = null;
      throw err;
    });
  return ensureGhlColumnsPromise;
}

// Ensure Twilio multi-recipient column exists to avoid runtime errors
let ensureTwilioColumnsPromise: Promise<void> | null = null;
async function ensureTwilioSchema() {
  if (ensureTwilioColumnsPromise) return ensureTwilioColumnsPromise;
  ensureTwilioColumnsPromise = pool
    .query(`
      ALTER TABLE twilio_settings ADD COLUMN IF NOT EXISTS to_phone_numbers jsonb DEFAULT '[]';
      UPDATE twilio_settings
      SET to_phone_numbers = CASE
        WHEN to_phone_number IS NOT NULL AND to_phone_number <> '' THEN jsonb_build_array(to_phone_number)
        ELSE '[]'::jsonb
      END
      WHERE to_phone_numbers IS NULL OR jsonb_typeof(to_phone_numbers) IS NULL;
    `)
    .then(() => undefined)
    .catch((err) => {
      ensureTwilioColumnsPromise = null;
      throw err;
    });
  return ensureTwilioColumnsPromise;
}

export const insertSubcategorySchema = z.object({
  categoryId: z.number(),
  name: z.string().min(1),
  slug: z.string().min(1),
});
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;

export interface IStorage {
  // Categories & Services
  getCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  getServices(categoryId?: number, subcategoryId?: number, includeHidden?: boolean): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  
  // Subcategories
  getSubcategories(categoryId?: number): Promise<Subcategory[]>;
  createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory>;
  updateSubcategory(id: number, subcategory: Partial<InsertSubcategory>): Promise<Subcategory>;
  deleteSubcategory(id: number): Promise<void>;
  
  // Service Addons
  getServiceAddons(serviceId: number): Promise<Service[]>;
  setServiceAddons(serviceId: number, addonServiceIds: number[]): Promise<void>;
  getAddonRelationships(): Promise<ServiceAddon[]>;
  
  // Bookings
  createBooking(booking: InsertBooking & { totalPrice: string, totalDurationMinutes: number, endTime: string }): Promise<Booking>;
  getBookings(): Promise<Booking[]>;
  getBookingsByDate(date: string): Promise<Booking[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  updateBooking(id: number, updates: Partial<{ status: string; paymentStatus: string; totalPrice: string }>): Promise<Booking>;
  deleteBooking(id: number): Promise<void>;
  getBookingItems(bookingId: number): Promise<BookingItem[]>;
  
  // Category CRUD
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;
  
  // Service CRUD
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: number): Promise<void>;
  reorderServices(order: { id: number; order: number }[]): Promise<void>;
  
  // Company Settings
  getCompanySettings(): Promise<CompanySettings>;
  updateCompanySettings(settings: Partial<CompanySettings>): Promise<CompanySettings>;
  
  // FAQs
  getFaqs(): Promise<Faq[]>;
  createFaq(faq: InsertFaq): Promise<Faq>;
  updateFaq(id: number, faq: Partial<InsertFaq>): Promise<Faq>;
  deleteFaq(id: number): Promise<void>;
  
  // Integration Settings
  getIntegrationSettings(provider: string): Promise<IntegrationSettings | undefined>;
  upsertIntegrationSettings(settings: InsertIntegrationSettings): Promise<IntegrationSettings>;
  
  // Booking GHL sync
  updateBookingGHLSync(bookingId: number, ghlContactId: string, ghlAppointmentId: string, syncStatus: string): Promise<void>;
  
  // Chat
  getChatSettings(): Promise<ChatSettings>;
  updateChatSettings(settings: Partial<InsertChatSettings>): Promise<ChatSettings>;
  getChatIntegration(provider: string): Promise<ChatIntegrations | undefined>;
  upsertChatIntegration(settings: InsertChatIntegrations): Promise<ChatIntegrations>;

  // Twilio Integration
  getTwilioSettings(): Promise<TwilioSettings | undefined>;
  saveTwilioSettings(settings: InsertTwilioSettings): Promise<TwilioSettings>;

  listConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  deleteConversation(id: string): Promise<void>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  addConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;
  
  // Leads
  upsertFormLeadProgress(progress: FormLeadProgressInput, metadata?: { userAgent?: string }, formConfig?: FormConfig): Promise<FormLead>;
  getFormLeadBySession(sessionId: string): Promise<FormLead | undefined>;
  listFormLeads(filters?: { status?: LeadStatus; classificacao?: LeadClassification; formCompleto?: boolean; search?: string }): Promise<FormLead[]>;
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
  getBlogPostServices(postId: number): Promise<Service[]>;
  setBlogPostServices(postId: number, serviceIds: number[]): Promise<void>;
  countPublishedBlogPosts(): Promise<number>;

  // Knowledge Base
  getKnowledgeBaseCategories(): Promise<KnowledgeBaseCategory[]>;
  getKnowledgeBaseCategory(id: number): Promise<KnowledgeBaseCategory | undefined>;
  createKnowledgeBaseCategory(category: InsertKnowledgeBaseCategory): Promise<KnowledgeBaseCategory>;
  updateKnowledgeBaseCategory(id: number, category: Partial<InsertKnowledgeBaseCategory>): Promise<KnowledgeBaseCategory>;
  deleteKnowledgeBaseCategory(id: number): Promise<void>;
  getKnowledgeBaseArticles(categoryId?: number): Promise<KnowledgeBaseArticle[]>;
  getKnowledgeBaseArticle(id: number): Promise<KnowledgeBaseArticle | undefined>;
  createKnowledgeBaseArticle(article: InsertKnowledgeBaseArticle): Promise<KnowledgeBaseArticle>;
  updateKnowledgeBaseArticle(id: number, article: Partial<InsertKnowledgeBaseArticle>): Promise<KnowledgeBaseArticle>;
  deleteKnowledgeBaseArticle(id: number): Promise<void>;
  toggleKnowledgeBaseCategoryAssistantLink(categoryId: number, isLinked: boolean): Promise<void>;
  getKnowledgeBaseCategoryAssistantLink(categoryId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  private chatSchemaEnsured = false;

  private async ensureChatSchema(): Promise<void> {
    if (this.chatSchemaEnsured) return;
    try {
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "agent_avatar_url" text DEFAULT ''`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "system_prompt" text DEFAULT 'You are our helpful chat assistant. Provide concise, friendly answers. Use the provided tools to fetch services, details, and availability. Do not guess prices or availability; always use tool data when relevant. If booking is requested, gather details and direct the user to the booking page at /booking.'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "intake_objectives" jsonb DEFAULT '[]'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "avg_response_time" text DEFAULT ''`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_provider" text DEFAULT 'gohighlevel'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_id" text DEFAULT ''`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "calendar_staff" jsonb DEFAULT '[]'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "language_selector_enabled" boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "default_language" text DEFAULT 'en'`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "low_performance_sms_enabled" boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "low_performance_threshold_seconds" integer DEFAULT 300`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "use_knowledge_base" boolean DEFAULT true`);
      await db.execute(sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "use_faqs" boolean DEFAULT true`);
      this.chatSchemaEnsured = true;
    } catch (err) {
      console.error("ensureChatSchema error:", err);
      this.chatSchemaEnsured = false;
    }
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.order);
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category;
  }

  async getServices(categoryId?: number, subcategoryId?: number, includeHidden: boolean = false): Promise<Service[]> {
    if (subcategoryId) {
      if (includeHidden) {
        return await db
          .select()
          .from(services)
          .where(and(eq(services.subcategoryId, subcategoryId), eq(services.isArchived, false)))
          .orderBy(asc(services.order), asc(services.id));
      }
      return await db
        .select()
        .from(services)
        .where(and(eq(services.subcategoryId, subcategoryId), eq(services.isHidden, false), eq(services.isArchived, false)))
        .orderBy(asc(services.order), asc(services.id));
    }
    if (categoryId) {
      if (includeHidden) {
        return await db
          .select()
          .from(services)
          .where(and(eq(services.categoryId, categoryId), eq(services.isArchived, false)))
          .orderBy(asc(services.order), asc(services.id));
      }
      return await db
        .select()
        .from(services)
        .where(and(eq(services.categoryId, categoryId), eq(services.isHidden, false), eq(services.isArchived, false)))
        .orderBy(asc(services.order), asc(services.id));
    }
    if (includeHidden) {
      return await db.select().from(services).where(eq(services.isArchived, false)).orderBy(asc(services.order), asc(services.id));
    }
    return await db
      .select()
      .from(services)
      .where(and(eq(services.isHidden, false), eq(services.isArchived, false)))
      .orderBy(asc(services.order), asc(services.id));
  }

  async getSubcategories(categoryId?: number): Promise<Subcategory[]> {
    if (categoryId) {
      return await db.select().from(subcategories).where(eq(subcategories.categoryId, categoryId));
    }
    return await db.select().from(subcategories);
  }

  async createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory> {
    const [newSubcategory] = await db.insert(subcategories).values(subcategory).returning();
    return newSubcategory;
  }

  async updateSubcategory(id: number, subcategory: Partial<InsertSubcategory>): Promise<Subcategory> {
    const [updated] = await db.update(subcategories).set(subcategory).where(eq(subcategories.id, id)).returning();
    return updated;
  }

  async deleteSubcategory(id: number): Promise<void> {
    await db.delete(subcategories).where(eq(subcategories.id, id));
  }

  async getServiceAddons(serviceId: number): Promise<Service[]> {
    const addonRelations = await db.select().from(serviceAddons).where(eq(serviceAddons.serviceId, serviceId));
    if (addonRelations.length === 0) return [];
    
    const addonIds = addonRelations.map(r => r.addonServiceId);
    return await db
      .select()
      .from(services)
      .where(and(inArray(services.id, addonIds), eq(services.isArchived, false)));
  }

  async setServiceAddons(serviceId: number, addonServiceIds: number[]): Promise<void> {
    await db.delete(serviceAddons).where(eq(serviceAddons.serviceId, serviceId));
    
    if (addonServiceIds.length > 0) {
      const values = addonServiceIds.map(addonId => ({
        serviceId,
        addonServiceId: addonId
      }));
      await db.insert(serviceAddons).values(values);
    }
  }

  async getAddonRelationships(): Promise<ServiceAddon[]> {
    return await db.select().from(serviceAddons);
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db
      .select()
      .from(services)
      .where(and(eq(services.id, id), eq(services.isArchived, false)));
    return service;
  }

  async createBooking(booking: InsertBooking & { totalPrice: string, totalDurationMinutes: number, endTime: string }): Promise<Booking> {
    // 1. Create Booking
    const [newBooking] = await db.insert(bookings).values({
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      customerAddress: booking.customerAddress,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalDurationMinutes: booking.totalDurationMinutes,
      totalPrice: booking.totalPrice,
      paymentMethod: booking.paymentMethod,
    }).returning();

    // 2. Create Booking Items
    for (const serviceId of booking.serviceIds) {
      const service = await this.getService(serviceId);
      if (service) {
        await db.insert(bookingItems).values({
          bookingId: newBooking.id,
          serviceId: service.id,
          serviceName: service.name,
          price: service.price,
        });
      }
    }

    return newBooking;
  }

  async getBookings(): Promise<Booking[]> {
    return await db.select().from(bookings).orderBy(bookings.bookingDate);
  }

  async getBookingsByDate(date: string): Promise<Booking[]> {
    return await db.select().from(bookings).where(eq(bookings.bookingDate, date));
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async updateBooking(id: number, updates: Partial<{ status: string; paymentStatus: string; totalPrice: string }>): Promise<Booking> {
    const [updated] = await db.update(bookings).set(updates).where(eq(bookings.id, id)).returning();
    return updated;
  }

  async deleteBooking(id: number): Promise<void> {
    // First delete booking items
    await db.delete(bookingItems).where(eq(bookingItems.bookingId, id));
    // Then delete the booking
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  async getBookingItems(bookingId: number): Promise<BookingItem[]> {
    return await db.select().from(bookingItems).where(eq(bookingItems.bookingId, bookingId));
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category> {
    const [updated] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
    return updated;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async createService(service: InsertService): Promise<Service> {
    let nextOrder = service.order;
    if (nextOrder === undefined || nextOrder === null) {
      const [{ maxOrder }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${services.order}), 0)` })
        .from(services);
      nextOrder = Number(maxOrder ?? 0) + 1;
    }
    const [newService] = await db.insert(services).values({ ...service, order: nextOrder }).returning();
    return newService;
  }

  async updateService(id: number, service: Partial<InsertService>): Promise<Service> {
    const [updated] = await db.update(services).set(service).where(eq(services.id, id)).returning();
    return updated;
  }

  async deleteService(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(serviceAddons).where(eq(serviceAddons.serviceId, id));
      await tx.delete(serviceAddons).where(eq(serviceAddons.addonServiceId, id));
      await tx.delete(blogPostServices).where(eq(blogPostServices.serviceId, id));
      await tx.update(services).set({ isArchived: true }).where(eq(services.id, id));
    });
  }

  async reorderServices(order: { id: number; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const item of order) {
        await tx.update(services).set({ order: item.order }).where(eq(services.id, item.id));
      }
    });
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const [settings] = await db.select().from(companySettings);
    if (settings) return settings;
    
    // Create default settings if none exist
    const [newSettings] = await db.insert(companySettings).values({}).returning();
    return newSettings;
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

  async updateBookingGHLSync(bookingId: number, ghlContactId: string, ghlAppointmentId: string, syncStatus: string): Promise<void> {
    await db
      .update(bookings)
      .set({ ghlContactId, ghlAppointmentId, ghlSyncStatus: syncStatus })
      .where(eq(bookings.id, bookingId));
  }

  async getChatSettings(): Promise<ChatSettings> {
    try {
      await this.ensureChatSchema();
      const [settings] = await db.select().from(chatSettings);
      if (settings) return settings;
    } catch (err) {
      console.error("getChatSettings initial read failed, retrying after ensuring schema:", err);
      this.chatSchemaEnsured = false;
      await this.ensureChatSchema();
    }

    const [created] = await db.insert(chatSettings).values({}).returning();
    return created;
  }

  async updateChatSettings(settings: Partial<InsertChatSettings>): Promise<ChatSettings> {
    try {
      await this.ensureChatSchema();
      const existing = await this.getChatSettings();
      const [updated] = await db
        .update(chatSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(chatSettings.id, existing.id))
        .returning();
      return updated;
    } catch (err) {
      console.error("updateChatSettings failed, retrying after ensuring schema:", err);
      this.chatSchemaEnsured = false;
      await this.ensureChatSchema();
      const existing = await this.getChatSettings();
      const [updated] = await db
        .update(chatSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(chatSettings.id, existing.id))
        .returning();
      return updated;
    }
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
    await ensureTwilioSchema();
    const [settings] = await db.select().from(twilioSettings).limit(1);
    return settings;
  }

  async saveTwilioSettings(settings: InsertTwilioSettings): Promise<TwilioSettings> {
    await ensureTwilioSchema();
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
  
  async getFormLeadBySession(sessionId: string): Promise<FormLead | undefined> {
    await ensureFormLeadGhlColumns();
    const [lead] = await db.select().from(formLeads).where(eq(formLeads.sessionId, sessionId));
    return lead;
  }

  async getFormLeadByEmail(email: string): Promise<FormLead | undefined> {
    await ensureFormLeadGhlColumns();
    const [lead] = await db.select().from(formLeads).where(eq(formLeads.email, email));
    return lead;
  }

  async upsertFormLeadProgress(progress: FormLeadProgressInput, metadata: { userAgent?: string } = {}, formConfig?: FormConfig): Promise<FormLead> {
    await ensureFormLeadGhlColumns();

    const existing = await this.getFormLeadBySession(progress.sessionId);
    if (!existing && !progress.nome) {
      throw new Error("Nome é obrigatório para iniciar o formulário");
    }

    const config = formConfig || (await this.getCompanySettings()).formConfig || DEFAULT_FORM_CONFIG;
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
    };

    if (!existing) {
      const startedAt = progress.startedAt ? new Date(progress.startedAt) : now;
      const safeStartedAt = isNaN(startedAt.getTime()) ? now : startedAt;
      const insertPayload: typeof formLeads.$inferInsert = {
        sessionId: progress.sessionId,
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
        createdAt: safeStartedAt,
        updatedAt: now,
      };
      try {
        const [created] = await db.insert(formLeads).values(insertPayload).returning();
        return created;
      } catch (err: any) {
        if (err?.code === "23505" && payload.email) {
          const existingByEmail = await this.getFormLeadByEmail(payload.email);
          if (existingByEmail) {
            const [updatedExisting] = await db
              .update(formLeads)
              .set({
                ...insertPayload,
                sessionId: existingByEmail.sessionId,
                updatedAt: now,
              })
              .where(eq(formLeads.id, existingByEmail.id))
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

  async listFormLeads(filters: { status?: LeadStatus; classificacao?: LeadClassification; formCompleto?: boolean; search?: string } = {}): Promise<FormLead[]> {
    await ensureFormLeadGhlColumns();
    const conditions: any[] = [];
    if (filters.status) conditions.push(eq(formLeads.status, filters.status));
    if (filters.classificacao) conditions.push(eq(formLeads.classificacao, filters.classificacao));
    if (typeof filters.formCompleto === "boolean") conditions.push(eq(formLeads.formCompleto, filters.formCompleto));
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
    await ensureFormLeadGhlColumns();
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
    await ensureFormLeadGhlColumns();
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
    const { serviceIds, ...postData } = post;
    const [newPost] = await db.insert(blogPosts).values(postData).returning();
    
    if (serviceIds && serviceIds.length > 0) {
      await this.setBlogPostServices(newPost.id, serviceIds);
    }
    
    return newPost;
  }

  async updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost> {
    const { serviceIds, ...postData } = post;
    const [updated] = await db.update(blogPosts)
      .set({ ...postData, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    
    if (serviceIds !== undefined) {
      await this.setBlogPostServices(id, serviceIds);
    }
    
    return updated;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPostServices).where(eq(blogPostServices.blogPostId, id));
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async getBlogPostServices(postId: number): Promise<Service[]> {
    const relations = await db.select().from(blogPostServices).where(eq(blogPostServices.blogPostId, postId));
    if (relations.length === 0) return [];
    
    const serviceIds = relations.map(r => r.serviceId);
    return await db.select().from(services).where(inArray(services.id, serviceIds));
  }

  async setBlogPostServices(postId: number, serviceIds: number[]): Promise<void> {
    await db.delete(blogPostServices).where(eq(blogPostServices.blogPostId, postId));
    
    if (serviceIds.length > 0) {
      const values = serviceIds.map(serviceId => ({
        blogPostId: postId,
        serviceId
      }));
      await db.insert(blogPostServices).values(values);
    }
  }

  async countPublishedBlogPosts(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(blogPosts)
      .where(eq(blogPosts.status, 'published'));
    return Number(result[0]?.count || 0);
  }

  // Knowledge Base Methods
  async getKnowledgeBaseCategories(): Promise<KnowledgeBaseCategory[]> {
    return await db.select().from(knowledgeBaseCategories).orderBy(asc(knowledgeBaseCategories.order));
  }

  async getKnowledgeBaseCategory(id: number): Promise<KnowledgeBaseCategory | undefined> {
    const [category] = await db.select().from(knowledgeBaseCategories).where(eq(knowledgeBaseCategories.id, id));
    return category;
  }

  async createKnowledgeBaseCategory(category: InsertKnowledgeBaseCategory): Promise<KnowledgeBaseCategory> {
    const [created] = await db.insert(knowledgeBaseCategories).values(category).returning();
    return created;
  }

  async updateKnowledgeBaseCategory(id: number, category: Partial<InsertKnowledgeBaseCategory>): Promise<KnowledgeBaseCategory> {
    const [updated] = await db.update(knowledgeBaseCategories)
      .set({ ...category, updatedAt: new Date() })
      .where(eq(knowledgeBaseCategories.id, id))
      .returning();
    return updated;
  }

  async deleteKnowledgeBaseCategory(id: number): Promise<void> {
    await db.delete(knowledgeBaseArticles).where(eq(knowledgeBaseArticles.categoryId, id));
    await db.delete(knowledgeBaseAssistantLink).where(eq(knowledgeBaseAssistantLink.categoryId, id));
    await db.delete(knowledgeBaseCategories).where(eq(knowledgeBaseCategories.id, id));
  }

  async getKnowledgeBaseArticles(categoryId?: number): Promise<KnowledgeBaseArticle[]> {
    if (categoryId) {
      return await db.select().from(knowledgeBaseArticles)
        .where(eq(knowledgeBaseArticles.categoryId, categoryId))
        .orderBy(asc(knowledgeBaseArticles.order));
    }
    return await db.select().from(knowledgeBaseArticles).orderBy(asc(knowledgeBaseArticles.order));
  }

  async getKnowledgeBaseArticle(id: number): Promise<KnowledgeBaseArticle | undefined> {
    const [article] = await db.select().from(knowledgeBaseArticles).where(eq(knowledgeBaseArticles.id, id));
    return article;
  }

  async createKnowledgeBaseArticle(article: InsertKnowledgeBaseArticle): Promise<KnowledgeBaseArticle> {
    const [created] = await db.insert(knowledgeBaseArticles).values(article).returning();
    return created;
  }

  async updateKnowledgeBaseArticle(id: number, article: Partial<InsertKnowledgeBaseArticle>): Promise<KnowledgeBaseArticle> {
    const [updated] = await db.update(knowledgeBaseArticles)
      .set({ ...article, updatedAt: new Date() })
      .where(eq(knowledgeBaseArticles.id, id))
      .returning();
    return updated;
  }

  async deleteKnowledgeBaseArticle(id: number): Promise<void> {
    await db.delete(knowledgeBaseArticles).where(eq(knowledgeBaseArticles.id, id));
  }

  async getLinkedKnowledgeBaseDocuments(): Promise<(KnowledgeBaseArticle & { categoryName: string })[]> {
    const linked = await db.select().from(knowledgeBaseAssistantLink)
      .where(eq(knowledgeBaseAssistantLink.isLinkedToAssistant, true));
    if (linked.length === 0) return [];

    const categoryIds = linked.map((link) => link.categoryId);
    const categories = await db.select().from(knowledgeBaseCategories)
      .where(inArray(knowledgeBaseCategories.id, categoryIds));
    const categoryNameMap = new Map(categories.map((category) => [category.id, category.name]));

    const articles = await db.select().from(knowledgeBaseArticles)
      .where(and(
        inArray(knowledgeBaseArticles.categoryId, categoryIds),
        eq(knowledgeBaseArticles.isActive, true)
      ))
      .orderBy(asc(knowledgeBaseArticles.order));

    return articles.map((article) => ({
      ...article,
      categoryName: categoryNameMap.get(article.categoryId) || 'General',
    }));
  }

  async toggleKnowledgeBaseCategoryAssistantLink(categoryId: number, isLinked: boolean): Promise<void> {
    const [existing] = await db.select().from(knowledgeBaseAssistantLink)
      .where(eq(knowledgeBaseAssistantLink.categoryId, categoryId));

    if (existing) {
      await db.update(knowledgeBaseAssistantLink)
        .set({ isLinkedToAssistant: isLinked, updatedAt: new Date() })
        .where(eq(knowledgeBaseAssistantLink.categoryId, categoryId));
    } else {
      await db.insert(knowledgeBaseAssistantLink).values({
        categoryId,
        isLinkedToAssistant: isLinked,
      });
    }
  }

  async getKnowledgeBaseCategoryAssistantLink(categoryId: number): Promise<boolean> {
    const [link] = await db.select().from(knowledgeBaseAssistantLink)
      .where(eq(knowledgeBaseAssistantLink.categoryId, categoryId));
    return link?.isLinkedToAssistant || false;
  }
}

export const storage = new DatabaseStorage();
