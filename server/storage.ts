import { db } from "./db.js";
import { DEFAULT_FORM_CONFIG, calculateFormScoresWithConfig, classifyLead } from "#shared/form.js";
import { normalizeLinksPageConfig } from "#shared/links.js";
import {
  formLeads,
  forms,
  chatSettings,
  chatIntegrations,
  twilioSettings,
  conversations,
  conversationMessages,
  companySettings,
  faqs,
  integrationSettings,
  blogPosts,
  blogSettings,
  blogGenerationJobs,
  portfolioServices,
  estimates,
  estimateViews,
  presentations,
  presentationViews,
  brandGuidelines,
  salesReps,
  salesLeads,
  salesLeadLocations,
  salesLeadContacts,
  salesVisits,
  salesVisitNotes,
  salesOpportunitiesLocal,
  salesTasks,
  salesSyncEvents,
  salesAppSettings,
  type CompanySettings,
  type ChatSettings,
  type ChatIntegrations,
  type TwilioSettings,
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
  type PortfolioService,
  type SalesRep,
  type SalesLead,
  type SalesLeadLocation,
  type SalesLeadContact,
  type SalesVisit,
  type SalesVisitNote,
  type SalesOpportunity,
  type SalesTask,
  type SalesSyncEvent,
  type SalesAppSettings,
  type Estimate,
  type InsertEstimate,
  type EstimateWithStats,
  type Presentation,
  type InsertPresentation,
  type PresentationView,
  type PresentationWithStats,
  type BrandGuidelines,
  type SlideBlock,
  type InsertPortfolioService,
  type InsertChatSettings,
  type InsertChatIntegrations,
  type InsertTwilioSettings,
  type InsertConversation,
  type InsertConversationMessage,
  type FormLeadProgressInput,
  type InsertFaq,
  type InsertIntegrationSettings,
  type InsertBlogPost,
  type InsertBlogSettings,
  type InsertBlogGenerationJob,
  type InsertSalesRep,
  type InsertSalesLead,
  type InsertSalesLeadLocation,
  type InsertSalesLeadContact,
  type InsertSalesVisit,
  type InsertSalesVisitNote,
  type InsertSalesOpportunity,
  type InsertSalesTask,
  type InsertSalesSyncEvent,
  type InsertSalesAppSettings,
  type SalesRepRole,
  type SalesOpportunityStatus,
  type SalesTaskStatus,
} from "#shared/schema.js";
import { eq, and, or, ilike, gte, lt, desc, asc, sql, ne, inArray, count } from "drizzle-orm";

export type RecentSalesVisit = {
  visit: SalesVisit;
  rep: Pick<SalesRep, "id" | "displayName" | "team"> | null;
  lead: Pick<SalesLead, "id" | "name" | "industry"> | null;
  location: Pick<SalesLeadLocation, "id" | "label" | "addressLine1" | "city" | "state"> | null;
  note: Pick<SalesVisitNote, "summary" | "outcome" | "nextStep" | "sentiment"> | null;
  syncStatus: string | null;
  syncLastError: string | null;
};

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
  sql`ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "page_slugs" jsonb DEFAULT '{"thankYou":"thankyou","privacyPolicy":"privacy-policy","termsOfService":"terms-of-service","contact":"contact","faq":"faq","blog":"blog","portfolio":"portfolio","links":"links","vcard":"vcard"}'::jsonb`,
];

const chatSettingsSchemaPatches = [
  sql`ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "excluded_url_rules" jsonb DEFAULT '[]'::jsonb`,
];

