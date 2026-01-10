import { db } from "./db";
import {
  categories,
  subcategories,
  services,
  serviceAddons,
  bookings,
  bookingItems,
  companySettings,
  faqs,
  integrationSettings,
  blogPosts,
  blogPostServices,
  type Category,
  type Subcategory,
  type Service,
  type ServiceAddon,
      type Booking,
  type BookingItem,
  type CompanySettings,
  type Faq,
  type IntegrationSettings,
  type BlogPost,
  type BlogPostService,
  type InsertCategory,
  type InsertService,
  type InsertServiceAddon,
  type InsertBooking,
  type InsertCompanySettings,
  type InsertFaq,
  type InsertIntegrationSettings,
  type InsertBlogPost,
} from "@shared/schema";
import { eq, and, gte, lte, inArray, desc, asc, sql, ne } from "drizzle-orm";
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
  getServices(categoryId?: number, subcategoryId?: number, includeHidden?: boolean): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  
  // Subcategories
  getSubcategories(categoryId?: number): Promise<Subcategory[]>;
  createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory>;
  updateSubcategory(id: number, subcategory: Partial<InsertSubcategory>): Promise<Subcategory>;
  deleteSubcategory(id: number): Promise<void>;
  
  // Service Addons
  getServiceAddons(serviceId: number): Promise<Service[]>;
  setServiceAddons(serviceId: number, addonServiceIds: number[]): Promise<void>;
  getAddonRelationships(): Promise<ServiceAddon[]>;
  
  // Bookings
  createBooking(booking: InsertBooking & { totalPrice: string, totalDurationMinutes: number, endTime: string }): Promise<Booking>;
  getBookings(): Promise<Booking[]>;
  getBookingsByDate(date: string): Promise<Booking[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  updateBooking(id: number, updates: Partial<{ status: string; paymentStatus: string; totalPrice: string }>): Promise<Booking>;
  deleteBooking(id: number): Promise<void>;
  getBookingItems(bookingId: number): Promise<BookingItem[]>;
  
  // Category CRUD
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;
  
  // Service CRUD
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: number): Promise<void>;
  reorderServices(order: { id: number; order: number }[]): Promise<void>;
  
  // Company Settings
  getCompanySettings(): Promise<CompanySettings>;
  updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings>;
  
  // FAQs
  getFaqs(): Promise<Faq[]>;
  createFaq(faq: InsertFaq): Promise<Faq>;
  updateFaq(id: number, faq: Partial<InsertFaq>): Promise<Faq>;
  deleteFaq(id: number): Promise<void>;
  
  // Integration Settings
  getIntegrationSettings(provider: string): Promise<IntegrationSettings | undefined>;
  upsertIntegrationSettings(settings: InsertIntegrationSettings): Promise<IntegrationSettings>;
  
  // Booking GHL sync
  updateBookingGHLSync(bookingId: number, ghlContactId: string, ghlAppointmentId: string, syncStatus: string): Promise<void>;
  
  // Blog Posts
  getBlogPosts(status?: string): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getPublishedBlogPosts(limit?: number, offset?: number): Promise<BlogPost[]>;
  getRelatedBlogPosts(postId: number, limit?: number): Promise<BlogPost[]>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost>;
  deleteBlogPost(id: number): Promise<void>;
  getBlogPostServices(postId: number): Promise<Service[]>;
  setBlogPostServices(postId: number, serviceIds: number[]): Promise<void>;
  countPublishedBlogPosts(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.order);
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category;
  }

  async getServices(categoryId?: number, subcategoryId?: number, includeHidden: boolean = false): Promise<Service[]> {
    if (subcategoryId) {
      if (includeHidden) {
        return await db
          .select()
          .from(services)
          .where(eq(services.subcategoryId, subcategoryId))
          .orderBy(asc(services.order), asc(services.id));
      }
      return await db
        .select()
        .from(services)
        .where(and(eq(services.subcategoryId, subcategoryId), eq(services.isHidden, false)))
        .orderBy(asc(services.order), asc(services.id));
    }
    if (categoryId) {
      if (includeHidden) {
        return await db
          .select()
          .from(services)
          .where(eq(services.categoryId, categoryId))
          .orderBy(asc(services.order), asc(services.id));
      }
      return await db
        .select()
        .from(services)
        .where(and(eq(services.categoryId, categoryId), eq(services.isHidden, false)))
        .orderBy(asc(services.order), asc(services.id));
    }
    if (includeHidden) {
      return await db.select().from(services).orderBy(asc(services.order), asc(services.id));
    }
    return await db.select().from(services).where(eq(services.isHidden, false)).orderBy(asc(services.order), asc(services.id));
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

  async getServiceAddons(serviceId: number): Promise<Service[]> {
    const addonRelations = await db.select().from(serviceAddons).where(eq(serviceAddons.serviceId, serviceId));
    if (addonRelations.length === 0) return [];
    
    const addonIds = addonRelations.map(r => r.addonServiceId);
    return await db.select().from(services).where(inArray(services.id, addonIds));
  }

  async setServiceAddons(serviceId: number, addonServiceIds: number[]): Promise<void> {
    await db.delete(serviceAddons).where(eq(serviceAddons.serviceId, serviceId));
    
    if (addonServiceIds.length > 0) {
      const values = addonServiceIds.map(addonId => ({
        serviceId,
        addonServiceId: addonId
      }));
      await db.insert(serviceAddons).values(values);
    }
  }

  async getAddonRelationships(): Promise<ServiceAddon[]> {
    return await db.select().from(serviceAddons);
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

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async updateBooking(id: number, updates: Partial<{ status: string; paymentStatus: string; totalPrice: string }>): Promise<Booking> {
    const [updated] = await db.update(bookings).set(updates).where(eq(bookings.id, id)).returning();
    return updated;
  }

  async deleteBooking(id: number): Promise<void> {
    // First delete booking items
    await db.delete(bookingItems).where(eq(bookingItems.bookingId, id));
    // Then delete the booking
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  async getBookingItems(bookingId: number): Promise<BookingItem[]> {
    return await db.select().from(bookingItems).where(eq(bookingItems.bookingId, bookingId));
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
    let nextOrder = service.order;
    if (nextOrder === undefined || nextOrder === null) {
      const [{ maxOrder }] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${services.order}), 0)` })
        .from(services);
      nextOrder = Number(maxOrder ?? 0) + 1;
    }
    const [newService] = await db.insert(services).values({ ...service, order: nextOrder }).returning();
    return newService;
  }

  async updateService(id: number, service: Partial<InsertService>): Promise<Service> {
    const [updated] = await db.update(services).set(service).where(eq(services.id, id)).returning();
    return updated;
  }

  async deleteService(id: number): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  async reorderServices(order: { id: number; order: number }[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const item of order) {
        await tx.update(services).set({ order: item.order }).where(eq(services.id, item.id));
      }
    });
  }

  async getCompanySettings(): Promise<CompanySettings> {
    const [settings] = await db.select().from(companySettings);
    if (settings) return settings;
    
    // Create default settings if none exist
    const [newSettings] = await db.insert(companySettings).values({}).returning();
    return newSettings;
  }

  async updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings> {
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

  async updateBookingGHLSync(bookingId: number, ghlContactId: string, ghlAppointmentId: string, syncStatus: string): Promise<void> {
    await db
      .update(bookings)
      .set({ ghlContactId, ghlAppointmentId, ghlSyncStatus: syncStatus })
      .where(eq(bookings.id, bookingId));
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
    const { serviceIds, ...postData } = post;
    const [newPost] = await db.insert(blogPosts).values(postData).returning();
    
    if (serviceIds && serviceIds.length > 0) {
      await this.setBlogPostServices(newPost.id, serviceIds);
    }
    
    return newPost;
  }

  async updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost> {
    const { serviceIds, ...postData } = post;
    const [updated] = await db.update(blogPosts)
      .set({ ...postData, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    
    if (serviceIds !== undefined) {
      await this.setBlogPostServices(id, serviceIds);
    }
    
    return updated;
  }

  async deleteBlogPost(id: number): Promise<void> {
    await db.delete(blogPostServices).where(eq(blogPostServices.blogPostId, id));
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async getBlogPostServices(postId: number): Promise<Service[]> {
    const relations = await db.select().from(blogPostServices).where(eq(blogPostServices.blogPostId, postId));
    if (relations.length === 0) return [];
    
    const serviceIds = relations.map(r => r.serviceId);
    return await db.select().from(services).where(inArray(services.id, serviceIds));
  }

  async setBlogPostServices(postId: number, serviceIds: number[]): Promise<void> {
    await db.delete(blogPostServices).where(eq(blogPostServices.blogPostId, postId));
    
    if (serviceIds.length > 0) {
      const values = serviceIds.map(serviceId => ({
        blogPostId: postId,
        serviceId
      }));
      await db.insert(blogPostServices).values(values);
    }
  }

  async countPublishedBlogPosts(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(blogPosts)
      .where(eq(blogPosts.status, 'published'));
    return Number(result[0]?.count || 0);
  }
}

export const storage = new DatabaseStorage();
