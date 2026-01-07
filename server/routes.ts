import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas, buildUrl } from "@shared/routes";
import { z } from "zod";
import { WORKING_HOURS, insertCategorySchema, insertServiceSchema } from "@shared/schema";
import { insertSubcategorySchema } from "./storage";
import bcrypt from "bcrypt";

// Admin credentials from environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';

// Extend session type to include admin flag
declare module 'express-session' {
  interface SessionData {
    isAdmin: boolean;
    adminEmail: string;
  }
}

// Admin authentication middleware - session based
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.isAdmin) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Admin Login schema
  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
  });

  // Admin Login
  app.post('/api/admin/login', async (req, res) => {
    // Validate request body
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid email or password format' });
    }

    const { email, password } = parsed.data;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) {
      return res.status(500).json({ message: 'Admin credentials not configured' });
    }

    if (email !== ADMIN_EMAIL) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Compare password using bcrypt
    const passwordMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Set session
    req.session.isAdmin = true;
    req.session.adminEmail = email;
    
    res.json({ success: true, email });
  });

  // Admin Logout
  app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to logout' });
      }
      res.json({ success: true });
    });
  });

  // Check admin session status
  app.get('/api/admin/session', (req, res) => {
    if (req.session?.isAdmin) {
      res.json({ isAdmin: true, email: req.session.adminEmail });
    } else {
      res.json({ isAdmin: false });
    }
  });

  // Categories
  app.get(api.categories.list.path, async (req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
  });

  app.get(api.categories.get.path, async (req, res) => {
    const category = await storage.getCategoryBySlug(req.params.slug);
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  });

  // Admin Category CRUD (protected routes)
  app.post('/api/categories', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put('/api/categories/:id', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(Number(req.params.id), validatedData);
      res.json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete('/api/categories/:id', requireAdmin, async (req, res) => {
    try {
      await storage.deleteCategory(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Subcategories
  app.get('/api/subcategories', async (req, res) => {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const subcategories = await storage.getSubcategories(categoryId);
    res.json(subcategories);
  });

  app.post('/api/subcategories', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertSubcategorySchema.parse(req.body);
      const subcategory = await storage.createSubcategory(validatedData);
      res.status(201).json(subcategory);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put('/api/subcategories/:id', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertSubcategorySchema.partial().parse(req.body);
      const subcategory = await storage.updateSubcategory(Number(req.params.id), validatedData);
      res.json(subcategory);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete('/api/subcategories/:id', requireAdmin, async (req, res) => {
    try {
      await storage.deleteSubcategory(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Services
  app.get(api.services.list.path, async (req, res) => {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const subcategoryId = req.query.subcategoryId ? Number(req.query.subcategoryId) : undefined;
    const services = await storage.getServices(categoryId, subcategoryId);
    res.json(services);
  });

  // Admin Service CRUD (protected routes)
  app.post('/api/services', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(validatedData);
      res.status(201).json(service);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put('/api/services/:id', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertServiceSchema.partial().parse(req.body);
      const service = await storage.updateService(Number(req.params.id), validatedData);
      res.json(service);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete('/api/services/:id', requireAdmin, async (req, res) => {
    try {
      await storage.deleteService(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Bookings
  app.get(api.bookings.list.path, async (req, res) => {
    const bookings = await storage.getBookings();
    res.json(bookings);
  });

  app.post(api.bookings.create.path, async (req, res) => {
    try {
      const input = api.bookings.create.input.parse(req.body);

      // 1. Calculate totals
      let totalPrice = 0;
      let totalDuration = 0;
      
      for (const serviceId of input.serviceIds) {
        const service = await storage.getService(serviceId);
        if (!service) {
           return res.status(400).json({ message: `Service ID ${serviceId} not found` });
        }
        totalPrice += Number(service.price);
        totalDuration += service.durationMinutes;
      }

      // 2. Calculate End Time
      const [startHour, startMinute] = input.startTime.split(':').map(Number);
      const startDate = new Date(`2000-01-01T${input.startTime}:00`);
      startDate.setMinutes(startDate.getMinutes() + totalDuration);
      
      const endHour = startDate.getHours().toString().padStart(2, '0');
      const endMinute = startDate.getMinutes().toString().padStart(2, '0');
      const endTime = `${endHour}:${endMinute}`;

      // 3. Check for Conflicts (Double check)
      const existingBookings = await storage.getBookingsByDate(input.bookingDate);
      const hasConflict = existingBookings.some(b => {
        // Simple overlap check: (StartA < EndB) and (EndA > StartB)
        return input.startTime < b.endTime && endTime > b.startTime;
      });

      if (hasConflict) {
        return res.status(409).json({ message: "Time slot is no longer available." });
      }

      const booking = await storage.createBooking({
        ...input,
        totalPrice: totalPrice.toFixed(2),
        totalDurationMinutes: totalDuration,
        endTime
      });

      res.status(201).json(booking);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Availability Logic
  app.get(api.availability.check.path, async (req, res) => {
    const date = req.query.date as string;
    const totalDurationMinutes = Number(req.query.totalDurationMinutes);

    if (!date || isNaN(totalDurationMinutes)) {
      return res.status(400).json({ message: "Missing date or duration" });
    }

    const existingBookings = await storage.getBookingsByDate(date);
    const slots = [];

    // Generate slots every 30 minutes
    // Start from WORKING_HOURS.start to WORKING_HOURS.end
    for (let h = WORKING_HOURS.start; h < WORKING_HOURS.end; h++) {
      for (let m = 0; m < 60; m += 30) {
        const startHour = h.toString().padStart(2, '0');
        const startMinute = m.toString().padStart(2, '0');
        const startTime = `${startHour}:${startMinute}`;

        // Calculate proposed end time
        const slotDate = new Date(`2000-01-01T${startTime}:00`);
        slotDate.setMinutes(slotDate.getMinutes() + totalDurationMinutes);
        
        // Check if ends after working hours
        if (slotDate.getHours() > WORKING_HOURS.end || (slotDate.getHours() === WORKING_HOURS.end && slotDate.getMinutes() > 0)) {
             continue; // Exceeds working hours
        }
        
        const endHour = slotDate.getHours().toString().padStart(2, '0');
        const endMinute = slotDate.getMinutes().toString().padStart(2, '0');
        const endTime = `${endHour}:${endMinute}`;

        // Check conflicts
        const isAvailable = !existingBookings.some(b => {
           return startTime < b.endTime && endTime > b.startTime;
        });

        slots.push({ time: startTime, available: isAvailable });
      }
    }

    res.json(slots);
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingCategories = await storage.getCategories();
  if (existingCategories.length > 0) return;

  const upholstery = await storage.createCategory({
    name: "Upholstery Cleaning",
    slug: "upholstery-cleaning",
    description: "Deep cleaning for your sofas, mattresses, and chairs.",
    imageUrl: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800&auto=format&fit=crop"
  });

  const carpet = await storage.createCategory({
    name: "Carpet & Rug Cleaning",
    slug: "carpet-cleaning",
    description: "Revitalize your home with our carpet cleaning services.",
    imageUrl: "https://images.unsplash.com/photo-1527513192501-1e9671d18f5d?w=800&auto=format&fit=crop"
  });

  await storage.createService({
    categoryId: upholstery.id,
    name: "3-Seater Sofa Cleaning",
    description: "Deep clean for a standard 3-seater sofa.",
    price: "120.00",
    durationMinutes: 120, // 2 hours
    imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop"
  });

  await storage.createService({
    categoryId: upholstery.id,
    name: "Mattress Cleaning (Queen)",
    description: "Hygienic steam clean for a Queen size mattress.",
    price: "80.00",
    durationMinutes: 60,
    imageUrl: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&auto=format&fit=crop"
  });

  await storage.createService({
    categoryId: carpet.id,
    name: "Room Carpet Cleaning (up to 20sqm)",
    description: "Standard room carpet cleaning.",
    price: "50.00",
    durationMinutes: 45,
    imageUrl: "https://images.unsplash.com/photo-1562663474-6cbb3eaa4d14?w=800&auto=format&fit=crop"
  });
}
