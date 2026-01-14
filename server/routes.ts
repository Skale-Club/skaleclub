import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas, buildUrl } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import crypto from "crypto";
import { WORKING_HOURS, DEFAULT_BUSINESS_HOURS, insertCategorySchema, insertServiceSchema, insertCompanySettingsSchema, insertFaqSchema, insertIntegrationSettingsSchema, insertBlogPostSchema, BusinessHours, DayHours, insertChatSettingsSchema, insertChatIntegrationsSchema } from "@shared/schema";
import { insertSubcategorySchema } from "./storage";
import { ObjectStorageService, registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { authStorage } from "./replit_integrations/auth/storage";
import { testGHLConnection, getGHLFreeSlots, getOrCreateGHLContact, createGHLAppointment } from "./integrations/ghl";
import { sendNewChatNotification } from "./integrations/twilio";

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

// Chat helpers
const urlRuleSchema = z.object({
  pattern: z.string().min(1),
  match: z.enum(['contains', 'starts_with', 'equals']),
});

const chatMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  pageUrl: z.string().optional(),
  visitorId: z.string().optional(),
  userAgent: z.string().optional(),
  visitorName: z.string().optional(),
  visitorEmail: z.string().optional(),
  visitorPhone: z.string().optional(),
});

type UrlRule = z.infer<typeof urlRuleSchema>;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

function isUrlExcluded(url: string, rules: UrlRule[] = []): boolean {
  if (!url) return false;
  return rules.some(rule => {
    const pattern = rule.pattern || '';
    if (rule.match === 'contains') return url.includes(pattern);
    if (rule.match === 'starts_with') return url.startsWith(pattern);
    return url === pattern;
  });
}

const DEFAULT_CHAT_MODEL = 'gpt-4o-mini';

type IntakeObjective = {
  id: 'zipcode' | 'name' | 'phone' | 'serviceType' | 'serviceDetails' | 'date' | 'address';
  label: string;
  description: string;
  enabled: boolean;
};

