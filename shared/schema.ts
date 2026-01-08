import { pgTable, text, serial, integer, numeric, timestamp, boolean, date } from "drizzle-orm/pg-core";
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
  status: true 
}).extend({
  // Frontend sends service IDs, backend calculates totals/snapshots
  serviceIds: z.array(z.number()).min(1, "Select at least one service"),
  bookingDate: z.string(), // Provide as string YYYY-MM-DD
});

// === TYPES ===

export type Category = typeof categories.$inferSelect;
export type Subcategory = typeof subcategories.$inferSelect;
export type Service = typeof services.$inferSelect;
export type ServiceAddon = typeof serviceAddons.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingItem = typeof bookingItems.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type InsertServiceAddon = z.infer<typeof insertServiceAddonSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

// For availability checking
export interface TimeSlot {
  time: string; // HH:MM
  available: boolean;
}

export const WORKING_HOURS = {
  start: 8, // 8 AM
  end: 18,  // 6 PM
};
