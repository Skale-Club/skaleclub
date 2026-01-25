import { z } from 'zod';
import { insertBookingSchema, categories, services, bookings, formLeadProgressSchema, formLeads, leadStatusEnum, leadClassificationEnum } from './schema.js';

const urlRuleSchema = z.object({
  pattern: z.string(),
  match: z.enum(['contains', 'starts_with', 'equals']),
});

const chatMessageInput = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string(),
  pageUrl: z.string().optional(),
  visitorId: z.string().optional(),
  userAgent: z.string().optional(),
  visitorName: z.string().optional(),
  visitorEmail: z.string().optional(),
  visitorPhone: z.string().optional(),
});

const leadStatusValues = leadStatusEnum.enumValues as [string, ...string[]];
const leadClassificationValues = leadClassificationEnum.enumValues as [string, ...string[]];

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  conflict: z.object({
    message: z.string(),
  }),
};

export const api = {
  categories: {
    list: {
      method: 'GET' as const,
      path: '/api/categories',
      responses: {
        200: z.array(z.custom<typeof categories.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/categories/:slug',
      responses: {
        200: z.custom<typeof categories.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  services: {
    list: {
      method: 'GET' as const,
      path: '/api/services',
      input: z.object({
        categoryId: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof services.$inferSelect>()),
      },
    },
  },
  chat: {
    config: {
      method: 'GET' as const,
      path: '/api/chat/config',
      responses: {
        200: z.object({
          enabled: z.boolean(),
          agentName: z.string(),
          agentAvatarUrl: z.string(),
          fallbackAvatarUrl: z.string(),
          welcomeMessage: z.string(),
          excludedUrlRules: z.array(urlRuleSchema),
        }),
      },
    },
    message: {
      method: 'POST' as const,
      path: '/api/chat/message',
      input: chatMessageInput,
      responses: {
        200: z.object({
          conversationId: z.string(),
          response: z.string(),
        }),
        503: z.object({ message: z.string() }),
      },
    },
    history: {
      method: 'GET' as const,
      path: '/api/chat/conversations/:id/messages',
      responses: {
        200: z.object({
          conversation: z.any(),
          messages: z.array(z.object({
            id: z.string(),
            role: z.string(),
            content: z.string(),
            createdAt: z.string().optional(),
          })),
        }),
      },
    },
  },
  bookings: {
    create: {
      method: 'POST' as const,
      path: '/api/bookings',
      input: insertBookingSchema,
      responses: {
        201: z.custom<typeof bookings.$inferSelect>(),
        400: errorSchemas.validation,
        409: errorSchemas.conflict, // Time slot taken
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/bookings',
      responses: {
        200: z.array(z.custom<typeof bookings.$inferSelect>()),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/bookings/:id',
      input: z.object({
        status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
        paymentStatus: z.enum(['paid', 'unpaid']).optional(),
        totalPrice: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof bookings.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/bookings/:id',
      responses: {
        200: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
    getItems: {
      method: 'GET' as const,
      path: '/api/bookings/:id/items',
      responses: {
        200: z.array(z.object({
          id: z.number(),
          bookingId: z.number(),
          serviceId: z.number(),
          serviceName: z.string(),
          price: z.string(),
        })),
      },
    },
  },
  formLeads: {
    progress: {
      method: 'POST' as const,
      path: '/api/form-leads/progress',
      input: formLeadProgressSchema,
      responses: {
        200: z.custom<typeof formLeads.$inferSelect>(),
        400: errorSchemas.validation,
        409: errorSchemas.conflict,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/form-leads/:sessionId',
      responses: {
        200: z.custom<typeof formLeads.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/form-leads',
      input: z.object({
        status: z.enum(leadStatusValues).optional(),
        classificacao: z.enum(leadClassificationValues).optional(),
        formCompleto: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
        search: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof formLeads.$inferSelect>()),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/form-leads/:id',
      input: z.object({
        status: z.enum(leadStatusValues).optional(),
        observacoes: z.string().optional(),
        notificacaoEnviada: z.boolean().optional(),
      }),
      responses: {
        200: z.custom<typeof formLeads.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/form-leads/:id',
      responses: {
        200: z.object({ message: z.string() }),
        404: errorSchemas.notFound,
      },
    },
  },
  availability: {
    check: {
      method: 'GET' as const,
      path: '/api/availability',
      input: z.object({
        date: z.string(), // YYYY-MM-DD
        totalDurationMinutes: z.coerce.number(),
      }),
      responses: {
        200: z.array(z.object({
          time: z.string(),
          available: z.boolean(),
        })),
      },
    },
    month: {
      method: 'GET' as const,
      path: '/api/availability/month',
      input: z.object({
        year: z.coerce.number(),
        month: z.coerce.number(), // 1-12
        totalDurationMinutes: z.coerce.number(),
      }),
      responses: {
        200: z.record(z.string(), z.boolean()), // { "2026-01-13": true, "2026-01-14": false, ... }
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
