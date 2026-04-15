import { pgTable, text, serial, integer, timestamp, boolean, jsonb, uuid, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
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

// Forms table — supports multiple independent lead capture forms
export const forms = pgTable("forms", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  slugIdx: uniqueIndex("forms_slug_idx").on(table.slug),
  isDefaultIdx: index("forms_is_default_idx").on(table.isDefault),
  isActiveIdx: index("forms_is_active_idx").on(table.isActive),
}));

// Form Leads table
export const formLeads = pgTable("form_leads", {
  id: serial("id").primaryKey(),
  sessionId: uuid("session_id").notNull(),
  formId: integer("form_id").references(() => forms.id),
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
  source: text("source").default("form"),
  conversationId: text("conversation_id"),
}, (table) => ({
  emailIdx: index("form_leads_email_idx").on(table.email),
  classificacaoIdx: index("form_leads_classificacao_idx").on(table.classificacao),
  createdAtIdx: index("form_leads_created_at_idx").on(table.createdAt),
  statusIdx: index("form_leads_status_idx").on(table.status),
  sessionIdx: uniqueIndex("form_leads_session_idx").on(table.sessionId),
  sourceIdx: index("form_leads_source_idx").on(table.source),
  conversationIdx: index("form_leads_conversation_idx").on(table.conversationId),
  formIdIdx: index("form_leads_form_id_idx").on(table.formId),
}));

// Insert schema
export const insertFormLeadSchema = z.object({
  sessionId: z.string().uuid(),
  formId: z.number().int().positive().optional(),
  nome: z.string().min(1),
  email: z.string().email().nullable().optional(),
  telefone: z.string().nullable().optional(),
  cidadeEstado: z.string().nullable().optional(),
  tipoNegocio: z.string().nullable().optional(),
  tipoNegocioOutro: z.string().nullable().optional(),
  tempoNegocio: z.string().nullable().optional(),
  experienciaMarketing: z.string().nullable().optional(),
  orcamentoAnuncios: z.string().nullable().optional(),
  principalDesafio: z.string().nullable().optional(),
  disponibilidade: z.string().nullable().optional(),
  expectativaResultado: z.string().nullable().optional(),
  scoreTotal: z.number().int().default(0),
  classificacao: z.enum(leadClassificationEnum.enumValues as [string, ...string[]]).nullable().optional(),
  scoreTipoNegocio: z.number().int().default(0),
  scoreTempoNegocio: z.number().int().default(0),
  scoreExperiencia: z.number().int().default(0),
  scoreOrcamento: z.number().int().default(0),
  scoreDesafio: z.number().int().default(0),
  scoreDisponibilidade: z.number().int().default(0),
  scoreExpectativa: z.number().int().default(0),
  tempoTotalSegundos: z.number().int().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  urlOrigem: z.string().nullable().optional(),
  utmSource: z.string().nullable().optional(),
  utmMedium: z.string().nullable().optional(),
  utmCampaign: z.string().nullable().optional(),
  status: z.enum(leadStatusEnum.enumValues as [string, ...string[]]).default("novo"),
  formCompleto: z.boolean().default(false),
  ultimaPerguntaRespondida: z.number().int().default(0),
  notificacaoEnviada: z.boolean().default(false),
  dataContato: z.union([z.string(), z.date(), z.null()]).optional(),
  observacoes: z.string().nullable().optional(),
  customAnswers: z.record(z.string()).default({}),
  ghlContactId: z.string().nullable().optional(),
  ghlSyncStatus: z.string().default("pending"),
  source: z.string().default("form"),
  conversationId: z.string().nullable().optional(),
});

// Lead enum values for Zod schema
const leadClassificationValues = leadClassificationEnum.enumValues as [string, ...string[]];
const leadStatusValues = leadStatusEnum.enumValues as [string, ...string[]];

// Form lead progress schema (manual Zod schema for progressive form submission)
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

// Types
export type FormLead = typeof formLeads.$inferSelect;
export type InsertFormLead = typeof formLeads.$inferInsert;
export type LeadClassification = typeof leadClassificationEnum.enumValues[number];
export type LeadStatus = typeof leadStatusEnum.enumValues[number];
export type FormLeadProgressInput = z.infer<typeof formLeadProgressSchema>;

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
  ghlFieldId?: string;
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

// Forms row types (from the forms table defined above)
export type Form = typeof forms.$inferSelect;
export type InsertForm = typeof forms.$inferInsert;

// Zod schema for creating/updating a form from the admin UI
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const insertFormSchema = z.object({
  slug: z.string().min(1).max(80).regex(slugPattern, {
    message: "Slug must be lowercase kebab-case (letters, digits, hyphens)",
  }),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  config: z.custom<FormConfig>(),
});

export const updateFormSchema = insertFormSchema.partial().extend({
  // Allow all fields to be omitted in PATCH, but keep slug valid when present
  slug: z.string().min(1).max(80).regex(slugPattern).optional(),
});

export type InsertFormInput = z.infer<typeof insertFormSchema>;
export type UpdateFormInput = z.infer<typeof updateFormSchema>;
