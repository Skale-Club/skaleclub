import { db } from "./db";
import {
  categories,
  services,
  bookings,
  bookingItems,
  type Category,
  type Service,
  type Booking,
  type InsertCategory,
  type InsertService,
  type InsertBooking,
} from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Categories & Services
  getCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  getServices(categoryId?: number): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  
  // Bookings
  createBooking(booking: InsertBooking & { totalPrice: string, totalDurationMinutes: number, endTime: string }): Promise<Booking>;
  getBookings(): Promise<Booking[]>;
  getBookingsByDate(date: string): Promise<Booking[]>;
  
  // Seeding
  createCategory(category: InsertCategory): Promise<Category>;
  createService(service: InsertService): Promise<Service>;
}

export class DatabaseStorage implements IStorage {
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category;
  }

  async getServices(categoryId?: number): Promise<Service[]> {
    if (categoryId) {
      return await db.select().from(services).where(eq(services.categoryId, categoryId));
    }
    return await db.select().from(services);
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

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }
}

export const storage = new DatabaseStorage();