const salesSchemaBootstrapStatements: Array<{ name: string; statement: ReturnType<typeof sql> }> = [
  {
    name: "sales_rep_role_enum",
    statement: sql`
    DO $$ BEGIN
      CREATE TYPE "sales_rep_role" AS ENUM ('rep', 'manager', 'admin');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  },
  {
    name: "sales_lead_status_enum",
    statement: sql`
    DO $$ BEGIN
      CREATE TYPE "sales_lead_status" AS ENUM ('lead', 'active', 'inactive', 'customer');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  },
  {
    name: "sales_visit_status_enum",
    statement: sql`
    DO $$ BEGIN
      CREATE TYPE "sales_visit_status" AS ENUM ('planned', 'in_progress', 'completed', 'cancelled', 'invalid');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  },
  {
    name: "sales_visit_validation_status_enum",
    statement: sql`
    DO $$ BEGIN
      CREATE TYPE "sales_visit_validation_status" AS ENUM ('valid', 'outside_geofence', 'gps_unavailable', 'manual_override');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  },
  {
    name: "sales_opportunity_status_enum",
    statement: sql`
    DO $$ BEGIN
      CREATE TYPE "sales_opportunity_status" AS ENUM ('open', 'won', 'lost', 'archived');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  },
  {
    name: "sales_task_status_enum",
    statement: sql`
    DO $$ BEGIN
      CREATE TYPE "sales_task_status" AS ENUM ('pending', 'completed', 'cancelled');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  },
  {
    name: "sales_sync_status_enum",
    statement: sql`
    DO $$ BEGIN
      CREATE TYPE "sales_sync_status" AS ENUM ('pending', 'synced', 'failed', 'needs_review');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  },
  {
    name: "sales_sync_direction_enum",
    statement: sql`
    DO $$ BEGIN
      CREATE TYPE "sales_sync_direction" AS ENUM ('outbound', 'inbound');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `,
  },
  {
    name: "sales_reps_table",
    statement: sql`
    CREATE TABLE IF NOT EXISTS "sales_reps" (
      "id" SERIAL PRIMARY KEY,
      "user_id" TEXT NOT NULL UNIQUE REFERENCES "users"("id"),
      "display_name" TEXT NOT NULL,
      "email" TEXT,
      "phone" TEXT,
      "team" TEXT,
      "role" "sales_rep_role" NOT NULL DEFAULT 'rep',
      "vcard_id" INTEGER REFERENCES "vcards"("id"),
      "ghl_user_id" TEXT,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP DEFAULT NOW(),
      "updated_at" TIMESTAMP DEFAULT NOW()
    );
  `,
  },
  {
    name: "sales_leads_table",
    statement: sql`
    CREATE TABLE IF NOT EXISTS "sales_leads" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "legal_name" TEXT,
      "website" TEXT,
      "phone" TEXT,
      "email" TEXT,
      "industry" TEXT,
      "source" TEXT NOT NULL DEFAULT 'manual',
      "status" "sales_lead_status" NOT NULL DEFAULT 'lead',
      "owner_rep_id" INTEGER REFERENCES "sales_reps"("id"),
      "territory_name" TEXT,
      "ghl_contact_id" TEXT,
      "ghl_company_id" TEXT,
      "last_visit_at" TIMESTAMP,
      "next_visit_due_at" TIMESTAMP,
      "notes" TEXT,
      "created_at" TIMESTAMP DEFAULT NOW(),
      "updated_at" TIMESTAMP DEFAULT NOW()
    );
  `,
  },
  {
    name: "sales_lead_locations_table",
    statement: sql`
    CREATE TABLE IF NOT EXISTS "sales_lead_locations" (
      "id" SERIAL PRIMARY KEY,
      "lead_id" INTEGER NOT NULL REFERENCES "sales_leads"("id"),
      "label" TEXT NOT NULL DEFAULT 'Main',
      "address_line_1" TEXT NOT NULL,
      "address_line_2" TEXT,
      "city" TEXT,
      "state" TEXT,
      "postal_code" TEXT,
      "country" TEXT DEFAULT 'US',
      "lat" TEXT,
      "lng" TEXT,
      "geofence_radius_meters" INTEGER NOT NULL DEFAULT 150,
      "is_primary" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP DEFAULT NOW(),
      "updated_at" TIMESTAMP DEFAULT NOW()
    );
  `,
  },
  {
    name: "sales_lead_contacts_table",
    statement: sql`
    CREATE TABLE IF NOT EXISTS "sales_lead_contacts" (
      "id" SERIAL PRIMARY KEY,
      "lead_id" INTEGER NOT NULL REFERENCES "sales_leads"("id"),
      "name" TEXT NOT NULL,
      "job_title" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "is_primary" BOOLEAN NOT NULL DEFAULT false,
      "ghl_contact_id" TEXT,
      "created_at" TIMESTAMP DEFAULT NOW(),
      "updated_at" TIMESTAMP DEFAULT NOW()
    );
  `,
  },
  {
    name: "sales_visits_table",
    statement: sql`
    CREATE TABLE IF NOT EXISTS "sales_visits" (
      "id" SERIAL PRIMARY KEY,
      "rep_id" INTEGER NOT NULL REFERENCES "sales_reps"("id"),
      "lead_id" INTEGER NOT NULL REFERENCES "sales_leads"("id"),
      "location_id" INTEGER REFERENCES "sales_lead_locations"("id"),
      "status" "sales_visit_status" NOT NULL DEFAULT 'planned',
      "scheduled_at" TIMESTAMP,
      "checked_in_at" TIMESTAMP,
      "checked_out_at" TIMESTAMP,
      "duration_seconds" INTEGER,
      "check_in_lat" TEXT,
      "check_in_lng" TEXT,
      "check_out_lat" TEXT,
      "check_out_lng" TEXT,
      "distance_from_target_meters" INTEGER,
      "gps_accuracy_meters" INTEGER,
      "validation_status" "sales_visit_validation_status" NOT NULL DEFAULT 'gps_unavailable',
      "manual_override_reason" TEXT,
      "source" TEXT NOT NULL DEFAULT 'mobile',
      "created_at" TIMESTAMP DEFAULT NOW(),
      "updated_at" TIMESTAMP DEFAULT NOW()
    );
  `,
  },
  {
    name: "sales_visit_notes_table",
    statement: sql`
    CREATE TABLE IF NOT EXISTS "sales_visit_notes" (
      "id" SERIAL PRIMARY KEY,
      "visit_id" INTEGER NOT NULL UNIQUE REFERENCES "sales_visits"("id"),
      "summary" TEXT,
      "outcome" TEXT,
      "sentiment" TEXT,
      "objections" TEXT,
      "competitor_mentioned" TEXT,
      "next_step" TEXT,
      "follow_up_required" BOOLEAN NOT NULL DEFAULT false,
      "audio_url" TEXT,
      "audio_duration_seconds" INTEGER,
      "audio_transcription" TEXT,
      "created_by_rep_id" INTEGER REFERENCES "sales_reps"("id"),
      "created_at" TIMESTAMP DEFAULT NOW(),
      "updated_at" TIMESTAMP DEFAULT NOW()
    );
  `,
  },
  {
    name: "sales_opportunities_local_table",
    statement: sql`
    CREATE TABLE IF NOT EXISTS "sales_opportunities_local" (
      "id" SERIAL PRIMARY KEY,
      "lead_id" INTEGER NOT NULL REFERENCES "sales_leads"("id"),
      "rep_id" INTEGER NOT NULL REFERENCES "sales_reps"("id"),
      "visit_id" INTEGER REFERENCES "sales_visits"("id"),
      "title" TEXT NOT NULL,
      "pipeline_key" TEXT,
      "stage_key" TEXT,
      "value" INTEGER NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "status" "sales_opportunity_status" NOT NULL DEFAULT 'open',
      "close_date" TIMESTAMP,
      "loss_reason" TEXT,
      "notes" TEXT,
      "ghl_opportunity_id" TEXT,
      "sync_status" "sales_sync_status" NOT NULL DEFAULT 'pending',
      "created_at" TIMESTAMP DEFAULT NOW(),
      "updated_at" TIMESTAMP DEFAULT NOW()
    );
  `,
  },
  {
    name: "sales_tasks_table",
    statement: sql`
    CREATE TABLE IF NOT EXISTS "sales_tasks" (
      "id" SERIAL PRIMARY KEY,
      "lead_id" INTEGER REFERENCES "sales_leads"("id"),
      "visit_id" INTEGER REFERENCES "sales_visits"("id"),
      "opportunity_id" INTEGER REFERENCES "sales_opportunities_local"("id"),
      "rep_id" INTEGER NOT NULL REFERENCES "sales_reps"("id"),
      "type" TEXT NOT NULL DEFAULT 'follow_up',
      "title" TEXT NOT NULL,
      "description" TEXT,
      "due_at" TIMESTAMP,
      "status" "sales_task_status" NOT NULL DEFAULT 'pending',
      "ghl_task_id" TEXT,
      "created_at" TIMESTAMP DEFAULT NOW(),
      "updated_at" TIMESTAMP DEFAULT NOW()
    );
  `,
  },
  {
    name: "sales_sync_events_table",
    statement: sql`
    CREATE TABLE IF NOT EXISTS "sales_sync_events" (
      "id" SERIAL PRIMARY KEY,
      "provider" TEXT NOT NULL DEFAULT 'gohighlevel',
      "entity_type" TEXT NOT NULL,
      "entity_id" TEXT NOT NULL,
      "direction" "sales_sync_direction" NOT NULL DEFAULT 'outbound',
      "status" "sales_sync_status" NOT NULL DEFAULT 'pending',
      "payload" JSONB DEFAULT '{}'::jsonb,
      "attempt_count" INTEGER NOT NULL DEFAULT 0,
      "last_error" TEXT,
      "last_attempt_at" TIMESTAMP,
      "created_at" TIMESTAMP DEFAULT NOW()
    );
  `,
  },
  {
    name: "sales_app_settings_table",
    statement: sql`
    CREATE TABLE IF NOT EXISTS "sales_app_settings" (
      "id" SERIAL PRIMARY KEY,
      "check_in_requires_gps" BOOLEAN NOT NULL DEFAULT true,
      "default_geofence_radius_meters" INTEGER NOT NULL DEFAULT 150,
      "allow_manual_override" BOOLEAN NOT NULL DEFAULT true,
      "offline_queue_enabled" BOOLEAN NOT NULL DEFAULT true,
      "default_pipeline_key" TEXT,
      "default_stage_key" TEXT,
      "default_task_template" TEXT,
      "created_at" TIMESTAMP DEFAULT NOW(),
      "updated_at" TIMESTAMP DEFAULT NOW()
    );
  `,
  },
  {
    name: "sales_reps_user_id_idx",
    statement: sql`CREATE UNIQUE INDEX IF NOT EXISTS "sales_reps_user_id_idx" ON "sales_reps" ("user_id")`,
  },
  {
    name: "sales_reps_role_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_reps_role_idx" ON "sales_reps" ("role")`,
  },
  {
    name: "sales_leads_owner_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_leads_owner_idx" ON "sales_leads" ("owner_rep_id")`,
  },
  {
    name: "sales_leads_status_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_leads_status_idx" ON "sales_leads" ("status")`,
  },
  {
    name: "sales_leads_name_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_leads_name_idx" ON "sales_leads" ("name")`,
  },
  {
    name: "sales_leads_social_urls_column",
    statement: sql`ALTER TABLE "sales_leads" ADD COLUMN IF NOT EXISTS "social_urls" jsonb DEFAULT '[]'::jsonb`,
  },
  {
    name: "sales_lead_locations_lead_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_lead_locations_lead_idx" ON "sales_lead_locations" ("lead_id")`,
  },
  {
    name: "sales_lead_contacts_lead_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_lead_contacts_lead_idx" ON "sales_lead_contacts" ("lead_id")`,
  },
  {
    name: "sales_visits_rep_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_visits_rep_idx" ON "sales_visits" ("rep_id")`,
  },
  {
    name: "sales_visits_lead_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_visits_lead_idx" ON "sales_visits" ("lead_id")`,
  },
  {
    name: "sales_visits_status_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_visits_status_idx" ON "sales_visits" ("status")`,
  },
  {
    name: "sales_visits_check_out_lat_column",
    statement: sql`ALTER TABLE "sales_visits" ADD COLUMN IF NOT EXISTS "check_out_lat" text`,
  },
  {
    name: "sales_visits_check_out_lng_column",
    statement: sql`ALTER TABLE "sales_visits" ADD COLUMN IF NOT EXISTS "check_out_lng" text`,
  },
  {
    name: "sales_visits_validation_status_column",
    statement: sql`ALTER TABLE "sales_visits" ADD COLUMN IF NOT EXISTS "validation_status" "sales_visit_validation_status" DEFAULT 'gps_unavailable'`,
  },
  {
    name: "sales_visits_manual_override_reason_column",
    statement: sql`ALTER TABLE "sales_visits" ADD COLUMN IF NOT EXISTS "manual_override_reason" text`,
  },
  {
    name: "sales_visits_source_column",
    statement: sql`ALTER TABLE "sales_visits" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'mobile'`,
  },
  {
    name: "sales_opportunities_lead_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_opportunities_lead_idx" ON "sales_opportunities_local" ("lead_id")`,
  },
  {
    name: "sales_opportunities_rep_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_opportunities_rep_idx" ON "sales_opportunities_local" ("rep_id")`,
  },
  {
    name: "sales_opportunities_status_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_opportunities_status_idx" ON "sales_opportunities_local" ("status")`,
  },
  {
    name: "sales_tasks_rep_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_tasks_rep_idx" ON "sales_tasks" ("rep_id")`,
  },
  {
    name: "sales_tasks_status_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_tasks_status_idx" ON "sales_tasks" ("status")`,
  },
  {
    name: "sales_sync_events_entity_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_sync_events_entity_idx" ON "sales_sync_events" ("entity_type", "entity_id")`,
  },
  {
    name: "sales_sync_events_status_idx",
    statement: sql`CREATE INDEX IF NOT EXISTS "sales_sync_events_status_idx" ON "sales_sync_events" ("status")`,
  },
  {
    name: "sales_visit_notes_audio_url_column",
    statement: sql`ALTER TABLE "sales_visit_notes" ADD COLUMN IF NOT EXISTS "audio_url" text`,
  },
  {
    name: "sales_visit_notes_audio_duration_seconds_column",
    statement: sql`ALTER TABLE "sales_visit_notes" ADD COLUMN IF NOT EXISTS "audio_duration_seconds" integer`,
  },
  {
    name: "sales_visit_notes_audio_transcription_column",
    statement: sql`ALTER TABLE "sales_visit_notes" ADD COLUMN IF NOT EXISTS "audio_transcription" text`,
  },
];

