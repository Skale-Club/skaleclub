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
export const insertChatSettingsSchema = createInsertSchema(chatSettings).omit({
  id: true,
  updatedAt: true,
});
export const insertChatIntegrationsSchema = createInsertSchema(chatIntegrations).omit({
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

// Types
export type ChatSettings = typeof chatSettings.$inferSelect;
export type ChatIntegrations = typeof chatIntegrations.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertChatSettings = z.infer<typeof insertChatSettingsSchema>;
export type InsertChatIntegrations = z.infer<typeof insertChatIntegrationsSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;
