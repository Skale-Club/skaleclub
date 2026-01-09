import { pgTable, text, serial, integer, numeric, timestamp, boolean, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models (required for Replit Auth)
export * from "./models/auth";

// === TABLE DEFINITIONS ===

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"), // For category card
  order: integer("order").default(0),
});

export const subcategories = pgTable("subcategories", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  subcategoryId: integer("subcategory_id").references(() => subcategories.id),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(), // Fixed price
  durationMinutes: integer("duration_minutes").notNull(), // Duration in minutes
  imageUrl: text("image_url"),
  isHidden: boolean("is_hidden").default(false), // Hidden services only appear as add-ons
});

// Service add-on relationships (e.g., Sofa can suggest Ottoman as add-on)
export const serviceAddons = pgTable("service_addons", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(), // The main service
  addonServiceId: integer("addon_service_id").references(() => services.id).notNull(), // The add-on service
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address").notNull(),
  bookingDate: date("booking_date").notNull(), // YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(), // HH:MM, calculated from duration
  totalDurationMinutes: integer("total_duration_minutes").notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // "site" or "online"
  status: text("status").notNull().default("confirmed"), // confirmed, cancelled
  createdAt: timestamp("created_at").defaultNow(),
  // GHL integration fields
  ghlAppointmentId: text("ghl_appointment_id"),
  ghlContactId: text("ghl_contact_id"),
  ghlSyncStatus: text("ghl_sync_status").default("pending"), // pending, synced, failed
});

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

export const bookingItems = pgTable("booking_items", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id).notNull(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  serviceName: text("service_name").notNull(), // Snapshot in case service changes
  price: numeric("price", { precision: 10, scale: 2 }).notNull(), // Snapshot price
});

// === SCHEMAS ===

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertSubcategorySchema = createInsertSchema(subcategories).omit({ id: true });
export const insertServiceSchema = createInsertSchema(services).omit({ id: true });
export const insertServiceAddonSchema = createInsertSchema(serviceAddons).omit({ id: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ 
  id: true, 
  createdAt: true,
  status: true,
  ghlAppointmentId: true,
  ghlContactId: true,
  ghlSyncStatus: true,
}).extend({
  // Frontend sends service IDs, backend calculates totals/snapshots
  serviceIds: z.array(z.number()).min(1, "Select at least one service"),
  bookingDate: z.string(), // Provide as string YYYY-MM-DD
});
export const insertIntegrationSettingsSchema = createInsertSchema(integrationSettings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// === TYPES ===

export type Category = typeof categories.$inferSelect;
export type Subcategory = typeof subcategories.$inferSelect;
export type Service = typeof services.$inferSelect;
export type ServiceAddon = typeof serviceAddons.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingItem = typeof bookingItems.$inferSelect;
export type IntegrationSettings = typeof integrationSettings.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type InsertServiceAddon = z.infer<typeof insertServiceAddonSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type InsertIntegrationSettings = z.infer<typeof insertIntegrationSettingsSchema>;

// For availability checking
export interface TimeSlot {
  time: string; // HH:MM
  available: boolean;
}

export const WORKING_HOURS = {
  start: 8, // 8 AM
  end: 18,  // 6 PM
};

// Company Settings (singleton table - only one row)
export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").default('Skleanings'),
  companyEmail: text("company_email").default('contact@skleanings.com'),
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
  heroTitle: text("hero_title").default('Professional Cleaning Services'),
  heroSubtitle: text("hero_subtitle").default('Book your cleaning service today and enjoy a sparkling clean home'),
  heroImageUrl: text("hero_image_url").default(''),
  ctaText: text("cta_text").default('Book Now'),
  timeFormat: text("time_format").default('12h'), // '12h' or '24h'
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({ id: true });
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