let companySettingsSchemaReady = false;
let chatSettingsSchemaReady = false;
let salesSchemaReady = false;
let salesSchemaReadyPromise: Promise<void> | null = null;

async function ensureCompanySettingsSchema() {
  if (companySettingsSchemaReady) {
    return;
  }

  for (const statement of companySettingsSchemaPatches) {
    await db.execute(statement);
  }

  companySettingsSchemaReady = true;
}

async function ensureChatSettingsSchema() {
  if (chatSettingsSchemaReady) {
    return;
  }

  for (const statement of chatSettingsSchemaPatches) {
    await db.execute(statement);
  }

  chatSettingsSchemaReady = true;
}

async function ensureSalesSchema() {
  if (salesSchemaReady) {
    return;
  }

  if (!salesSchemaReadyPromise) {
    salesSchemaReadyPromise = (async () => {
      try {
        for (const step of salesSchemaBootstrapStatements) {
          try {
            await db.execute(step.statement);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Xpot sales schema step "${step.name}" failed: ${message}`);
          }
        }

        salesSchemaReady = true;
      } catch (error) {
        salesSchemaReadyPromise = null;
        throw error;
      }
    })();
  }

  await salesSchemaReadyPromise;
}

export async function initializeSalesSchema() {
  try {
    await ensureSalesSchema();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to initialize Xpot sales schema: ${message}`);
  }
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

  // Xpot (Field Sales)
  getSalesAppSettings(): Promise<SalesAppSettings>;
  updateSalesAppSettings(settings: Partial<InsertSalesAppSettings>): Promise<SalesAppSettings>;
  listSalesReps(): Promise<SalesRep[]>;
  getSalesRep(id: number): Promise<SalesRep | undefined>;
  getSalesRepByUserId(userId: string): Promise<SalesRep | undefined>;
  upsertSalesRep(input: InsertSalesRep): Promise<SalesRep>;
  updateSalesRepProfile(id: number, data: { displayName?: string; phone?: string; avatarUrl?: string }): Promise<SalesRep>;
  listSalesLeads(filters?: { ownerRepId?: number; search?: string }): Promise<SalesLead[]>;
  getSalesLead(id: number): Promise<SalesLead | undefined>;
  createSalesLead(input: InsertSalesLead): Promise<SalesLead>;
  updateSalesLead(id: number, input: Partial<InsertSalesLead>): Promise<SalesLead | undefined>;
  deleteSalesLead(id: number): Promise<void>;
  listSalesLeadLocations(leadId: number): Promise<SalesLeadLocation[]>;
  listSalesLeadLocationsBatch(leadIds: number[]): Promise<SalesLeadLocation[]>;
  createSalesLeadLocation(input: InsertSalesLeadLocation): Promise<SalesLeadLocation>;
  upsertPrimaryLocation(leadId: number, data: Omit<InsertSalesLeadLocation, "leadId">): Promise<SalesLeadLocation>;
  listSalesLeadContacts(leadId: number): Promise<SalesLeadContact[]>;
  listSalesLeadContactsBatch(leadIds: number[]): Promise<SalesLeadContact[]>;
  countOpenOpportunitiesByLeadIds(leadIds: number[]): Promise<Record<number, number>>;
  createSalesLeadContact(input: InsertSalesLeadContact): Promise<SalesLeadContact>;
  listSalesVisits(filters?: { repId?: number; leadId?: number; activeOnly?: boolean }): Promise<SalesVisit[]>;
  listRecentSalesVisits(limit?: number, offset?: number, filters?: { repId?: number }): Promise<{ data: RecentSalesVisit[]; total: number }>;
  getSalesVisit(id: number): Promise<SalesVisit | undefined>;
  getActiveSalesVisitForRep(repId: number): Promise<SalesVisit | undefined>;
  createSalesVisit(input: InsertSalesVisit): Promise<SalesVisit>;
  updateSalesVisit(id: number, input: Partial<InsertSalesVisit>): Promise<SalesVisit | undefined>;
  deleteSalesVisit(id: number): Promise<void>;
  getSalesVisitNote(visitId: number): Promise<SalesVisitNote | undefined>;
  upsertSalesVisitNote(input: InsertSalesVisitNote): Promise<SalesVisitNote>;
  listSalesOpportunities(filters?: { repId?: number; leadId?: number; status?: SalesOpportunityStatus }): Promise<SalesOpportunity[]>;
  createSalesOpportunity(input: InsertSalesOpportunity): Promise<SalesOpportunity>;
  updateSalesOpportunity(id: number, input: Partial<InsertSalesOpportunity>): Promise<SalesOpportunity | undefined>;
  listSalesTasks(filters?: { repId?: number; status?: SalesTaskStatus }): Promise<SalesTask[]>;
  createSalesTask(input: InsertSalesTask): Promise<SalesTask>;
  updateSalesTask(id: number, input: Partial<InsertSalesTask>): Promise<SalesTask | undefined>;
  listSalesSyncEvents(limit?: number): Promise<SalesSyncEvent[]>;
  listSalesSyncEventsForRep(repId: number, limit?: number): Promise<SalesSyncEvent[]>;
  createSalesSyncEvent(input: InsertSalesSyncEvent): Promise<SalesSyncEvent>;
  updateSalesSyncEvent(id: number, input: Partial<InsertSalesSyncEvent>): Promise<SalesSyncEvent | undefined>;

  // Presentations (PRES-05 – PRES-08)
  listPresentations(limit?: number, offset?: number, search?: string): Promise<{ data: PresentationWithStats[], total: number }>;
  getPresentation(id: string): Promise<Presentation | undefined>;
  getPresentationBySlug(slug: string): Promise<Presentation | undefined>;
  createPresentation(data: InsertPresentation): Promise<Presentation>;
  updatePresentation(id: string, data: Partial<InsertPresentation>): Promise<Presentation>;
  deletePresentation(id: string): Promise<void>;
  recordPresentationView(presentationId: string, ipHash?: string): Promise<void>;

  // Brand Guidelines (PRES-09)
  getBrandGuidelines(): Promise<BrandGuidelines | undefined>;
  upsertBrandGuidelines(content: string): Promise<BrandGuidelines>;
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
    if (!existing && !progress.nome) {
      throw new Error("Name is required to start the form");
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

  async getSalesAppSettings(): Promise<SalesAppSettings> {
    await ensureSalesSchema();
    const [settings] = await db.select().from(salesAppSettings).limit(1);
    if (settings) return settings;
    const [created] = await db.insert(salesAppSettings).values({}).returning();
    return created;
  }

  async updateSalesAppSettings(settings: Partial<InsertSalesAppSettings>): Promise<SalesAppSettings> {
    await ensureSalesSchema();
    const existing = await this.getSalesAppSettings();
    const [updated] = await db
      .update(salesAppSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(salesAppSettings.id, existing.id))
      .returning();
    return updated;
  }

  async listSalesReps(): Promise<SalesRep[]> {
    await ensureSalesSchema();
    return await db.select().from(salesReps).orderBy(asc(salesReps.displayName));
  }

  async getSalesRep(id: number): Promise<SalesRep | undefined> {
    await ensureSalesSchema();
    const [rep] = await db.select().from(salesReps).where(eq(salesReps.id, id));
    return rep;
  }

  async getSalesRepByUserId(userId: string): Promise<SalesRep | undefined> {
    await ensureSalesSchema();
    const [rep] = await db.select().from(salesReps).where(eq(salesReps.userId, userId));
    return rep;
  }

  async upsertSalesRep(input: InsertSalesRep): Promise<SalesRep> {
    await ensureSalesSchema();
    const existing = await this.getSalesRepByUserId(input.userId);
    if (existing) {
      const [updated] = await db
        .update(salesReps)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(salesReps.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(salesReps).values(input).returning();
    return created;
  }

  async updateSalesRepProfile(id: number, data: { displayName?: string; phone?: string; avatarUrl?: string }): Promise<SalesRep> {
    await ensureSalesSchema();
    const [updated] = await db
      .update(salesReps)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(salesReps.id, id))
      .returning();
    return updated;
  }

  async listSalesLeads(filters: { ownerRepId?: number; search?: string } = {}): Promise<SalesLead[]> {
    await ensureSalesSchema();
    const conditions: any[] = [];
    if (filters.ownerRepId) conditions.push(eq(salesLeads.ownerRepId, filters.ownerRepId));
    if (filters.search) {
      const likeValue = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(salesLeads.name, likeValue),
          ilike(salesLeads.legalName, likeValue),
          ilike(salesLeads.email, likeValue),
          ilike(salesLeads.phone, likeValue),
        )
      );
    }

    if (conditions.length) {
      return await db.select().from(salesLeads).where(and(...conditions)).orderBy(desc(salesLeads.updatedAt));
    }

    return await db.select().from(salesLeads).orderBy(desc(salesLeads.updatedAt));
  }

  async getSalesLead(id: number): Promise<SalesLead | undefined> {
    await ensureSalesSchema();
    const [lead] = await db.select().from(salesLeads).where(eq(salesLeads.id, id));
    return lead;
  }

  async createSalesLead(input: InsertSalesLead): Promise<SalesLead> {
    await ensureSalesSchema();
    const [created] = await db.insert(salesLeads).values(input as any).returning();
    return created;
  }

  async updateSalesLead(id: number, input: Partial<InsertSalesLead>): Promise<SalesLead | undefined> {
    await ensureSalesSchema();
    const [updated] = await db
      .update(salesLeads)
      .set({ ...input, updatedAt: new Date() } as any)
      .where(eq(salesLeads.id, id))
      .returning();
    return updated;
  }

  async deleteSalesLead(id: number): Promise<void> {
    await ensureSalesSchema();

    await db.transaction(async (tx) => {
      const visitIds = (await tx
        .select({ id: salesVisits.id })
        .from(salesVisits)
        .where(eq(salesVisits.leadId, id)))
        .map((visit) => visit.id);

      const opportunityIds = (await tx
        .select({ id: salesOpportunitiesLocal.id })
        .from(salesOpportunitiesLocal)
        .where(eq(salesOpportunitiesLocal.leadId, id)))
        .map((opportunity) => opportunity.id);

      await tx.delete(salesTasks).where(eq(salesTasks.leadId, id));

      if (visitIds.length) {
        await tx.delete(salesTasks).where(inArray(salesTasks.visitId, visitIds));
        await tx.delete(salesVisitNotes).where(inArray(salesVisitNotes.visitId, visitIds));
      }

      if (opportunityIds.length) {
        await tx.delete(salesTasks).where(inArray(salesTasks.opportunityId, opportunityIds));
        await tx.delete(salesSyncEvents).where(
          and(
            eq(salesSyncEvents.entityType, "sales_opportunity"),
            inArray(salesSyncEvents.entityId, opportunityIds.map(String)),
          ),
        );
        await tx.delete(salesOpportunitiesLocal).where(inArray(salesOpportunitiesLocal.id, opportunityIds));
      }

      if (visitIds.length) {
        await tx.delete(salesVisits).where(inArray(salesVisits.id, visitIds));
      }

      await tx.delete(salesLeadContacts).where(eq(salesLeadContacts.leadId, id));
      await tx.delete(salesLeadLocations).where(eq(salesLeadLocations.leadId, id));
      await tx.delete(salesSyncEvents).where(
        and(
          eq(salesSyncEvents.entityType, "sales_lead"),
          eq(salesSyncEvents.entityId, String(id)),
        ),
      );
      await tx.delete(salesLeads).where(eq(salesLeads.id, id));
    });
  }

  async listSalesLeadLocations(leadId: number): Promise<SalesLeadLocation[]> {
    await ensureSalesSchema();
    return await db
      .select()
      .from(salesLeadLocations)
      .where(eq(salesLeadLocations.leadId, leadId))
      .orderBy(desc(salesLeadLocations.isPrimary), asc(salesLeadLocations.id));
  }

  async listSalesLeadLocationsBatch(leadIds: number[]): Promise<SalesLeadLocation[]> {
    if (!leadIds.length) return [];
    await ensureSalesSchema();
    return await db
      .select()
      .from(salesLeadLocations)
      .where(inArray(salesLeadLocations.leadId, leadIds))
      .orderBy(desc(salesLeadLocations.isPrimary), asc(salesLeadLocations.id));
  }

  async createSalesLeadLocation(input: InsertSalesLeadLocation): Promise<SalesLeadLocation> {
    await ensureSalesSchema();
    const [created] = await db.insert(salesLeadLocations).values(input).returning();
    return created;
  }

  async upsertPrimaryLocation(leadId: number, data: Omit<InsertSalesLeadLocation, "leadId">): Promise<SalesLeadLocation> {
    await ensureSalesSchema();
    const existing = await db
      .select()
      .from(salesLeadLocations)
      .where(and(eq(salesLeadLocations.leadId, leadId), eq(salesLeadLocations.isPrimary, true)))
      .limit(1);
    if (existing.length > 0) {
      const [updated] = await db
        .update(salesLeadLocations)
        .set({ ...data })
        .where(eq(salesLeadLocations.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(salesLeadLocations)
      .values({ ...data, leadId, isPrimary: true })
      .returning();
    return created;
  }

  async listSalesLeadContacts(leadId: number): Promise<SalesLeadContact[]> {
    await ensureSalesSchema();
    return await db
      .select()
      .from(salesLeadContacts)
      .where(eq(salesLeadContacts.leadId, leadId))
      .orderBy(desc(salesLeadContacts.isPrimary), asc(salesLeadContacts.id));
  }

  async listSalesLeadContactsBatch(leadIds: number[]): Promise<SalesLeadContact[]> {
    if (!leadIds.length) return [];
    await ensureSalesSchema();
    return await db
      .select()
      .from(salesLeadContacts)
      .where(inArray(salesLeadContacts.leadId, leadIds))
      .orderBy(desc(salesLeadContacts.isPrimary), asc(salesLeadContacts.id));
  }

  async countOpenOpportunitiesByLeadIds(leadIds: number[]): Promise<Record<number, number>> {
    if (!leadIds.length) return {};
    await ensureSalesSchema();
    const rows = await db
      .select({ leadId: salesOpportunitiesLocal.leadId, count: sql<number>`count(*)::int` })
      .from(salesOpportunitiesLocal)
      .where(and(inArray(salesOpportunitiesLocal.leadId, leadIds), eq(salesOpportunitiesLocal.status, "open")))
      .groupBy(salesOpportunitiesLocal.leadId);
    return Object.fromEntries(rows.map((r) => [r.leadId, r.count]));
  }

  async createSalesLeadContact(input: InsertSalesLeadContact): Promise<SalesLeadContact> {
    await ensureSalesSchema();
    const [created] = await db.insert(salesLeadContacts).values(input).returning();
    return created;
  }

  async listSalesVisits(filters: { repId?: number; leadId?: number; activeOnly?: boolean } = {}): Promise<SalesVisit[]> {
    await ensureSalesSchema();
    const conditions: any[] = [];
    if (filters.repId) conditions.push(eq(salesVisits.repId, filters.repId));
    if (filters.leadId) conditions.push(eq(salesVisits.leadId, filters.leadId));
    if (filters.activeOnly) conditions.push(eq(salesVisits.status, "in_progress"));

    if (conditions.length) {
      return await db.select().from(salesVisits).where(and(...conditions)).orderBy(desc(salesVisits.createdAt));
    }

    return await db.select().from(salesVisits).orderBy(desc(salesVisits.createdAt));
  }

  async listRecentSalesVisits(limit = 5, offset = 0, filters: { repId?: number } = {}): Promise<{ data: RecentSalesVisit[]; total: number }> {
    await ensureSalesSchema();

    const conditions: any[] = [];
    if (filters.repId) conditions.push(eq(salesVisits.repId, filters.repId));

    let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(salesVisits).$dynamic();
    let visitsQuery = db
      .select({
        visit: salesVisits,
        rep: {
          id: salesReps.id,
          displayName: salesReps.displayName,
          team: salesReps.team,
        },
        lead: {
          id: salesLeads.id,
          name: salesLeads.name,
          industry: salesLeads.industry,
        },
        location: {
          id: salesLeadLocations.id,
          label: salesLeadLocations.label,
          addressLine1: salesLeadLocations.addressLine1,
          city: salesLeadLocations.city,
          state: salesLeadLocations.state,
        },
        note: {
          summary: salesVisitNotes.summary,
          outcome: salesVisitNotes.outcome,
          nextStep: salesVisitNotes.nextStep,
          sentiment: salesVisitNotes.sentiment,
        },
      })
      .from(salesVisits)
      .leftJoin(salesReps, eq(salesVisits.repId, salesReps.id))
      .leftJoin(salesLeads, eq(salesVisits.leadId, salesLeads.id))
      .leftJoin(salesLeadLocations, eq(salesVisits.locationId, salesLeadLocations.id))
      .leftJoin(salesVisitNotes, eq(salesVisits.id, salesVisitNotes.visitId))
      .orderBy(desc(sql`coalesce(${salesVisits.checkedOutAt}, ${salesVisits.checkedInAt}, ${salesVisits.createdAt})`), desc(salesVisits.id))
      .$dynamic();

    if (conditions.length) {
      const whereClause = and(...conditions);
      countQuery = countQuery.where(whereClause);
      visitsQuery = visitsQuery.where(whereClause);
    }

    const [totalRow] = await countQuery;
    const rows = await visitsQuery.limit(limit).offset(offset);

    const visitIds = rows.map((row) => String(row.visit.id));
    const syncRows = visitIds.length
      ? await db
        .select()
        .from(salesSyncEvents)
        .where(and(eq(salesSyncEvents.entityType, "sales_visit"), inArray(salesSyncEvents.entityId, visitIds)))
        .orderBy(desc(salesSyncEvents.createdAt), desc(salesSyncEvents.id))
      : [];
    const latestSyncByVisit = new Map<string, SalesSyncEvent>();
    for (const event of syncRows) {
      if (!latestSyncByVisit.has(event.entityId)) {
        latestSyncByVisit.set(event.entityId, event);
      }
    }

    return {
      data: rows.map((row) => {
        const syncEvent = latestSyncByVisit.get(String(row.visit.id));
        return {
          visit: row.visit,
          rep: row.rep?.id ? row.rep : null,
          lead: row.lead?.id ? row.lead : null,
          location: row.location?.id ? row.location : null,
          note: row.note?.summary || row.note?.outcome || row.note?.nextStep || row.note?.sentiment ? row.note : null,
          syncStatus: syncEvent?.status ?? null,
          syncLastError: syncEvent?.lastError ?? null,
        };
      }),
      total: totalRow?.count ?? 0,
    };
  }

  async getSalesVisit(id: number): Promise<SalesVisit | undefined> {
    await ensureSalesSchema();
    const [visit] = await db.select().from(salesVisits).where(eq(salesVisits.id, id));
    return visit;
  }

  async getActiveSalesVisitForRep(repId: number): Promise<SalesVisit | undefined> {
    await ensureSalesSchema();
    const [visit] = await db
      .select()
      .from(salesVisits)
      .where(and(eq(salesVisits.repId, repId), eq(salesVisits.status, "in_progress")))
      .orderBy(desc(salesVisits.checkedInAt))
      .limit(1);
    return visit;
  }

  async createSalesVisit(input: InsertSalesVisit): Promise<SalesVisit> {
    await ensureSalesSchema();
    const [created] = await db.insert(salesVisits).values(input).returning();
    return created;
  }

  async updateSalesVisit(id: number, input: Partial<InsertSalesVisit>): Promise<SalesVisit | undefined> {
    await ensureSalesSchema();
    const [updated] = await db
      .update(salesVisits)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(salesVisits.id, id))
      .returning();
    return updated;
  }

  async deleteSalesVisit(id: number): Promise<void> {
    await ensureSalesSchema();
    await db.delete(salesVisitNotes).where(eq(salesVisitNotes.visitId, id));
    await db.delete(salesVisits).where(eq(salesVisits.id, id));
  }

  async getSalesVisitNote(visitId: number): Promise<SalesVisitNote | undefined> {
    await ensureSalesSchema();
    const [note] = await db.select().from(salesVisitNotes).where(eq(salesVisitNotes.visitId, visitId));
    return note;
  }

  async upsertSalesVisitNote(input: InsertSalesVisitNote): Promise<SalesVisitNote> {
    await ensureSalesSchema();
    const existing = await this.getSalesVisitNote(input.visitId);
    if (existing) {
      const [updated] = await db
        .update(salesVisitNotes)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(salesVisitNotes.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(salesVisitNotes).values(input).returning();
    return created;
  }

  async listSalesOpportunities(filters: { repId?: number; leadId?: number; status?: SalesOpportunityStatus } = {}): Promise<SalesOpportunity[]> {
    await ensureSalesSchema();
    const conditions: any[] = [];
    if (filters.repId) conditions.push(eq(salesOpportunitiesLocal.repId, filters.repId));
    if (filters.leadId) conditions.push(eq(salesOpportunitiesLocal.leadId, filters.leadId));
    if (filters.status) conditions.push(eq(salesOpportunitiesLocal.status, filters.status));

    if (conditions.length) {
      return await db.select().from(salesOpportunitiesLocal).where(and(...conditions)).orderBy(desc(salesOpportunitiesLocal.updatedAt));
    }

    return await db.select().from(salesOpportunitiesLocal).orderBy(desc(salesOpportunitiesLocal.updatedAt));
  }

  async createSalesOpportunity(input: InsertSalesOpportunity): Promise<SalesOpportunity> {
    await ensureSalesSchema();
    const [created] = await db.insert(salesOpportunitiesLocal).values(input).returning();
    return created;
  }

  async updateSalesOpportunity(id: number, input: Partial<InsertSalesOpportunity>): Promise<SalesOpportunity | undefined> {
    await ensureSalesSchema();
    const [updated] = await db
      .update(salesOpportunitiesLocal)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(salesOpportunitiesLocal.id, id))
      .returning();
    return updated;
  }

  async listSalesTasks(filters: { repId?: number; status?: SalesTaskStatus } = {}): Promise<SalesTask[]> {
    await ensureSalesSchema();
    const conditions: any[] = [];
    if (filters.repId) conditions.push(eq(salesTasks.repId, filters.repId));
    if (filters.status) conditions.push(eq(salesTasks.status, filters.status));

    if (conditions.length) {
      return await db.select().from(salesTasks).where(and(...conditions)).orderBy(asc(salesTasks.dueAt), desc(salesTasks.createdAt));
    }

    return await db.select().from(salesTasks).orderBy(asc(salesTasks.dueAt), desc(salesTasks.createdAt));
  }

  async createSalesTask(input: InsertSalesTask): Promise<SalesTask> {
    await ensureSalesSchema();
    const [created] = await db.insert(salesTasks).values(input).returning();
    return created;
  }

  async updateSalesTask(id: number, input: Partial<InsertSalesTask>): Promise<SalesTask | undefined> {
    await ensureSalesSchema();
    const [updated] = await db
      .update(salesTasks)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(salesTasks.id, id))
      .returning();
    return updated;
  }

  async listSalesSyncEvents(limit = 50): Promise<SalesSyncEvent[]> {
    await ensureSalesSchema();
    return await db.select().from(salesSyncEvents).orderBy(desc(salesSyncEvents.createdAt)).limit(limit);
  }

  async listSalesSyncEventsForRep(repId: number, limit = 20): Promise<SalesSyncEvent[]> {
    await ensureSalesSchema();
    const [repVisits, repLeads] = await Promise.all([
      db.select({ id: salesVisits.id }).from(salesVisits).where(eq(salesVisits.repId, repId)),
      db.select({ id: salesLeads.id }).from(salesLeads).where(eq(salesLeads.ownerRepId, repId)),
    ]);
    const visitIds = repVisits.map((v) => String(v.id));
    const leadIds = repLeads.map((l) => String(l.id));
    if (visitIds.length === 0 && leadIds.length === 0) return [];
    const conditions = [];
    if (visitIds.length > 0) {
      conditions.push(and(eq(salesSyncEvents.entityType, "sales_visit"), inArray(salesSyncEvents.entityId, visitIds)));
    }
    if (leadIds.length > 0) {
      conditions.push(and(eq(salesSyncEvents.entityType, "sales_lead"), inArray(salesSyncEvents.entityId, leadIds)));
    }
    return await db.select().from(salesSyncEvents)
      .where(or(...conditions))
      .orderBy(desc(salesSyncEvents.createdAt))
      .limit(limit);
  }

  async createSalesSyncEvent(input: InsertSalesSyncEvent): Promise<SalesSyncEvent> {
    await ensureSalesSchema();
    const [created] = await db.insert(salesSyncEvents).values(input).returning();
    return created;
  }

  async updateSalesSyncEvent(id: number, input: Partial<InsertSalesSyncEvent>): Promise<SalesSyncEvent | undefined> {
    await ensureSalesSchema();
    const [updated] = await db
      .update(salesSyncEvents)
      .set(input)
      .where(eq(salesSyncEvents.id, id))
      .returning();
    return updated;
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
}

export const storage = new DatabaseStorage();

