import { pgTable, text, serial, integer, timestamp, boolean, date, jsonb, uuid, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Auth models (inlined for drizzle-kit compatibility)
export const sessions = pgTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const systemHeartbeats = pgTable("system_heartbeats", {
  id: serial("id").primaryKey(),
  source: text("source").notNull().default("vercel-cron"),
  note: text("note").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSystemHeartbeatSchema = createInsertSchema(systemHeartbeats).omit({
  id: true,
  createdAt: true,
});
export type SystemHeartbeat = typeof systemHeartbeats.$inferSelect;
export type InsertSystemHeartbeat = z.infer<typeof insertSystemHeartbeatSchema>;

// Translations Table (AI-powered dynamic translations)
export const translations = pgTable("translations", {
  id: serial("id").primaryKey(),
  sourceText: text("source_text").notNull(),
  sourceLanguage: text("source_language").notNull().default("en"),
  targetLanguage: text("target_language").notNull(),
  translatedText: text("translated_text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTranslationSchema = createInsertSchema(translations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Translation = typeof translations.$inferSelect;
export type InsertTranslation = z.infer<typeof insertTranslationSchema>;

// === TABLE DEFINITIONS ===

// GoHighLevel Integration Settings
export const integrationSettings = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("gohighlevel"), // gohighlevel, etc.
  apiKey: text("api_key"), // Encrypted API key
  locationId: text("location_id"),
  calendarId: text("calendar_id").default("2irhr47AR6K0AQkFqEQl"),
  isEnabled: boolean("is_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat Settings (singleton table - only one row)
export const chatSettings = pgTable("chat_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false),
  agentName: text("agent_name").default("Company Assistant"),
  agentAvatarUrl: text("agent_avatar_url").default(""),
  systemPrompt: text("system_prompt").default(
    "You are our helpful chat assistant. Provide concise, friendly answers. Use the provided tools to fetch services and details. Do not guess prices; always use tool data when relevant."
  ),
  welcomeMessage: text("welcome_message").default("Hi! How can I help you today?"),
  avgResponseTime: text("avg_response_time").default(""),
  calendarProvider: text("calendar_provider").default("gohighlevel"),
  calendarId: text("calendar_id").default(""),
  calendarStaff: jsonb("calendar_staff").default([]),
  languageSelectorEnabled: boolean("language_selector_enabled").default(false),
  defaultLanguage: text("default_language").default("en"),
  lowPerformanceSmsEnabled: boolean("low_performance_sms_enabled").default(false),
  lowPerformanceThresholdSeconds: integer("low_performance_threshold_seconds").default(300),
  intakeObjectives: jsonb("intake_objectives").default([]),
  excludedUrlRules: jsonb("excluded_url_rules").default([]),
  useFaqs: boolean("use_faqs").default(true),
  activeAiProvider: text("active_ai_provider").default("openai"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat Integrations (OpenAI)
export const chatIntegrations = pgTable("chat_integrations", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("openai"),
  enabled: boolean("enabled").default(false),
  model: text("model").default("gpt-4o-mini"),
  apiKey: text("api_key"),
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

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastMessageAt: timestamp("last_message_at"),
  firstPageUrl: text("first_page_url"),
  visitorName: text("visitor_name"),
  visitorPhone: text("visitor_phone"),
  visitorEmail: text("visitor_email"),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"),
});

export const leadClassificationEnum = pgEnum("lead_classificacao", [
  "QUENTE",
  "MORNO",
  "FRIO",
  "DESQUALIFICADO",
]);

export const leadStatusEnum = pgEnum("lead_status", [
  "novo",
  "contatado",
  "qualificado",
  "convertido",
  "descartado",
]);

export const formLeads = pgTable("form_leads", {
  id: serial("id").primaryKey(),
  sessionId: uuid("session_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  nome: text("nome").notNull(),
  email: text("email"),
  telefone: text("telefone"),
  cidadeEstado: text("cidade_estado"),
  tipoNegocio: text("tipo_negocio"),
  tipoNegocioOutro: text("tipo_negocio_outro"),
  tempoNegocio: text("tempo_negocio"),
  experienciaMarketing: text("experiencia_marketing"),
  orcamentoAnuncios: text("orcamento_anuncios"),
  principalDesafio: text("principal_desafio"),
  disponibilidade: text("disponibilidade"),
  expectativaResultado: text("expectativa_resultado"),
  scoreTotal: integer("score_total").notNull().default(0),
  classificacao: leadClassificationEnum("classificacao"),
  scoreTipoNegocio: integer("score_tipo_negocio").notNull().default(0),
  scoreTempoNegocio: integer("score_tempo_negocio").notNull().default(0),
  scoreExperiencia: integer("score_experiencia").notNull().default(0),
  scoreOrcamento: integer("score_orcamento").notNull().default(0),
  scoreDesafio: integer("score_desafio").notNull().default(0),
  scoreDisponibilidade: integer("score_disponibilidade").notNull().default(0),
  scoreExpectativa: integer("score_expectativa").notNull().default(0),
  tempoTotalSegundos: integer("tempo_total_segundos"),
  userAgent: text("user_agent"),
  urlOrigem: text("url_origem"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  status: leadStatusEnum("status").notNull().default("novo"),
  formCompleto: boolean("form_completo").notNull().default(false),
  ultimaPerguntaRespondida: integer("ultima_pergunta_respondida").notNull().default(0),
  notificacaoEnviada: boolean("notificacao_enviada").notNull().default(false),
  dataContato: timestamp("data_contato"),
  observacoes: text("observacoes"),
  customAnswers: jsonb("custom_answers").$type<Record<string, string>>().default({}),
  ghlContactId: text("ghl_contact_id"),
  ghlSyncStatus: text("ghl_sync_status").default("pending"),
  // Source tracking: 'form' or 'chat'
  source: text("source").default("form"),
  // Link to conversation for chat-originated leads
  conversationId: text("conversation_id"),
}, (table) => ({
  emailIdx: index("form_leads_email_idx").on(table.email),
  classificacaoIdx: index("form_leads_classificacao_idx").on(table.classificacao),
  createdAtIdx: index("form_leads_created_at_idx").on(table.createdAt),
  statusIdx: index("form_leads_status_idx").on(table.status),
  sessionIdx: uniqueIndex("form_leads_session_idx").on(table.sessionId),
  sourceIdx: index("form_leads_source_idx").on(table.source),
  conversationIdx: index("form_leads_conversation_idx").on(table.conversationId),
}));

// === SCHEMAS ===

export const insertIntegrationSettingsSchema = createInsertSchema(integrationSettings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const insertChatSettingsSchema = createInsertSchema(chatSettings).omit({
  id: true,
  updatedAt: true,
});
export const insertChatIntegrationsSchema = createInsertSchema(chatIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertTwilioSettingsSchema = createInsertSchema(twilioSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertConversationSchema = createInsertSchema(conversations).omit({
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
});
export const insertConversationMessageSchema = createInsertSchema(conversationMessages).omit({
  createdAt: true,
});
export const insertFormLeadSchema = createInsertSchema(formLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  formCompleto: true,
  ultimaPerguntaRespondida: true,
  notificacaoEnviada: true,
  dataContato: true,
  ghlContactId: true,
  ghlSyncStatus: true,
});

const leadClassificationValues = leadClassificationEnum.enumValues as [string, ...string[]];
const leadStatusValues = leadStatusEnum.enumValues as [string, ...string[]];

export const formLeadProgressSchema = z.object({
  sessionId: z.string().uuid(),
  questionNumber: z.number().int().min(1).max(50),
  nome: z.string().min(3).max(100).optional(),
  email: z.string().max(255).optional().refine(
    (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    { message: 'Invalid email' }
  ),
  telefone: z.string().min(7).max(20).optional(),
  cidadeEstado: z.string().min(3).max(100).optional(),
  tipoNegocio: z.string().max(120).optional(),
  tipoNegocioOutro: z.string().max(160).optional(),
  tempoNegocio: z.string().max(120).optional(),
  experienciaMarketing: z.string().max(160).optional(),
  orcamentoAnuncios: z.string().max(120).optional(),
  principalDesafio: z.string().max(160).optional(),
  disponibilidade: z.string().max(120).optional(),
  expectativaResultado: z.string().max(120).optional(),
  scoreTotal: z.number().int().min(0).max(78).optional(),
  scoreTipoNegocio: z.number().int().min(0).max(10).optional(),
  scoreTempoNegocio: z.number().int().min(0).max(10).optional(),
  scoreExperiencia: z.number().int().min(0).max(10).optional(),
  scoreOrcamento: z.number().int().min(0).max(10).optional(),
  scoreDesafio: z.number().int().min(0).max(10).optional(),
  scoreDisponibilidade: z.number().int().min(0).max(10).optional(),
  scoreExpectativa: z.number().int().min(0).max(10).optional(),
  classificacao: z.enum(leadClassificationValues).optional(),
  formCompleto: z.boolean().optional(),
  tempoTotalSegundos: z.number().int().min(0).optional(),
  urlOrigem: z.string().max(500).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  startedAt: z.string().optional(),
  customAnswers: z.record(z.string()).optional(),
});

// === TYPES ===

export type IntegrationSettings = typeof integrationSettings.$inferSelect;
export type ChatSettings = typeof chatSettings.$inferSelect;
export type ChatIntegrations = typeof chatIntegrations.$inferSelect;
export type TwilioSettings = typeof twilioSettings.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type FormLead = typeof formLeads.$inferSelect;
export type LeadClassification = typeof leadClassificationEnum.enumValues[number];
export type LeadStatus = typeof leadStatusEnum.enumValues[number];

export type InsertIntegrationSettings = z.infer<typeof insertIntegrationSettingsSchema>;
export type InsertChatSettings = z.infer<typeof insertChatSettingsSchema>;
export type InsertChatIntegrations = z.infer<typeof insertChatIntegrationsSchema>;
export type InsertTwilioSettings = z.infer<typeof insertTwilioSettingsSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;
export type InsertFormLead = z.infer<typeof insertFormLeadSchema>;
export type FormLeadProgressInput = z.infer<typeof formLeadProgressSchema>;

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
  // Labels for customization
  tagLabel?: string;
  stepLabel?: string;
  whatWeDoLabel?: string;
  outcomeLabel?: string;
  practicalBlockSubtitle?: string;
  nextStepLabel?: string;
  nextStepText?: string;
}

// Unified horizontal scroll section - supports both process steps and service cards
export interface HorizontalScrollCard {
  order: number;
  numberLabel: string;
  icon?: string;
  title: string;
  // For process/steps type
  whatWeDo?: string;
  outcome?: string;
  // For services type
  description?: string;
  features?: string[];
}

export interface HorizontalScrollSection {
  enabled?: boolean;
  sectionId?: string;
  mode?: 'steps' | 'services'; // Type of cards to display
  // Header
  tagLabel?: string;
  title?: string;
  subtitle?: string;
  // Cards
  cards?: HorizontalScrollCard[];
  // Labels (for steps mode)
  stepLabel?: string;
  whatWeDoLabel?: string;
  outcomeLabel?: string;
  // Practical block
  practicalBlockTitle?: string;
  practicalBlockSubtitle?: string;
  practicalBullets?: string[];
  // CTA
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
  // Main horizontal scroll section (replaces both servicesSection and consultingStepsSection)
  horizontalScrollSection?: HorizontalScrollSection;
  // Keep for backwards compatibility during migration
  consultingStepsSection?: ConsultingStepsSection;
}

// Form Configuration Types
export type FormQuestionType = 'text' | 'email' | 'tel' | 'select';

export interface FormOption {
  value: string;
  label: string;
  points: number;
}

export interface FormConditionalField {
  showWhen: string;
  id: string;
  title: string;
  placeholder: string;
}

export interface FormQuestion {
  id: string;
  order: number;
  title: string;
  type: FormQuestionType;
  required: boolean;
  placeholder?: string;
  options?: FormOption[];
  conditionalField?: FormConditionalField;
  ghlFieldId?: string; // ID do custom field no GHL para sincronização
}

export interface FormConfig {
  questions: FormQuestion[];
  maxScore: number;
  thresholds: {
    hot: number;
    warm: number;
    cold: number;
  };
}

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
  timeFormat: text("time_format").default('12h'), // '12h' or '24h'
  businessHours: jsonb("business_hours"), // Day-by-day business hours
  seoTitle: text("seo_title").default('Company Name - Professional Services'),
  seoDescription: text("seo_description").default('Professional marketing services for homes and businesses.'),
  ogImage: text("og_image").default(''),
  // Extended SEO fields
  seoKeywords: text("seo_keywords").default(''),
  seoAuthor: text("seo_author").default(''),
  seoCanonicalUrl: text("seo_canonical_url").default(''),
  seoRobotsTag: text("seo_robots_tag").default('index, follow'),
  // Open Graph extended
  ogType: text("og_type").default('website'),
  ogSiteName: text("og_site_name").default(''),
  // Twitter Cards
  twitterCard: text("twitter_card").default('summary_large_image'),
  twitterSite: text("twitter_site").default(''),
  twitterCreator: text("twitter_creator").default(''),
  // Schema.org LocalBusiness
  schemaLocalBusiness: jsonb("schema_local_business").default({}),
  // Marketing Analytics
  gtmContainerId: text("gtm_container_id").default(''), // GTM-XXXXXXX
  ga4MeasurementId: text("ga4_measurement_id").default(''), // G-XXXXXXXXXX
  facebookPixelId: text("facebook_pixel_id").default(''), // Numeric ID
  gtmEnabled: boolean("gtm_enabled").default(false),
  ga4Enabled: boolean("ga4_enabled").default(false),
  facebookPixelEnabled: boolean("facebook_pixel_enabled").default(false),
  homepageContent: jsonb("homepage_content").$type<HomepageContent>().default({}),
  formConfig: jsonb("form_config").$type<FormConfig>(),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings, {
  homepageContent: z.custom<HomepageContent>().optional().nullable(),
  formConfig: z.custom<FormConfig>().optional().nullable(),
}).omit({ id: true });
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

// FAQ table
export const faqs = pgTable("faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  order: integer("order").default(0),
});

export const insertFaqSchema = createInsertSchema(faqs).omit({ id: true });
export type Faq = typeof faqs.$inferSelect;
export type InsertFaq = z.infer<typeof insertFaqSchema>;

// Blog Posts table
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  metaDescription: text("meta_description"),
  focusKeyword: text("focus_keyword"),
  tags: text("tags"),
  featureImageUrl: text("feature_image_url"),
  status: text("status").notNull().default("draft"),
  authorName: text("author_name").default("Admin"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  publishedAt: z.union([z.string(), z.date(), z.null()]).optional().transform(val => {
    if (!val) return null;
    if (val instanceof Date) return val;
    return new Date(val);
  }),
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
