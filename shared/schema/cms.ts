import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// Portfolio Services table
export const portfolioServices = pgTable("portfolio_services", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  description: text("description").notNull(),
  price: text("price").notNull(),
  priceLabel: text("price_label").notNull().default("One-time"),
  badgeText: text("badge_text").notNull().default("One-time Fee"),
  features: jsonb("features").$type<string[]>().default([]),
  imageUrl: text("image_url"),
  iconName: text("icon_name").default("Rocket"),
  ctaText: text("cta_text").notNull(),
  ctaButtonColor: text("cta_button_color").default("#406EF1"),
  backgroundColor: text("background_color").default("bg-white"),
  textColor: text("text_color").default("text-slate-900"),
  accentColor: text("accent_color").default("blue"),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortfolioServiceSchema = createInsertSchema(portfolioServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  features: z.array(z.string()).nullable().optional(),
});

export type PortfolioService = typeof portfolioServices.$inferSelect;
export type InsertPortfolioService = z.infer<typeof insertPortfolioServiceSchema>;

// VCards table (Digital Business Cards)
export const vcards = pgTable("vcards", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  title: text("title"),
  organization: text("organization"),
  cellPhone: text("cell_phone"),
  email: text("email"),
  url: text("url"),
  bio: text("bio"),
  couponCode: text("coupon_code"),
  couponAmount: text("coupon_amount"),
  avatarUrl: text("avatar_url"),
  socialLinks: jsonb("social_links").$type<{ platform: string; url: string }[]>().default([]),
  isActive: boolean("is_active").default(true),
  viewCount: integer("view_count").default(0),
  downloadCount: integer("download_count").default(0),
  lastViewedAt: timestamp("last_viewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVCardSchema = createInsertSchema(vcards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  socialLinks: z.array(z.object({
    platform: z.string(),
    url: z.string()
  })).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export type VCard = typeof vcards.$inferSelect;
export type InsertVCard = z.infer<typeof insertVCardSchema>;