const DEFAULT_INTAKE_OBJECTIVES: IntakeObjective[] = [
  { id: 'zipcode', label: 'Zip code', description: 'Collect zip/postal code to validate service area', enabled: true },
  { id: 'name', label: 'Name', description: 'Customer full name', enabled: true },
  { id: 'phone', label: 'Phone', description: 'Phone number for confirmations', enabled: true },
  { id: 'serviceType', label: 'Service type', description: 'Which service is requested', enabled: true },
  { id: 'serviceDetails', label: 'Service details', description: 'Extra details (rooms, size, notes)', enabled: true },
  { id: 'date', label: 'Date & time', description: 'Date and time slot selection', enabled: true },
  { id: 'address', label: 'Address', description: 'Full address with street, unit, city, state', enabled: true },
];

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

  let runtimeOpenAiKey = process.env.OPENAI_API_KEY || "";

  const chatTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "list_services",
        description: "List all available cleaning services with price and duration",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Optional search string to filter services by name" },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_service_details",
        description: "Get details for a specific service",
        parameters: {
          type: "object",
          properties: {
            service_id: { type: "number", description: "ID of the service" },
          },
          required: ["service_id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_availability",
        description: "Get available start times between two dates",
        parameters: {
          type: "object",
          properties: {
            service_id: { type: "number", description: "ID of the service to determine duration" },
            start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
            end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
          },
          required: ["start_date", "end_date"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_booking",
        description: "Create a booking for one or more services once the customer has provided all details",
        parameters: {
          type: "object",
          properties: {
            service_ids: {
              type: "array",
              items: { type: "number" },
              description: "IDs of services to book",
            },
            booking_date: { type: "string", description: "Booking date in YYYY-MM-DD (America/New_York time)" },
            start_time: { type: "string", description: "Start time in HH:mm (24h, America/New_York)" },
            customer_name: { type: "string", description: "Customer full name" },
            customer_email: { type: "string", description: "Customer email" },
            customer_phone: { type: "string", description: "Customer phone" },
            customer_address: { type: "string", description: "Full address with street, city, state, and unit if applicable" },
            payment_method: {
              type: "string",
              enum: ["site", "online"],
              description: "Payment method; defaults to site",
            },
            notes: { type: "string", description: "Any additional notes from the customer", nullable: true },
          },
          required: ["service_ids", "booking_date", "start_time", "customer_name", "customer_email", "customer_phone", "customer_address"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_contact",
        description: "Save visitor contact info (name/email/phone) to the conversation as soon as it is provided",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Visitor name" },
            email: { type: "string", description: "Visitor email" },
            phone: { type: "string", description: "Visitor phone" },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_business_policies",
        description: "Get business hours and any minimum booking rules",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
  ];

  function getOpenAIClient(apiKey?: string) {
    const key = apiKey || runtimeOpenAiKey || process.env.OPENAI_API_KEY;
    if (!key) return null;
    return new OpenAI({ apiKey: key });
  }

  function formatServiceForTool(service: any) {
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      price: service.price?.toString?.() || service.price,
      durationMinutes: service.durationMinutes,
    };
  }

  async function getAvailabilityForDate(
    date: string,
    durationMinutes: number,
    useGhl: boolean,
    ghlSettings: any
  ) {
    const company = await storage.getCompanySettings();
    const businessHours: BusinessHours = (company?.businessHours as BusinessHours) || DEFAULT_BUSINESS_HOURS;
    const selectedDate = new Date(date + 'T12:00:00');
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const dayName = dayNames[selectedDate.getDay()];
    const dayHours: DayHours = businessHours[dayName];

    if (!dayHours?.isOpen) return [];

    const existingBookings = await storage.getBookingsByDate(date);
    let ghlFreeSlots: string[] = [];

    if (useGhl && ghlSettings?.apiKey && ghlSettings.calendarId) {
      try {
        const startDate = new Date(date + 'T00:00:00');
        const endDate = new Date(date + 'T23:59:59');
        const result = await getGHLFreeSlots(
          ghlSettings.apiKey,
          ghlSettings.calendarId,
          startDate,
          endDate,
          'America/New_York'
        );
        if (result.success && result.slots) {
          ghlFreeSlots = result.slots
            .filter((slot: any) => slot.startTime?.startsWith(date))
            .map((slot: any) => slot.startTime.split('T')[1]?.substring(0, 5))
            .filter((t: string) => !!t);
        }
      } catch {
        // fall back silently
      }
    }

    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = estNow.toISOString().split('T')[0];
    const isToday = date === todayStr;
    const currentHour = estNow.getHours();
    const currentMinute = estNow.getMinutes();

    const [startHr, startMn] = dayHours.start.split(':').map(Number);
    const [endHr, endMn] = dayHours.end.split(':').map(Number);

    const slots: string[] = [];

    for (let h = startHr; h < endHr || (h === endHr && 0 < endMn); h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === startHr && m < startMn) continue;
        if (h > endHr || (h === endHr && m >= endMn)) continue;

        const slotHour = h.toString().padStart(2, '0');
        const slotMinute = m.toString().padStart(2, '0');
        const startTime = `${slotHour}:${slotMinute}`;

        if (isToday) {
          if (h < currentHour || (h === currentHour && m <= currentMinute)) continue;
        }

        const slotDate = new Date(`2000-01-01T${startTime}:00`);
        slotDate.setMinutes(slotDate.getMinutes() + durationMinutes);
        if (slotDate.getHours() > endHr || (slotDate.getHours() === endHr && slotDate.getMinutes() > endMn)) {
          continue;
        }

        const endHour = slotDate.getHours().toString().padStart(2, '0');
        const endMinute = slotDate.getMinutes().toString().padStart(2, '0');
        const endTime = `${endHour}:${endMinute}`;

        let available = true;

        if (useGhl) {
          available = ghlFreeSlots.includes(startTime);
        }

        if (available) {
          available = !existingBookings.some(b => startTime < b.endTime && endTime > b.startTime);
        }

        if (available) {
          slots.push(startTime);
        }
      }
    }

    return slots;
  }

  async function getAvailabilityRange(
    startDate: string,
    endDate: string,
    durationMinutes: number
  ) {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return {};

    const result: Record<string, string[]> = {};
    const ghlSettings = await storage.getIntegrationSettings('gohighlevel');
    const useGhl = !!(ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.calendarId);

    for (
      let cursor = new Date(start);
      cursor.getTime() <= end.getTime();
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const dateStr = cursor.toISOString().split('T')[0];
      const slots = await getAvailabilityForDate(dateStr, durationMinutes, useGhl, ghlSettings);
      result[dateStr] = slots;
    }

    return result;
  }

  async function runChatTool(
    toolName: string,
    args: any,
    conversationId?: string
  ) {
    switch (toolName) {
      case 'list_services': {
        const services = await storage.getServices(undefined, undefined, false);
        const query = (args?.query as string | undefined)?.toLowerCase?.();
        const filtered = query
          ? services.filter(s => s.name.toLowerCase().includes(query))
          : services;
        return { services: filtered.map(formatServiceForTool) };
      }
      case 'get_service_details': {
        const id = Number(args?.service_id);
        if (!id) return { error: 'service_id is required' };
        const service = await storage.getService(id);
        if (!service) return { error: 'Service not found' };
        return { service: formatServiceForTool(service) };
      }
      case 'get_availability': {
        const startDate = args?.start_date as string;
        const endDate = args?.end_date as string;
        let durationMinutes = 60;
        if (args?.service_id) {
          const service = await storage.getService(Number(args.service_id));
          if (service?.durationMinutes) {
            durationMinutes = service.durationMinutes;
          }
        }
        const availability = await getAvailabilityRange(startDate, endDate, durationMinutes);
        return { availability, durationMinutes };
      }
      case 'get_business_policies': {
        const company = await storage.getCompanySettings();
        return {
          workingHoursStart: company.workingHoursStart,
          workingHoursEnd: company.workingHoursEnd,
          businessHours: company.businessHours || DEFAULT_BUSINESS_HOURS,
          minimumBookingValue: company.minimumBookingValue?.toString?.() || company.minimumBookingValue,
        };
      }
      case 'update_contact': {
        const name = (args?.name as string | undefined)?.trim();
        const email = (args?.email as string | undefined)?.trim();
        const phone = (args?.phone as string | undefined)?.trim();
        if (!conversationId) return { error: 'Conversation ID missing' };
        if (!name && !email && !phone) return { error: 'Provide at least one of name, email, or phone' };

        const updates: any = {};
        if (name) updates.visitorName = name;
        if (email) updates.visitorEmail = email;
        if (phone) updates.visitorPhone = phone;

        const updated = await storage.updateConversation(conversationId, updates);
        return {
          success: true,
          visitorName: updated?.visitorName,
          visitorEmail: updated?.visitorEmail,
          visitorPhone: updated?.visitorPhone,
        };
      }
      case 'create_booking': {
        const serviceIds = Array.isArray(args?.service_ids) ? args.service_ids.map((id: any) => Number(id)).filter(Boolean) : [];
        const bookingDate = args?.booking_date as string;
        const startTime = args?.start_time as string;
        const paymentMethod = (args?.payment_method as string) || 'site';
        const customerName = (args?.customer_name as string)?.trim();
        const customerEmail = (args?.customer_email as string)?.trim();
        const customerPhone = (args?.customer_phone as string)?.trim();
        const customerAddress = (args?.customer_address as string)?.trim();

        if (
          serviceIds.length === 0 ||
          !bookingDate ||
          !startTime ||
          !customerName ||
          !customerEmail ||
          !customerPhone ||
          !customerAddress
        ) {
          return { error: 'Missing required booking fields.' };
        }

        const services = [];
        let totalPrice = 0;
        let totalDuration = 0;

        for (const id of serviceIds) {
          const service = await storage.getService(id);
          if (!service) {
            return { error: `Service ID ${id} not found` };
          }
          services.push(service);
          totalPrice += Number(service.price);
          totalDuration += service.durationMinutes;
        }

        const [startHour, startMinute] = startTime.split(':').map(Number);
        const startDate = new Date(`2000-01-01T${startTime}:00`);
        startDate.setMinutes(startDate.getMinutes() + totalDuration);
        const endHour = startDate.getHours().toString().padStart(2, '0');
        const endMinute = startDate.getMinutes().toString().padStart(2, '0');
        const endTime = `${endHour}:${endMinute}`;

        const existingBookings = await storage.getBookingsByDate(bookingDate);
        const hasConflict = existingBookings.some(b => startTime < b.endTime && endTime > b.startTime);
        if (hasConflict) {
          return { error: 'Time slot is no longer available.' };
        }

        const ghlSettings = await storage.getIntegrationSettings('gohighlevel');
        const useGhl = !!(ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.calendarId);
        const slotsForDay = await getAvailabilityForDate(bookingDate, totalDuration, useGhl, ghlSettings);
        if (slotsForDay.length > 0 && !slotsForDay.includes(startTime)) {
          return { error: 'Selected time is unavailable. Choose another slot.', availableSlots: slotsForDay };
        }

        const company = await storage.getCompanySettings();
        const minimumBookingValue = parseFloat(company?.minimumBookingValue as any) || 0;
        if (minimumBookingValue > 0 && totalPrice < minimumBookingValue) {
          totalPrice = minimumBookingValue;
        }

        const booking = await storage.createBooking({
          serviceIds,
          bookingDate,
          startTime,
          endTime,
          totalDurationMinutes: totalDuration,
          totalPrice: totalPrice.toFixed(2),
          customerName,
          customerEmail,
          customerPhone,
          customerAddress,
          paymentMethod,
        });

        try {
          if (useGhl && ghlSettings?.apiKey && ghlSettings.locationId && ghlSettings.calendarId) {
            const serviceNames = services.map(s => s.name).join(', ');
            const nameParts = customerName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            const contactResult = await getOrCreateGHLContact(ghlSettings.apiKey, ghlSettings.locationId, {
              email: customerEmail,
              firstName,
              lastName,
              phone: customerPhone,
              address: customerAddress,
            });

            if (contactResult.success && contactResult.contactId) {
              const startTimeISO = `${bookingDate}T${startTime}:00-05:00`;
              const endTimeISO = `${bookingDate}T${endTime}:00-05:00`;
              const appointmentResult = await createGHLAppointment(
                ghlSettings.apiKey,
                ghlSettings.calendarId,
                ghlSettings.locationId,
                {
                  contactId: contactResult.contactId,
                  startTime: startTimeISO,
                  endTime: endTimeISO,
                  title: `Cleaning: ${serviceNames}`,
                  address: customerAddress,
                }
              );

              if (appointmentResult.success && appointmentResult.appointmentId) {
                await storage.updateBookingGHLSync(booking.id, contactResult.contactId, appointmentResult.appointmentId, 'synced');
              } else {
                await storage.updateBookingGHLSync(booking.id, contactResult.contactId, '', 'failed');
              }
            } else {
              await storage.updateBookingGHLSync(booking.id, '', '', 'failed');
            }
          }
        } catch {
          // Non-blocking: ignore sync failures
        }

        return {
          success: true,
          bookingId: booking.id,
          bookingDate,
          startTime,
          endTime,
          totalDurationMinutes: totalDuration,
          totalPrice: totalPrice.toFixed(2),
          services: services.map(s => ({ id: s.id, name: s.name })),
        };
      }
      default:
        return { error: 'Unknown tool' };
    }
  }

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

  // Robots.txt endpoint
  app.get('/robots.txt', async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      const canonicalUrl = settings?.seoCanonicalUrl || `https://${req.get('host')}`;
      
      const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${canonicalUrl}/sitemap.xml
`;
      res.type('text/plain').send(robotsTxt);
    } catch (err) {
      res.type('text/plain').send('User-agent: *\nAllow: /');
    }
  });

  // Sitemap.xml endpoint
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      const categories = await storage.getCategories();
      const blogPostsList = await storage.getPublishedBlogPosts(100, 0);
      const canonicalUrl = settings?.seoCanonicalUrl || `https://${req.get('host')}`;
      const lastMod = new Date().toISOString().split('T')[0];

      let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${canonicalUrl}/</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${canonicalUrl}/services</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${canonicalUrl}/blog</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${canonicalUrl}/cart</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;

      for (const category of categories) {
        sitemap += `
  <url>
    <loc>${canonicalUrl}/services/${category.slug}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      }

      for (const post of blogPostsList) {
        const postDate = post.updatedAt ? new Date(post.updatedAt).toISOString().split('T')[0] : lastMod;
        sitemap += `
  <url>
    <loc>${canonicalUrl}/blog/${post.slug}</loc>
    <lastmod>${postDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
      }

      sitemap += `
</urlset>`;

      res.type('application/xml').send(sitemap);
    } catch (err) {
      res.status(500).send('Error generating sitemap');
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

  // IMPORTANT: This route must come BEFORE /api/services/:id to avoid route conflict
  app.put('/api/services/reorder', requireAdmin, async (req, res) => {
    try {
      const orderData = z.array(z.object({
        id: z.number(),
        order: z.number()
      })).parse(req.body.order);

      await storage.reorderServices(orderData);
      const updated = await storage.getServices(undefined, undefined, true);
      res.json(updated);
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
            // Create appointment in GHL - use EST/EDT timezone format (America/New_York)
            // GHL expects format like "2026-01-27T12:00:00-05:00" not UTC
            const startTimeISO = `${input.bookingDate}T${input.startTime}:00-05:00`;
            const endTimeISO = `${input.bookingDate}T${endTime}:00-05:00`;
            
            const appointmentResult = await createGHLAppointment(
              ghlSettings.apiKey,
              ghlSettings.calendarId,
              ghlSettings.locationId,
              {
                contactId: contactResult.contactId,
                startTime: startTimeISO,
                endTime: endTimeISO,
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

  // Update Booking
  app.patch('/api/bookings/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getBooking(id);
      if (!existing) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      const input = api.bookings.update.input.parse(req.body);
      const updated = await storage.updateBooking(id, input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Delete Booking
  app.delete('/api/bookings/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getBooking(id);
      if (!existing) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      
      await storage.deleteBooking(id);
      res.json({ message: 'Booking deleted' });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Get Booking Items
  app.get('/api/bookings/:id/items', async (req, res) => {
    const id = Number(req.params.id);
    const items = await storage.getBookingItems(id);
    res.json(items);
  });

  // Availability Logic
  app.get(api.availability.check.path, async (req, res) => {
    const date = req.query.date as string;
    const totalDurationMinutes = Number(req.query.totalDurationMinutes);

    if (!date || isNaN(totalDurationMinutes)) {
      return res.status(400).json({ message: "Missing date or duration" });
    }

    // Get company settings for business hours
    const companySettings = await storage.getCompanySettings();
    const businessHours: BusinessHours = (companySettings?.businessHours as BusinessHours) || DEFAULT_BUSINESS_HOURS;
    
    // Get the day of week for the selected date
    const selectedDate = new Date(date + 'T12:00:00');
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const dayName = dayNames[selectedDate.getDay()];
    const dayHours: DayHours = businessHours[dayName];
    
    // If business is closed on this day, return empty slots
    if (!dayHours.isOpen) {
      return res.json([]);
    }

    const existingBookings = await storage.getBookingsByDate(date);
    
    // Check if GHL integration is enabled and get GHL free slots
    const ghlSettings = await storage.getIntegrationSettings('gohighlevel');
    let ghlFreeSlots: string[] = [];
    let useGhlSlots = false;
    
    if (ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.calendarId) {
      try {
        const startDate = new Date(date + 'T00:00:00');
        const endDate = new Date(date + 'T23:59:59');
        const result = await getGHLFreeSlots(
          ghlSettings.apiKey,
          ghlSettings.calendarId,
          startDate,
          endDate,
          'America/New_York'
        );
        
        console.log('GHL free slots result:', JSON.stringify(result, null, 2));
        
        if (result.success && result.slots) {
          // Filter slots for the requested date and extract time parts
          ghlFreeSlots = result.slots
            .filter((slot: any) => {
              // Check if slot is for the requested date
              const slotDate = slot.startTime?.split('T')[0];
              return slotDate === date;
            })
            .map((slot: any) => {
              // Extract HH:MM from startTime (e.g., "2026-01-13T08:00:00.000Z" -> "08:00")
              const timePart = slot.startTime?.includes('T') ? slot.startTime.split('T')[1] : slot.startTime;
              return timePart?.substring(0, 5) || '';
            })
            .filter((time: string) => time !== '');
          
          console.log('Extracted GHL free time slots for', date, ':', ghlFreeSlots);
          useGhlSlots = true;
        } else if (result.success) {
          // GHL returned success but empty/no slots
          console.log('GHL returned success but no slots data');
          useGhlSlots = true;
          ghlFreeSlots = [];
        }
      } catch (error) {
        console.error('Error fetching GHL slots:', error);
        // Fall back to local availability check only on error
      }
    }

    const slots = [];

    // Check if the selected date is today (in EST/America/New_York timezone)
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = estNow.toISOString().split('T')[0];
    const isToday = date === todayStr;
    const currentHour = estNow.getHours();
    const currentMinute = estNow.getMinutes();

    // Parse business hours for this day
    const [startHr, startMn] = dayHours.start.split(':').map(Number);
    const [endHr, endMn] = dayHours.end.split(':').map(Number);

    // Generate slots every 30 minutes based on day-specific business hours
    for (let h = startHr; h < endHr || (h === endHr && 0 < endMn); h++) {
      for (let m = 0; m < 60; m += 30) {
        // Skip if before start time
        if (h === startHr && m < startMn) continue;
        // Skip if at or after end time
        if (h > endHr || (h === endHr && m >= endMn)) continue;

        const slotHour = h.toString().padStart(2, '0');
        const slotMinute = m.toString().padStart(2, '0');
        const startTime = `${slotHour}:${slotMinute}`;

        // Skip past slots if today
        if (isToday) {
          if (h < currentHour || (h === currentHour && m <= currentMinute)) {
            continue; // This slot is in the past
          }
        }

        // Calculate proposed end time
        const slotDate = new Date(`2000-01-01T${startTime}:00`);
        slotDate.setMinutes(slotDate.getMinutes() + totalDurationMinutes);
        
        // Check if ends after working hours for this day
        if (slotDate.getHours() > endHr || (slotDate.getHours() === endHr && slotDate.getMinutes() > endMn)) {
             continue; // Exceeds working hours
        }
        
        const endHour = slotDate.getHours().toString().padStart(2, '0');
        const endMinute = slotDate.getMinutes().toString().padStart(2, '0');
        const endTime = `${endHour}:${endMinute}`;

        // Check availability
        let isAvailable = true;
        
        // If using GHL, check if this slot is in the GHL free slots list
        if (useGhlSlots) {
          isAvailable = ghlFreeSlots.includes(startTime);
        }
        
        // Also check local bookings (in case there are bookings not synced to GHL)
        if (isAvailable) {
          isAvailable = !existingBookings.some(b => {
             return startTime < b.endTime && endTime > b.startTime;
          });
        }

        slots.push({ time: startTime, available: isAvailable });
      }
    }

    res.json(slots);
  });

  // Monthly Availability Summary - returns which dates have at least one available slot
  app.get(api.availability.month.path, async (req, res) => {
    const year = Number(req.query.year);
    const month = Number(req.query.month); // 1-12
    const totalDurationMinutes = Number(req.query.totalDurationMinutes);

    if (!year || !month || isNaN(totalDurationMinutes)) {
      return res.status(400).json({ message: "Missing year, month, or duration" });
    }

    // Get company settings for business hours
    const companySettings = await storage.getCompanySettings();
    const businessHours: BusinessHours = (companySettings?.businessHours as BusinessHours) || DEFAULT_BUSINESS_HOURS;
    
    // Get GHL settings once
    const ghlSettings = await storage.getIntegrationSettings('gohighlevel');
    const useGhl = ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.calendarId;
    
    // Get date range for the month
    const daysInMonth = new Date(year, month, 0).getDate();
    const result: Record<string, boolean> = {};
    
    // Current date/time in EST
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const todayStr = estNow.toISOString().split('T')[0];
    const currentHour = estNow.getHours();
    const currentMinute = estNow.getMinutes();

    // Fetch GHL free slots for the entire month if enabled
    let ghlMonthSlots: Map<string, string[]> = new Map();
    if (useGhl) {
      try {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        const ghlResult = await getGHLFreeSlots(
          ghlSettings.apiKey!,
          ghlSettings.calendarId!,
          startDate,
          endDate,
          'America/New_York'
        );
        
        if (ghlResult.success && ghlResult.slots) {
          for (const slot of ghlResult.slots) {
            const slotDate = slot.startTime?.split('T')[0];
            if (slotDate) {
              const timePart = slot.startTime?.includes('T') ? slot.startTime.split('T')[1] : slot.startTime;
              const timeStr = timePart?.substring(0, 5) || '';
              if (timeStr) {
                if (!ghlMonthSlots.has(slotDate)) {
                  ghlMonthSlots.set(slotDate, []);
                }
                ghlMonthSlots.get(slotDate)!.push(timeStr);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching GHL slots for month:', error);
      }
    }
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(dateStr + 'T12:00:00');
      const dayName = dayNames[dateObj.getDay()];
      const dayHours: DayHours = businessHours[dayName];
      
      // Check if in the past
      if (dateStr < todayStr) {
        result[dateStr] = false;
        continue;
      }
      
      // Check if business is closed
      if (!dayHours.isOpen) {
        result[dateStr] = false;
        continue;
      }
      
      const isToday = dateStr === todayStr;
      const [startHr, startMn] = dayHours.start.split(':').map(Number);
      const [endHr, endMn] = dayHours.end.split(':').map(Number);
      
      // Get existing bookings for this day
      const existingBookings = await storage.getBookingsByDate(dateStr);
      
      // Get GHL free slots for this day if using GHL
      const ghlFreeSlots = useGhl ? (ghlMonthSlots.get(dateStr) || []) : [];
      
      let hasAvailableSlot = false;
      
      // Check each potential slot
      for (let h = startHr; h < endHr || (h === endHr && 0 < endMn); h++) {
        if (hasAvailableSlot) break;
        
        for (let m = 0; m < 60; m += 30) {
          if (hasAvailableSlot) break;
          if (h === startHr && m < startMn) continue;
          if (h > endHr || (h === endHr && m >= endMn)) continue;
          
          const slotHour = h.toString().padStart(2, '0');
          const slotMinute = m.toString().padStart(2, '0');
          const startTime = `${slotHour}:${slotMinute}`;
          
          // Skip past slots if today
          if (isToday && (h < currentHour || (h === currentHour && m <= currentMinute))) {
            continue;
          }
          
          // Calculate end time
          const slotDate = new Date(`2000-01-01T${startTime}:00`);
          slotDate.setMinutes(slotDate.getMinutes() + totalDurationMinutes);
          
          if (slotDate.getHours() > endHr || (slotDate.getHours() === endHr && slotDate.getMinutes() > endMn)) {
            continue;
          }
          
          const endHour = slotDate.getHours().toString().padStart(2, '0');
          const endMinute = slotDate.getMinutes().toString().padStart(2, '0');
          const endTime = `${endHour}:${endMinute}`;
          
          // Check availability
          let isAvailable = true;
          
          if (useGhl) {
            isAvailable = ghlFreeSlots.includes(startTime);
          }
          
          if (isAvailable) {
            isAvailable = !existingBookings.some(b => startTime < b.endTime && endTime > b.startTime);
          }
          
          if (isAvailable) {
            hasAvailableSlot = true;
          }
        }
      }
      
      result[dateStr] = hasAvailableSlot;
    }
    
    res.json(result);
  });

  // ===============================
  // Chat Routes
  // ===============================

  // Public chat configuration for widget
  app.get('/api/chat/config', async (_req, res) => {
    try {
      const settings = await storage.getChatSettings();
      const company = await storage.getCompanySettings();
      const defaultName = company?.companyName || 'Skleanings Assistant';
      const fallbackName =
        settings.agentName && settings.agentName !== 'Skleanings Assistant'
          ? settings.agentName
          : defaultName;
      const companyIcon = company?.logoIcon || '/favicon.ico';
      const fallbackAvatar = companyIcon;
      const primaryAvatar = settings.agentAvatarUrl || fallbackAvatar;
      const intakeObjectives = (settings.intakeObjectives as IntakeObjective[] | null) || [];
      const effectiveObjectives = intakeObjectives.length ? intakeObjectives : DEFAULT_INTAKE_OBJECTIVES;

      res.json({
        enabled: !!settings.enabled,
        agentName: fallbackName,
        agentAvatarUrl: primaryAvatar,
        fallbackAvatarUrl: fallbackAvatar,
        welcomeMessage: settings.welcomeMessage || 'Hi! How can I help you today?',
        excludedUrlRules: (settings.excludedUrlRules as UrlRule[]) || [],
        intakeObjectives: effectiveObjectives,
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Admin chat settings
  app.get('/api/chat/settings', requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getChatSettings();
      const intakeObjectives = (settings.intakeObjectives as IntakeObjective[] | null) || [];
      const effectiveObjectives = intakeObjectives.length ? intakeObjectives : DEFAULT_INTAKE_OBJECTIVES;
      res.json({ ...settings, intakeObjectives: effectiveObjectives });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/chat/settings', requireAdmin, async (req, res) => {
    try {
      const payload = insertChatSettingsSchema
        .partial()
        .extend({
          excludedUrlRules: z.array(urlRuleSchema).optional(),
          intakeObjectives: z.array(z.object({
            id: z.enum(['zipcode', 'name', 'phone', 'serviceType', 'serviceDetails', 'date', 'address']),
            label: z.string(),
            description: z.string(),
            enabled: z.boolean()
          })).optional(),
        })
        .parse(req.body);
      const updated = await storage.updateChatSettings(payload);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Admin conversations
  app.get('/api/chat/conversations', requireAdmin, async (_req, res) => {
    try {
      const conversations = await storage.listConversations();
      const withPreview = await Promise.all(
        conversations.map(async (conv) => {
          const messages = await storage.getConversationMessages(conv.id);
          const lastMessage = messages[messages.length - 1];
          return {
            ...conv,
            lastMessage: lastMessage?.content || '',
            lastMessageRole: lastMessage?.role || null,
            messageCount: messages.length,
          };
        })
      );
      res.json(withPreview);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get('/api/chat/conversations/:id', requireAdmin, async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
      const messages = await storage.getConversationMessages(conversation.id);
      res.json({ conversation, messages });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post('/api/chat/conversations/:id/status', requireAdmin, async (req, res) => {
    try {
      const { status } = z.object({ status: z.enum(['open', 'closed']) }).parse(req.body);
      const existing = await storage.getConversation(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Conversation not found' });
      const updated = await storage.updateConversation(req.params.id, { status });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.delete('/api/chat/conversations/:id', requireAdmin, async (req, res) => {
    try {
      await storage.deleteConversation(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Public conversation history (by ID stored in browser)
  app.get('/api/chat/conversations/:id/messages', async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }
      const messages = await storage.getConversationMessages(req.params.id);
      res.json({ conversation, messages });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Public chat message endpoint
  app.post('/api/chat/message', async (req, res) => {
    try {
      const ipKey = (req.ip || 'unknown').toString();
      if (isRateLimited(ipKey)) {
        return res.status(429).json({ message: 'Too many requests, please slow down.' });
      }

      const parsed = chatMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.errors });
      }
      const input = parsed.data;

      const settings = await storage.getChatSettings();
      const excludedRules = (settings.excludedUrlRules as UrlRule[]) || [];

      if (!settings.enabled) {
        return res.status(503).json({ message: 'Chat is currently disabled.' });
      }

      if (isUrlExcluded(input.pageUrl || '', excludedRules)) {
        return res.status(403).json({ message: 'Chat is not available on this page.' });
      }

      const integration = await storage.getChatIntegration('openai');
      if (!integration?.enabled) {
        return res.status(503).json({ message: 'OpenAI integration is not enabled. Please enable it in Admin → Integrations.' });
      }

      const apiKey = runtimeOpenAiKey || process.env.OPENAI_API_KEY || integration?.apiKey;
      if (!apiKey) {
        return res.status(503).json({ message: 'OpenAI API key is missing. Please configure it in Admin → Integrations.' });
      }

      const model = integration.model || DEFAULT_CHAT_MODEL;
      const conversationId = input.conversationId || crypto.randomUUID();

      let conversation = await storage.getConversation(conversationId);
      const isNewConversation = !conversation;
      if (!conversation) {
        conversation = await storage.createConversation({
          id: conversationId,
          status: 'open',
          firstPageUrl: input.pageUrl,
          visitorName: input.visitorName,
          visitorEmail: input.visitorEmail,
          visitorPhone: input.visitorPhone,
        });

        // Send Twilio notification for new chat
        const twilioSettings = await storage.getTwilioSettings();
        if (twilioSettings && isNewConversation) {
          sendNewChatNotification(twilioSettings, conversationId, input.pageUrl).catch(err => {
            console.error('Failed to send Twilio notification:', err);
          });
        }
      } else {
        await storage.updateConversation(conversationId, { lastMessageAt: new Date() });
      }

      if (conversation?.status === 'closed') {
        await storage.updateConversation(conversationId, { status: 'open' });
      }

      // Check message limit (50 messages per conversation)
      const existingMessages = await storage.getConversationMessages(conversationId);
      if (existingMessages.length >= 50) {
        return res.status(429).json({
          message: 'This conversation has reached the message limit. Please start a new conversation.',
          limitReached: true
        });
      }

      await storage.addConversationMessage({
        id: crypto.randomUUID(),
        conversationId,
        role: 'visitor',
        content: input.message.trim(),
        metadata: {
          pageUrl: input.pageUrl,
          userAgent: input.userAgent,
          visitorId: input.visitorId,
        },
      });

      const company = await storage.getCompanySettings();
      const history = await storage.getConversationMessages(conversationId);
      const historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = history.map((m) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content,
      }));

      const intakeObjectives = (settings.intakeObjectives as IntakeObjective[] | null) || DEFAULT_INTAKE_OBJECTIVES;
      const enabledObjectives = intakeObjectives.filter(obj => obj.enabled);
      const objectivesText = enabledObjectives.length
        ? `Collect info in this order: ${enabledObjectives.map((o, idx) => `${idx + 1}) ${o.label}`).join('; ')}. Only ask enabled items and avoid repeating already provided details.`
        : 'Collect booking details efficiently and avoid repeating questions.';

      const defaultSystemPrompt = `You are a friendly, efficient cleaning service assistant for ${company?.companyName || 'Skleanings'}. Balance being consultative with being efficient - don't over-ask.

SMART QUALIFICATION:
1. When a customer mentions a need, assess if you have ENOUGH info to recommend:
   - "clean my 3-seater sofa" → SUFFICIENT, search services immediately
   - "clean my sofa" → Ask: "How many seats?" then proceed
   - "carpet cleaning" → Ask: "Which room?" then proceed

2. Only ask 1-2 critical questions if info is missing. Don't interrogate:
   ❌ DON'T: Ask about material, stains, age, usage, etc. unless customer mentions issues
   ✅ DO: Ask only what's needed to identify the right service (size/type)

3. SMART CONFIRMATION - only if unclear:
   - If customer said "3-seater sofa" → Search immediately, no confirmation needed
   - If customer said "big sofa" → Confirm: "By big, do you mean 3-seater or larger?"

4. After suggesting service, ask if they want to book - don't ask more questions

NATURAL INFO COLLECTION:
- After they agree to book, collect info smoothly:
  "Great! What's your name?" → "Email?" → "Phone?" → "Full address?"
- Use update_contact immediately when you get name/email/phone
- Keep it fast - one question per message

BOOKING FLOW:
- Confirm timezone (America/New_York)
- Use get_availability with service_id
- Show 3-5 slots within 14 days
- After they pick a time and provide address, create booking immediately
- Don't ask "are you sure?" - just confirm after booking is done

TOOLS:
- list_services: As soon as you know what they need
- get_service_details: If they ask about a specific service
- get_availability: With service_id after they agree to book
- update_contact: When you get name/email/phone
- create_booking: After slot selection and all required info collected
- get_business_policies: Check minimums only if needed

RULES:
- Never guess prices/availability
- Never invent slots
- Keep responses 2-3 sentences max
- Use markdown for emphasis: **bold** for prices and service names
- Complete bookings in chat

EFFICIENT EXAMPLES:

Example 1 (Sufficient info):
Customer: "I need my 3-seater sofa cleaned"
You: "Perfect! Let me find our sofa cleaning options for you..."
[Use list_services]
You: "I recommend **3-Seat Sofa Deep Cleaning** - $120, 2 hours. Want to book it?"

Example 2 (Missing size):
Customer: "I need my sofa cleaned"
You: "Great! How many seats is your sofa?"
Customer: "3 seats"
You: "Perfect! Let me find the right service..."
[Use list_services]
You: "I recommend **3-Seat Sofa Deep Cleaning** - $120, 2 hours. Want to book it?"

Example 3 (Ready to book):
Customer: "Yes, book it"
You: "Awesome! What's your name?"
Customer: "John Smith"
You: "Thanks John! What's your email?"
[Continue collecting info smoothly, no extra questions]`;
      const systemPrompt = settings.systemPrompt || defaultSystemPrompt;

      const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'system',
          content: objectivesText,
        },
        ...historyMessages,
      ];

      const openai = getOpenAIClient(apiKey);
      if (!openai) {
        return res.status(503).json({ message: 'Chat is currently unavailable.' });
      }

      let assistantResponse = 'Sorry, I could not process that request.';
      let leadCaptured = false;
      let bookingCompleted: { value: number; services: string[] } | null = null;

      try {
        const first = await openai.chat.completions.create({
          model,
          messages: chatMessages,
          tools: chatTools,
          tool_choice: 'auto',
          max_tokens: 500,
        });

        let choice = first.choices[0].message;
        const toolCalls = choice.tool_calls || [];

        if (toolCalls.length > 0) {
          const toolResponses = [];
          for (const call of toolCalls) {
            let args: any = {};
            try {
              args = JSON.parse(call.function.arguments || '{}');
            } catch {
              args = {};
            }
            const toolResult = await runChatTool(call.function.name, args, conversationId);

            // Track lead capture (first time contact info is saved)
            if (call.function.name === 'update_contact' && toolResult.success) {
              const conv = await storage.getConversation(conversationId);
              if (conv?.visitorName || conv?.visitorEmail || conv?.visitorPhone) {
                leadCaptured = true;
              }
            }

            // Track booking completion
            if (call.function.name === 'create_booking' && toolResult.success) {
              bookingCompleted = {
                value: parseFloat(String(toolResult.totalPrice ?? '0')) || 0,
                services: toolResult.services?.map((s: any) => s.name) || []
              };
            }

            toolResponses.push({
              role: 'tool' as const,
              tool_call_id: call.id,
              content: JSON.stringify(toolResult),
            });
          }

          const second = await openai.chat.completions.create({
            model,
            messages: [...chatMessages, choice, ...toolResponses],
            max_tokens: 500,
          });

          assistantResponse = second.choices[0].message.content || assistantResponse;
        } else {
          assistantResponse = choice.content || assistantResponse;
        }
      } catch (err: any) {
        console.error('OpenAI chat error:', err?.message);
        assistantResponse = 'Chat is unavailable right now. Please try again soon.';
      }

      await storage.addConversationMessage({
        id: crypto.randomUUID(),
        conversationId,
        role: 'assistant',
        content: assistantResponse,
      });
      await storage.updateConversation(conversationId, { lastMessageAt: new Date() });

      res.json({
        conversationId,
        response: assistantResponse,
        leadCaptured,
        bookingCompleted
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // ===============================
  // OpenAI Integration Routes
  // ===============================

  app.get('/api/integrations/openai', requireAdmin, async (_req, res) => {
    try {
      const integration = await storage.getChatIntegration('openai');
      res.json({
        provider: 'openai',
        enabled: integration?.enabled || false,
        model: integration?.model || DEFAULT_CHAT_MODEL,
        hasKey: !!(runtimeOpenAiKey || process.env.OPENAI_API_KEY || integration?.apiKey),
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/integrations/openai', requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getChatIntegration('openai');
      const payload = insertChatIntegrationsSchema
        .partial()
        .extend({
          apiKey: z.string().min(10).optional(),
        })
        .parse({ ...req.body, provider: 'openai' });

      const providedKey = payload.apiKey && payload.apiKey !== '********' ? payload.apiKey : undefined;
      const keyToPersist = providedKey ?? existing?.apiKey ?? runtimeOpenAiKey ?? process.env.OPENAI_API_KEY;
      if (providedKey) {
        runtimeOpenAiKey = providedKey;
      }

      const willEnable = payload.enabled ?? false;
      const keyAvailable = !!keyToPersist;
      if (willEnable && !keyAvailable) {
        return res.status(400).json({ message: 'Provide a valid API key and test it before enabling.' });
      }

      const updated = await storage.upsertChatIntegration({
        provider: 'openai',
        enabled: payload.enabled ?? false,
        model: payload.model || DEFAULT_CHAT_MODEL,
        apiKey: keyToPersist,
      });

      res.json({
        ...updated,
        hasKey: !!keyToPersist,
        apiKey: undefined,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post('/api/integrations/openai/test', requireAdmin, async (req, res) => {
    try {
      const bodySchema = z.object({
        apiKey: z.string().min(10).optional(),
        model: z.string().optional(),
      });
      const { apiKey, model } = bodySchema.parse(req.body);
      const existing = await storage.getChatIntegration('openai');
      const keyToUse =
        (apiKey && apiKey !== '********' ? apiKey : undefined) ||
        runtimeOpenAiKey ||
        process.env.OPENAI_API_KEY ||
        existing?.apiKey;

      if (!keyToUse) {
        return res.status(400).json({ success: false, message: 'API key is required' });
      }

      const client = getOpenAIClient(keyToUse);
      if (!client) {
        return res.status(400).json({ success: false, message: 'Invalid API key' });
      }

      try {
        await client.chat.completions.create({
          model: model || DEFAULT_CHAT_MODEL,
          messages: [{ role: 'user', content: 'Say pong' }],
          max_tokens: 5,
        });
      } catch (err: any) {
        const message = err?.message || 'Failed to test OpenAI connection';
        const status = err?.status || err?.response?.status;
        return res.status(500).json({
          success: false,
          message: status ? `OpenAI error (${status}): ${message}` : message,
        });
      }

      // Cache key in memory for runtime use
      runtimeOpenAiKey = keyToUse;
      await storage.upsertChatIntegration({
        provider: 'openai',
        enabled: existing?.enabled ?? false,
        model: model || existing?.model || DEFAULT_CHAT_MODEL,
        apiKey: keyToUse,
      });

      res.json({ success: true, message: 'Connection successful' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Failed to test OpenAI connection' });
    }
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
      
      // Use EST/EDT timezone format (America/New_York)
      // GHL expects format like "2026-01-27T12:00:00-05:00" not UTC
      const startTimeISO = `${bookingDate}T${startTime}:00-05:00`;
      const endTimeISO = `${bookingDate}T${endTime}:00-05:00`;
      
      const appointmentResult = await createGHLAppointment(
        settings.apiKey,
        settings.calendarId,
        settings.locationId,
        {
          contactId: contactResult.contactId,
          startTime: startTimeISO,
          endTime: endTimeISO,
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

  // ===============================
  // Twilio Integration Routes
  // ===============================

  // Get Twilio settings
  app.get('/api/integrations/twilio', requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getTwilioSettings();
      if (!settings) {
        return res.json({
          enabled: false,
          accountSid: '',
          authToken: '',
          fromPhoneNumber: '',
          toPhoneNumber: '',
          notifyOnNewChat: true
        });
      }
      res.json({
        ...settings,
        authToken: settings.authToken ? '********' : ''
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Save Twilio settings
  app.put('/api/integrations/twilio', requireAdmin, async (req, res) => {
    try {
      const { accountSid, authToken, fromPhoneNumber, toPhoneNumber, notifyOnNewChat, enabled } = req.body;

      const existingSettings = await storage.getTwilioSettings();

      const settingsToSave: any = {
        accountSid,
        fromPhoneNumber,
        toPhoneNumber,
        notifyOnNewChat: notifyOnNewChat ?? true,
        enabled: enabled ?? false
      };

      // Only update authToken if a new one is provided (not masked)
      if (authToken && authToken !== '********') {
        settingsToSave.authToken = authToken;
      } else if (existingSettings?.authToken) {
        settingsToSave.authToken = existingSettings.authToken;
      }

      const settings = await storage.saveTwilioSettings(settingsToSave);

      res.json({
        ...settings,
        authToken: settings.authToken ? '********' : ''
      });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Test Twilio connection
  app.post('/api/integrations/twilio/test', requireAdmin, async (req, res) => {
    try {
      const { accountSid, authToken, fromPhoneNumber, toPhoneNumber } = req.body;

      let tokenToTest = authToken;
      if (authToken === '********' || !authToken) {
        const existingSettings = await storage.getTwilioSettings();
        tokenToTest = existingSettings?.authToken;
      }

      if (!accountSid || !tokenToTest || !fromPhoneNumber || !toPhoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required to test Twilio connection'
        });
      }

      // Send test SMS using Twilio
      const twilio = await import('twilio');
      const client = twilio.default(accountSid, tokenToTest);

      await client.messages.create({
        body: 'Test message from Skleanings - Your Twilio integration is working!',
        from: fromPhoneNumber,
        to: toPhoneNumber
      });

      res.json({
        success: true,
        message: 'Test SMS sent successfully!'
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to send test SMS'
      });
    }
  });

  // Blog Posts (public GET, admin CRUD)
  app.get('/api/blog', async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      
      if (status === 'published' && limit) {
        const posts = await storage.getPublishedBlogPosts(limit, offset);
        res.json(posts);
      } else if (status) {
        const posts = await storage.getBlogPosts(status);
        res.json(posts);
      } else {
        const posts = await storage.getBlogPosts();
        res.json(posts);
      }
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get('/api/blog/count', async (req, res) => {
    try {
      const count = await storage.countPublishedBlogPosts();
      res.json({ count });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get('/api/blog/:idOrSlug', async (req, res) => {
    try {
      const param = req.params.idOrSlug;
      let post;
      
      if (/^\d+$/.test(param)) {
        post = await storage.getBlogPost(Number(param));
      } else {
        post = await storage.getBlogPostBySlug(param);
      }
      
      if (!post) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      res.json(post);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get('/api/blog/:id/services', async (req, res) => {
    try {
      const services = await storage.getBlogPostServices(Number(req.params.id));
      res.json(services);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get('/api/blog/:id/related', async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 4;
      const posts = await storage.getRelatedBlogPosts(Number(req.params.id), limit);
      res.json(posts);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post('/api/blog', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertBlogPostSchema.parse(req.body);
      const post = await storage.createBlogPost(validatedData);
      res.status(201).json(post);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put('/api/blog/:id', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertBlogPostSchema.partial().parse(req.body);
      const post = await storage.updateBlogPost(Number(req.params.id), validatedData);
      res.json(post);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete('/api/blog/:id', requireAdmin, async (req, res) => {
    try {
      await storage.deleteBlogPost(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
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
