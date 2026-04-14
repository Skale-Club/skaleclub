import { pgTable, text, serial, integer, timestamp, boolean, jsonb, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// Conversations
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

// Conversation Messages
export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").primaryKey(),
  conversationId: uuid("conversation_id").references(() => conversations.id).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"),
}, (table) => ({
  conversationIdIdx: index("conversation_messages_conversation_idx").on(table.conversationId),
  conversationCreatedAtIdx: index("conversation_messages_conversation_created_idx").on(table.conversationId, table.createdAt),
}));

// Insert schemas
export const insertChatSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  agentName: z.string().default("Company Assistant"),
  agentAvatarUrl: z.string().default(""),
  systemPrompt: z.string().default(
    "You are our helpful chat assistant. Provide concise, friendly answers. Use the provided tools to fetch services and details. Do not guess prices; always use tool data when relevant."
  ),
  welcomeMessage: z.string().default("Hi! How can I help you today?"),
  avgResponseTime: z.string().default(""),
  calendarProvider: z.string().default("gohighlevel"),
  calendarId: z.string().default(""),
  calendarStaff: z.any().default([]),
  languageSelectorEnabled: z.boolean().default(false),
  defaultLanguage: z.string().default("en"),
  lowPerformanceSmsEnabled: z.boolean().default(false),
  lowPerformanceThresholdSeconds: z.number().int().default(300),
  intakeObjectives: z.any().default([]),
  excludedUrlRules: z.any().default([]),
  useFaqs: z.boolean().default(true),
  activeAiProvider: z.string().default("openai"),
});

export const insertChatIntegrationsSchema = z.object({
  provider: z.string().default("openai"),
  enabled: z.boolean().default(false),
  model: z.string().default("gpt-4o-mini"),
  apiKey: z.string().nullable().optional(),
});

export const insertConversationSchema = z.object({
  id: z.string().uuid(),
  status: z.string().default("open"),
  firstPageUrl: z.string().nullable().optional(),
  visitorName: z.string().nullable().optional(),
  visitorPhone: z.string().nullable().optional(),
  visitorEmail: z.string().nullable().optional(),
});

export const insertConversationMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: z.string(),
  content: z.string(),
  metadata: z.any().nullable().optional(),
});

// Types
export type ChatSettings = typeof chatSettings.$inferSelect;
export type ChatIntegrations = typeof chatIntegrations.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertChatSettings = typeof chatSettings.$inferInsert;
export type InsertChatIntegrations = typeof chatIntegrations.$inferInsert;
export type InsertConversation = typeof conversations.$inferInsert;
export type InsertConversationMessage = typeof conversationMessages.$inferInsert;
