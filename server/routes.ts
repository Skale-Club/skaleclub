import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas, buildUrl } from "@shared/routes";
import { z } from "zod";
import { WORKING_HOURS, insertCategorySchema, insertServiceSchema, insertCompanySettingsSchema, insertFaqSchema, insertIntegrationSettingsSchema } from "@shared/schema";
import { insertSubcategorySchema } from "./storage";
import { ObjectStorageService, registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { authStorage } from "./replit_integrations/auth/storage";
import { testGHLConnection, getGHLFreeSlots, getOrCreateGHLContact, createGHLAppointment } from "./integrations/ghl";

// Admin authentication middleware - uses Replit Auth + isAdmin check
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (!req.isAuthenticated || !req.isAuthenticated() || !user?.claims?.sub) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  try {
    const dbUser = await authStorage.getUser(user.claims.sub);
    if (!dbUser?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify admin status' });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Check admin session status - uses Replit Auth
  app.get('/api/admin/session', async (req, res) => {
    const user = (req as any).user;
    
    if (!req.isAuthenticated || !req.isAuthenticated() || !user?.claims?.sub) {
      return res.json({ isAdmin: false });
    }
    
    try {
      const dbUser = await authStorage.getUser(user.claims.sub);
      res.json({ 
        isAdmin: dbUser?.isAdmin || false, 
        email: dbUser?.email || null,
        firstName: dbUser?.firstName || null,
        lastName: dbUser?.lastName || null
      });
    } catch (error) {
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

  app.put('/api/categories/reorder', requireAdmin, async (req, res) => {
    try {
      const orderData = z.array(z.object({
        id: z.number(),
        order: z.number()
      })).parse(req.body.order);

      for (const item of orderData) {
        await storage.updateCategory(item.id, { order: item.order });
      }

      res.json({ success: true });
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
    const includeHidden = req.query.includeHidden === 'true';
    const services = await storage.getServices(categoryId, subcategoryId, includeHidden);
    res.json(services);
  });

  // Service Addons
  app.get('/api/services/:id/addons', async (req, res) => {
    const addons = await storage.getServiceAddons(Number(req.params.id));
    res.json(addons);
  });

  app.put('/api/services/:id/addons', requireAdmin, async (req, res) => {
    try {
      const addonIds = z.array(z.number()).parse(req.body.addonIds);
      await storage.setServiceAddons(Number(req.params.id), addonIds);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid addon IDs' });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.get('/api/service-addons', requireAdmin, async (req, res) => {
    const relationships = await storage.getAddonRelationships();
    res.json(relationships);
  });

  const objectStorageService = new ObjectStorageService();

  app.post("/api/upload", requireAdmin, async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Register object storage routes
  registerObjectStorageRoutes(app);

  // Company Settings (public GET, admin PUT)
  app.get('/api/company-settings', async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/company-settings', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCompanySettingsSchema.partial().parse(req.body);
      const settings = await storage.updateCompanySettings(validatedData);
      res.json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
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

      // Try to sync with GoHighLevel (non-blocking)
      try {
        const ghlSettings = await storage.getIntegrationSettings('gohighlevel');
        if (ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.locationId && ghlSettings.calendarId) {
          // Build service summary
          const serviceNames: string[] = [];
          for (const serviceId of input.serviceIds) {
            const service = await storage.getService(serviceId);
            if (service) serviceNames.push(service.name);
          }
          const serviceSummary = serviceNames.join(', ');
          
          const nameParts = input.customerName.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          // Create/find contact in GHL
          const contactResult = await getOrCreateGHLContact(
            ghlSettings.apiKey,
            ghlSettings.locationId,
            {
              email: input.customerEmail,
              firstName,
              lastName,
              phone: input.customerPhone,
              address: input.customerAddress
            }
          );
          
          if (contactResult.success && contactResult.contactId) {
            // Create appointment in GHL
            const startDateTime = new Date(`${input.bookingDate}T${input.startTime}:00`);
            const endDateTime = new Date(`${input.bookingDate}T${endTime}:00`);
            
            const appointmentResult = await createGHLAppointment(
              ghlSettings.apiKey,
              ghlSettings.calendarId,
              {
                contactId: contactResult.contactId,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                title: `Cleaning: ${serviceSummary}`,
                address: input.customerAddress
              }
            );
            
            // Update booking with GHL sync status
            if (appointmentResult.success && appointmentResult.appointmentId) {
              await storage.updateBookingGHLSync(
                booking.id,
                contactResult.contactId,
                appointmentResult.appointmentId,
                'synced'
              );
            } else {
              await storage.updateBookingGHLSync(booking.id, contactResult.contactId, '', 'failed');
              console.log('GHL appointment sync failed:', appointmentResult.message);
            }
          } else {
            await storage.updateBookingGHLSync(booking.id, '', '', 'failed');
            console.log('GHL contact sync failed:', contactResult.message);
          }
        }
      } catch (ghlError) {
        console.log('GHL sync error (non-blocking):', ghlError);
        // Don't fail the booking if GHL sync fails
      }

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

    // Check if the selected date is today (in EST/America/New_York timezone)
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = estNow.toISOString().split('T')[0];
    const isToday = date === todayStr;
    const currentHour = estNow.getHours();
    const currentMinute = estNow.getMinutes();

    // Generate slots every 30 minutes
    // Start from WORKING_HOURS.start to WORKING_HOURS.end
    for (let h = WORKING_HOURS.start; h < WORKING_HOURS.end; h++) {
      for (let m = 0; m < 60; m += 30) {
        const startHour = h.toString().padStart(2, '0');
        const startMinute = m.toString().padStart(2, '0');
        const startTime = `${startHour}:${startMinute}`;

        // Skip past slots if today
        if (isToday) {
          if (h < currentHour || (h === currentHour && m <= currentMinute)) {
            continue; // This slot is in the past
          }
        }

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

  // ===============================
  // GoHighLevel Integration Routes
  // ===============================

  // Get GHL settings
  app.get('/api/integrations/ghl', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings('gohighlevel');
      if (!settings) {
        return res.json({ 
          provider: 'gohighlevel',
          apiKey: '',
          locationId: '',
          calendarId: '2irhr47AR6K0AQkFqEQl',
          isEnabled: false
        });
      }
      res.json({
        ...settings,
        apiKey: settings.apiKey ? '********' : ''
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Save GHL settings
  app.put('/api/integrations/ghl', requireAdmin, async (req, res) => {
    try {
      const { apiKey, locationId, calendarId, isEnabled } = req.body;
      
      const existingSettings = await storage.getIntegrationSettings('gohighlevel');
      
      const settingsToSave: any = {
        provider: 'gohighlevel',
        locationId,
        calendarId: calendarId || '2irhr47AR6K0AQkFqEQl',
        isEnabled: isEnabled ?? false
      };
      
      if (apiKey && apiKey !== '********') {
        settingsToSave.apiKey = apiKey;
      } else if (existingSettings?.apiKey) {
        settingsToSave.apiKey = existingSettings.apiKey;
      }
      
      const settings = await storage.upsertIntegrationSettings(settingsToSave);
      res.json({
        ...settings,
        apiKey: settings.apiKey ? '********' : ''
      });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Test GHL connection
  app.post('/api/integrations/ghl/test', requireAdmin, async (req, res) => {
    try {
      const { apiKey, locationId } = req.body;
      
      let keyToTest = apiKey;
      if (apiKey === '********' || !apiKey) {
        const existingSettings = await storage.getIntegrationSettings('gohighlevel');
        keyToTest = existingSettings?.apiKey;
      }
      
      if (!keyToTest || !locationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'API key and Location ID are required' 
        });
      }
      
      const result = await testGHLConnection(keyToTest, locationId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ 
        success: false, 
        message: (err as Error).message 
      });
    }
  });

  // Get GHL free slots (public - needed for booking flow)
  app.get('/api/integrations/ghl/free-slots', async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings('gohighlevel');
      
      if (!settings?.isEnabled || !settings.apiKey || !settings.calendarId) {
        return res.json({ enabled: false, slots: {} });
      }
      
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const timezone = (req.query.timezone as string) || 'America/New_York';
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date range' });
      }
      
      const result = await getGHLFreeSlots(
        settings.apiKey,
        settings.calendarId,
        startDate,
        endDate,
        timezone
      );
      
      res.json({ 
        enabled: true, 
        ...result 
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Check if GHL is enabled (public - for frontend to know whether to use GHL)
  app.get('/api/integrations/ghl/status', async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings('gohighlevel');
      res.json({ 
        enabled: settings?.isEnabled || false,
        hasCalendar: !!settings?.calendarId
      });
    } catch (err) {
      res.json({ enabled: false, hasCalendar: false });
    }
  });

  // Sync booking to GHL (called after local booking is created)
  app.post('/api/integrations/ghl/sync-booking', async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings('gohighlevel');
      
      if (!settings?.isEnabled || !settings.apiKey || !settings.locationId || !settings.calendarId) {
        return res.json({ synced: false, reason: 'GHL not enabled' });
      }
      
      const { bookingId, customerName, customerEmail, customerPhone, customerAddress, bookingDate, startTime, endTime, serviceSummary } = req.body;
      
      const nameParts = customerName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const contactResult = await getOrCreateGHLContact(
        settings.apiKey,
        settings.locationId,
        {
          email: customerEmail,
          firstName,
          lastName,
          phone: customerPhone,
          address: customerAddress
        }
      );
      
      if (!contactResult.success || !contactResult.contactId) {
        await storage.updateBookingGHLSync(bookingId, '', '', 'failed');
        return res.json({ 
          synced: false, 
          reason: contactResult.message || 'Failed to create contact' 
        });
      }
      
      const startDateTime = new Date(`${bookingDate}T${startTime}:00`);
      const endDateTime = new Date(`${bookingDate}T${endTime}:00`);
      
      const appointmentResult = await createGHLAppointment(
        settings.apiKey,
        settings.calendarId,
        {
          contactId: contactResult.contactId,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          title: `Cleaning: ${serviceSummary}`,
          address: customerAddress
        }
      );
      
      if (!appointmentResult.success || !appointmentResult.appointmentId) {
        await storage.updateBookingGHLSync(bookingId, contactResult.contactId, '', 'failed');
        return res.json({ 
          synced: false, 
          reason: appointmentResult.message || 'Failed to create appointment' 
        });
      }
      
      await storage.updateBookingGHLSync(
        bookingId, 
        contactResult.contactId, 
        appointmentResult.appointmentId, 
        'synced'
      );
      
      res.json({ 
        synced: true, 
        contactId: contactResult.contactId,
        appointmentId: appointmentResult.appointmentId
      });
    } catch (err) {
      res.status(500).json({ 
        synced: false, 
        reason: (err as Error).message 
      });
    }
  });

  // FAQs (public GET, admin CRUD)
  app.get('/api/faqs', async (req, res) => {
    try {
      const faqList = await storage.getFaqs();
      res.json(faqList);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post('/api/faqs', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertFaqSchema.parse(req.body);
      const faq = await storage.createFaq(validatedData);
      res.status(201).json(faq);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put('/api/faqs/:id', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertFaqSchema.partial().parse(req.body);
      const faq = await storage.updateFaq(Number(req.params.id), validatedData);
      res.json(faq);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete('/api/faqs/:id', requireAdmin, async (req, res) => {
    try {
      await storage.deleteFaq(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
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
