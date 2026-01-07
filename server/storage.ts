import { db } from "./db";
import {
  categories,
  subcategories,
  services,
  bookings,
  bookingItems,
  type Category,
  type Subcategory,
  type Service,
  type Booking,
  type InsertCategory,
  type InsertService,
  type InsertBooking,
} from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";

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
  getServices(categoryId?: number, subcategoryId?: number): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  
  // Subcategories
  getSubcategories(categoryId?: number): Promise<Subcategory[]>;
  createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory>;
  updateSubcategory(id: number, subcategory: Partial<InsertSubcategory>): Promise<Subcategory>;
  deleteSubcategory(id: number): Promise<void>;
  
  // Bookings
  createBooking(booking: InsertBooking & { totalPrice: string, totalDurationMinutes: number, endTime: string }): Promise<Booking>;
  getBookings(): Promise<Booking[]>;
  getBookingsByDate(date: string): Promise<Booking[]>;
  
  // Category CRUD
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;
  
  // Service CRUD
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category;
  }

  async getServices(categoryId?: number, subcategoryId?: number): Promise<Service[]> {
    if (subcategoryId) {
      return await db.select().from(services).where(eq(services.subcategoryId, subcategoryId));
    }
    if (categoryId) {
      return await db.select().from(services).where(eq(services.categoryId, categoryId));
    }
    return await db.select().from(services);
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

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
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
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: number, service: Partial<InsertService>): Promise<Service> {
    const [updated] = await db.update(services).set(service).where(eq(services.id, id)).returning();
    return updated;
  }

  async deleteService(id: number): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }
}

export const storage = new DatabaseStorage();
