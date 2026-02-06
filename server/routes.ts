import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage.js";
import { api, errorSchemas, buildUrl } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { WORKING_HOURS, DEFAULT_BUSINESS_HOURS, insertCategorySchema, insertServiceSchema, insertCompanySettingsSchema, insertFaqSchema, insertIntegrationSettingsSchema, insertBlogPostSchema, BusinessHours, DayHours, insertChatSettingsSchema, insertChatIntegrationsSchema, insertKnowledgeBaseCategorySchema, insertKnowledgeBaseArticleSchema, formLeadProgressSchema } from "@shared/schema";
import type { LeadClassification, LeadStatus } from "@shared/schema";
import { DEFAULT_FORM_CONFIG, calculateMaxScore, calculateFormScoresWithConfig, classifyLead, getSortedQuestions, KNOWN_FIELD_IDS } from "@shared/form";
import type { FormAnswers } from "@shared/form";
import type { FormConfig } from "@shared/schema";
import { insertSubcategorySchema } from "./storage.js";
import { testGHLConnection, getGHLFreeSlots, getOrCreateGHLContact, createGHLAppointment, getGHLCustomFields } from "./integrations/ghl.js";
import { sendHotLeadNotification, sendLowPerformanceAlert, sendNewChatNotification } from "./integrations/twilio.js";
import { registerStorageRoutes } from "./storage/storageAdapter.js";
import { db } from "./db.js";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

const isReplit = !!process.env.REPL_ID;

// Admin authentication middleware - environment-aware
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (isReplit) {
    // Replit Auth: check Passport session + isAdmin in DB
    const user = (req as any).user;
    if (!req.isAuthenticated || !req.isAuthenticated() || !user?.claims?.sub) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    try {
      const { authStorage } = await import("./replit_integrations/auth/storage.js");
      const dbUser = await authStorage.getUser(user.claims.sub);
      if (!dbUser?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      next();
    } catch (error) {
      return res.status(500).json({ message: 'Failed to verify admin status' });
    }
  } else {
    // Supabase Auth: check express-session
    const sess = req.session as any;
    if (!sess?.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    try {
      const [dbUser] = await db.select().from(users).where(eq(users.id, sess.userId));
      if (!dbUser?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      next();
    } catch (error) {
      return res.status(500).json({ message: 'Failed to verify admin status' });
    }
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
  language: z.string().optional(),
});

type UrlRule = z.infer<typeof urlRuleSchema>;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
let lastLowPerformanceAlertAt: number | null = null;

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

  // Check admin session status - environment-aware
  // On Vercel (Supabase Auth), this is handled by server/auth/supabaseAuth.ts
  // On Replit, we handle it here with Replit Auth
  if (isReplit) {
    app.get('/api/admin/session', async (req, res) => {
      const user = (req as any).user;

      if (!req.isAuthenticated || !req.isAuthenticated() || !user?.claims?.sub) {
        return res.json({ isAdmin: false, email: null, firstName: null, lastName: null });
      }

      try {
        const { authStorage } = await import("./replit_integrations/auth/storage.js");
        const dbUser = await authStorage.getUser(user.claims.sub);
        res.json({
          isAdmin: dbUser?.isAdmin || false,
          email: dbUser?.email || null,
          firstName: dbUser?.firstName || null,
          lastName: dbUser?.lastName || null
        });
      } catch (error) {
        res.json({ isAdmin: false, email: null, firstName: null, lastName: null });
      }
    });
  }

  let runtimeOpenAiKey = process.env.OPENAI_API_KEY || "";

  // Chat tools for lead qualification flow
  const chatTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "get_form_config",
        description: "Get the qualification form configuration including all questions, options, and scoring thresholds. Call this at the start to know what questions to ask.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "save_lead_answer",
        description: "Save a lead's answer to a question and get the updated score and next question",
        parameters: {
          type: "object",
          properties: {
            question_id: {
              type: "string",
              description: "The ID of the question being answered (e.g., 'nome', 'email', 'tipoNegocio')"
            },
            answer: {
              type: "string",
              description: "The lead's answer to the question"
            },
          },
          required: ["question_id", "answer"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_lead_state",
        description: "Get the current state of the lead including answers collected so far, current score, and next question to ask",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "complete_lead",
        description: "Mark the lead as complete and sync to CRM. Call this after all questions have been answered.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_knowledge_base",
        description: "Search linked knowledge base documents to answer company-specific questions or policies",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Optional keywords to search documents. Leave empty to fetch all linked docs."
            },
          },
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_faqs",
        description: "Search frequently asked questions database to answer questions about Skale Club services, pricing, process, and other common inquiries",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Optional search keywords to filter FAQs. Leave empty to get all FAQs."
            },
          },
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

  // Helper to get or create a lead for a conversation
  async function getOrCreateLeadForConversation(conversationId: string): Promise<{ lead: any; formConfig: FormConfig }> {
    const settings = await storage.getCompanySettings();
    const formConfig = settings?.formConfig || DEFAULT_FORM_CONFIG;

    // Try to find existing lead by conversation ID
    let lead = await storage.getFormLeadByConversationId(conversationId);

    if (!lead) {
      // Create a new lead with conversation source
      const sessionId = crypto.randomUUID();
      lead = await storage.upsertFormLeadProgress({
        sessionId,
        nome: '', // Will be filled when we get the name
        questionNumber: 0,
        formCompleto: false,
      }, { conversationId, source: 'chat' }, formConfig);
    }

    return { lead, formConfig };
  }

  // Helper to get next unanswered question
  function getNextQuestion(lead: any, formConfig: FormConfig): any {
    const sortedQuestions = getSortedQuestions(formConfig);
    const answers: Record<string, string | undefined> = {
      nome: lead.nome || undefined,
      email: lead.email || undefined,
      telefone: lead.telefone || undefined,
      cidadeEstado: lead.cidadeEstado || undefined,
      tipoNegocio: lead.tipoNegocio || undefined,
      tipoNegocioOutro: lead.tipoNegocioOutro || undefined,
      tempoNegocio: lead.tempoNegocio || undefined,
      experienciaMarketing: lead.experienciaMarketing || undefined,
      orcamentoAnuncios: lead.orcamentoAnuncios || undefined,
      principalDesafio: lead.principalDesafio || undefined,
      disponibilidade: lead.disponibilidade || undefined,
      expectativaResultado: lead.expectativaResultado || undefined,
      ...(lead.customAnswers || {}),
    };

    for (const question of sortedQuestions) {
      // Check if this question is answered
      const answer = answers[question.id];
      if (!answer || answer.trim() === '') {
        return question;
      }
      // Check conditional field if applicable
      if (question.conditionalField && answer === question.conditionalField.showWhen) {
        const conditionalAnswer = answers[question.conditionalField.id];
        if (!conditionalAnswer || conditionalAnswer.trim() === '') {
          return {
            ...question,
            isConditional: true,
            conditionalQuestion: question.conditionalField,
          };
        }
      }
    }
    return null; // All questions answered
  }

  async function runChatTool(
    toolName: string,
    args: any,
    conversationId?: string,
    options?: { allowFaqs?: boolean; allowKnowledgeBase?: boolean }
  ) {
    switch (toolName) {
      case 'get_form_config': {
        const settings = await storage.getCompanySettings();
        const formConfig = settings?.formConfig || DEFAULT_FORM_CONFIG;
        const sortedQuestions = getSortedQuestions(formConfig);

        return {
          questions: sortedQuestions.map(q => ({
            id: q.id,
            order: q.order,
            title: q.title,
            type: q.type,
            required: q.required,
            placeholder: q.placeholder,
            options: q.options?.map(o => ({ value: o.value, label: o.label })),
            conditionalField: q.conditionalField ? {
              showWhen: q.conditionalField.showWhen,
              id: q.conditionalField.id,
              title: q.conditionalField.title,
              placeholder: q.conditionalField.placeholder,
            } : undefined,
          })),
          thresholds: formConfig.thresholds,
          maxScore: formConfig.maxScore,
          totalQuestions: sortedQuestions.length,
        };
      }

      case 'save_lead_answer': {
        if (!conversationId) return { error: 'Conversation ID missing' };

        const questionId = args?.question_id as string;
        const answer = args?.answer as string;

        if (!questionId || !answer) {
          return { error: 'question_id and answer are required' };
        }

        const settings = await storage.getCompanySettings();
        const formConfig = settings?.formConfig || DEFAULT_FORM_CONFIG;

        // Get or create lead for this conversation
        let lead = await storage.getFormLeadByConversationId(conversationId);
        const sortedQuestions = getSortedQuestions(formConfig);

        // Build current answers
        const currentAnswers: FormAnswers = lead ? {
          nome: lead.nome || undefined,
          email: lead.email || undefined,
          telefone: lead.telefone || undefined,
          cidadeEstado: lead.cidadeEstado || undefined,
          tipoNegocio: lead.tipoNegocio || undefined,
          tipoNegocioOutro: lead.tipoNegocioOutro || undefined,
          tempoNegocio: lead.tempoNegocio || undefined,
          experienciaMarketing: lead.experienciaMarketing || undefined,
          orcamentoAnuncios: lead.orcamentoAnuncios || undefined,
          principalDesafio: lead.principalDesafio || undefined,
          disponibilidade: lead.disponibilidade || undefined,
          expectativaResultado: lead.expectativaResultado || undefined,
          ...(lead.customAnswers || {}),
        } : {};

        // Add the new answer
        currentAnswers[questionId] = answer;

        // Find the question index
        const questionIndex = sortedQuestions.findIndex(q => q.id === questionId);
        const questionNumber = questionIndex >= 0 ? questionIndex + 1 : (lead?.ultimaPerguntaRespondida || 0) + 1;

        // Check if form is complete
        const answeredCount = Object.entries(currentAnswers).filter(([k, v]) => v && v.trim() !== '').length;
        const formCompleto = answeredCount >= sortedQuestions.length;

        // Determine nome for upsert (required field)
        const nome = currentAnswers.nome || lead?.nome || answer; // Use first answer as nome if nome not yet set

        // Upsert the lead
        const sessionId = lead?.sessionId || crypto.randomUUID();
        lead = await storage.upsertFormLeadProgress({
          sessionId,
          nome: nome || '',
          email: currentAnswers.email,
          telefone: currentAnswers.telefone,
          cidadeEstado: currentAnswers.cidadeEstado,
          tipoNegocio: currentAnswers.tipoNegocio,
          tipoNegocioOutro: currentAnswers.tipoNegocioOutro,
          tempoNegocio: currentAnswers.tempoNegocio,
          experienciaMarketing: currentAnswers.experienciaMarketing,
          orcamentoAnuncios: currentAnswers.orcamentoAnuncios,
          principalDesafio: currentAnswers.principalDesafio,
          disponibilidade: currentAnswers.disponibilidade,
          expectativaResultado: currentAnswers.expectativaResultado,
          questionNumber,
          formCompleto,
          customAnswers: lead?.customAnswers || undefined,
        }, { conversationId, source: 'chat' }, formConfig);

        // Get next question
        const nextQuestion = getNextQuestion(lead, formConfig);

        // Send SMS notification if phone is provided
        if (lead.telefone && !lead.notificacaoEnviada) {
          try {
            const twilioSettings = await storage.getTwilioSettings();
            const companyName = settings?.companyName || 'Skale Club';
            if (twilioSettings) {
              const notifyResult = await sendHotLeadNotification(twilioSettings, lead, companyName);
              if (notifyResult.success) {
                await storage.updateFormLead(lead.id, { notificacaoEnviada: true });
              }
            }
          } catch (err) {
            console.error('Lead notification error:', err);
          }
        }

        return {
          success: true,
          currentScore: lead.scoreTotal,
          classification: lead.classificacao,
          isComplete: !nextQuestion,
          nextQuestion: nextQuestion ? {
            id: nextQuestion.isConditional ? nextQuestion.conditionalQuestion.id : nextQuestion.id,
            title: nextQuestion.isConditional ? nextQuestion.conditionalQuestion.title : nextQuestion.title,
            type: nextQuestion.type,
            placeholder: nextQuestion.isConditional ? nextQuestion.conditionalQuestion.placeholder : nextQuestion.placeholder,
            options: nextQuestion.options?.map((o: any) => ({ value: o.value, label: o.label })),
          } : null,
          answeredQuestions: answeredCount,
          totalQuestions: sortedQuestions.length,
        };
      }

      case 'get_lead_state': {
        if (!conversationId) return { error: 'Conversation ID missing' };

        const settings = await storage.getCompanySettings();
        const formConfig = settings?.formConfig || DEFAULT_FORM_CONFIG;
        const lead = await storage.getFormLeadByConversationId(conversationId);

        if (!lead) {
          const sortedQuestions = getSortedQuestions(formConfig);
          return {
            answers: {},
            currentScore: 0,
            classification: null,
            isComplete: false,
            nextQuestion: sortedQuestions[0] ? {
              id: sortedQuestions[0].id,
              title: sortedQuestions[0].title,
              type: sortedQuestions[0].type,
              placeholder: sortedQuestions[0].placeholder,
              options: sortedQuestions[0].options?.map(o => ({ value: o.value, label: o.label })),
            } : null,
            answeredQuestions: 0,
            totalQuestions: sortedQuestions.length,
          };
        }

        const answers: Record<string, string> = {};
        if (lead.nome) answers.nome = lead.nome;
        if (lead.email) answers.email = lead.email;
        if (lead.telefone) answers.telefone = lead.telefone;
        if (lead.cidadeEstado) answers.cidadeEstado = lead.cidadeEstado;
        if (lead.tipoNegocio) answers.tipoNegocio = lead.tipoNegocio;
        if (lead.tipoNegocioOutro) answers.tipoNegocioOutro = lead.tipoNegocioOutro;
        if (lead.tempoNegocio) answers.tempoNegocio = lead.tempoNegocio;
        if (lead.experienciaMarketing) answers.experienciaMarketing = lead.experienciaMarketing;
        if (lead.orcamentoAnuncios) answers.orcamentoAnuncios = lead.orcamentoAnuncios;
        if (lead.principalDesafio) answers.principalDesafio = lead.principalDesafio;
        if (lead.customAnswers) Object.assign(answers, lead.customAnswers);

        const nextQuestion = getNextQuestion(lead, formConfig);
        const sortedQuestions = getSortedQuestions(formConfig);

        return {
          answers,
          currentScore: lead.scoreTotal,
          classification: lead.classificacao,
          isComplete: !nextQuestion,
          nextQuestion: nextQuestion ? {
            id: nextQuestion.isConditional ? nextQuestion.conditionalQuestion.id : nextQuestion.id,
            title: nextQuestion.isConditional ? nextQuestion.conditionalQuestion.title : nextQuestion.title,
            type: nextQuestion.type,
            placeholder: nextQuestion.isConditional ? nextQuestion.conditionalQuestion.placeholder : nextQuestion.placeholder,
            options: nextQuestion.options?.map((o: any) => ({ value: o.value, label: o.label })),
          } : null,
          answeredQuestions: Object.keys(answers).length,
          totalQuestions: sortedQuestions.length,
        };
      }

      case 'complete_lead': {
        if (!conversationId) return { error: 'Conversation ID missing' };

        const lead = await storage.getFormLeadByConversationId(conversationId);
        if (!lead) {
          return { error: 'No lead found for this conversation' };
        }

        // Mark as complete
        await storage.updateFormLead(lead.id, { formCompleto: true } as any);

        // Sync to GoHighLevel
        let ghlContactId: string | undefined;
        try {
          const ghlSettings = await storage.getIntegrationSettings('gohighlevel');
          const settings = await storage.getCompanySettings();
          const formConfig = settings?.formConfig || DEFAULT_FORM_CONFIG;

          if (ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.locationId && lead.telefone) {
            const nameParts = (lead.nome || '').trim().split(' ').filter(Boolean);
            const firstName = nameParts.shift() || lead.nome || 'Lead';
            const lastName = nameParts.join(' ');

            // Build custom fields from form config mappings
            const customFields: Array<{ id: string; field_value: string }> = [];
            const allAnswers: Record<string, string | undefined> = {
              nome: lead.nome || undefined,
              email: lead.email || undefined,
              telefone: lead.telefone || undefined,
              cidadeEstado: lead.cidadeEstado || undefined,
              tipoNegocio: lead.tipoNegocio || undefined,
              tipoNegocioOutro: lead.tipoNegocioOutro || undefined,
              tempoNegocio: lead.tempoNegocio || undefined,
              experienciaMarketing: lead.experienciaMarketing || undefined,
              orcamentoAnuncios: lead.orcamentoAnuncios || undefined,
              principalDesafio: lead.principalDesafio || undefined,
              disponibilidade: lead.disponibilidade || undefined,
              expectativaResultado: lead.expectativaResultado || undefined,
              ...(lead.customAnswers || {}),
            };

            for (const question of formConfig.questions) {
              if (question.ghlFieldId && allAnswers[question.id]) {
                customFields.push({
                  id: question.ghlFieldId,
                  field_value: allAnswers[question.id]!,
                });
              }
            }

            const contactResult = await getOrCreateGHLContact(
              ghlSettings.apiKey,
              ghlSettings.locationId,
              {
                email: lead.email || '',
                firstName,
                lastName,
                phone: lead.telefone || '',
                address: lead.cidadeEstado || undefined,
                customFields: customFields.length > 0 ? customFields : undefined,
              }
            );

            if (contactResult.success && contactResult.contactId) {
              await storage.updateFormLead(lead.id, { ghlContactId: contactResult.contactId, ghlSyncStatus: 'synced' });
              ghlContactId = contactResult.contactId;
            }
          }
        } catch (err) {
          console.error('GHL sync error:', err);
          await storage.updateFormLead(lead.id, { ghlSyncStatus: 'failed' });
        }

        return {
          success: true,
          classification: lead.classificacao,
          score: lead.scoreTotal,
          ghlContactId,
        };
      }

      case 'search_knowledge_base': {
        if (options?.allowKnowledgeBase === false) {
          return { error: 'Knowledge base is disabled for this chat.' };
        }
        const query = (args?.query as string | undefined)?.toLowerCase?.()?.trim();
        const docs = await storage.getLinkedKnowledgeBaseDocuments();
        if (!docs.length) {
          return { documents: [], message: 'No linked knowledge base documents available.' };
        }

        const filtered = query
          ? docs.filter(doc =>
            doc.title.toLowerCase().includes(query) ||
            doc.content.toLowerCase().includes(query) ||
            doc.categoryName.toLowerCase().includes(query)
          )
          : docs;

        return {
          documents: filtered.slice(0, 8).map(doc => ({
            id: doc.id,
            title: doc.title,
            category: doc.categoryName,
            content: doc.content,
          })),
          searchQuery: query,
        };
      }

      case 'search_faqs': {
        if (options?.allowFaqs === false) {
          return { error: 'FAQ search is disabled for this chat.' };
        }
        const query = (args?.query as string | undefined)?.toLowerCase?.()?.trim();
        const allFaqs = await storage.getFaqs();

        if (!query) {
          return {
            faqs: allFaqs.map(faq => ({
              question: faq.question,
              answer: faq.answer,
            })),
          };
        }

        const filtered = allFaqs.filter(faq =>
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query)
        );

        return {
          faqs: filtered.map(faq => ({
            question: faq.question,
            answer: faq.answer,
          })),
          searchQuery: query,
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

  // Register upload/storage routes (environment-aware: Replit Object Storage or Supabase Storage)
  await registerStorageRoutes(app, requireAdmin);

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

  // Form Config (public GET, admin PUT)
  app.get('/api/form-config', async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      const existing = settings?.formConfig || DEFAULT_FORM_CONFIG;
      const spec = DEFAULT_FORM_CONFIG;
      const specById = new Map(spec.questions.map(q => [q.id, q]));

      // 1) Normalize known questions to spec (text, type, options, placeholders)
      let normalizedQuestions = existing.questions.map(q => {
        const specQ = specById.get(q.id);
        if (!specQ) return q;
        return {
          ...q,
          title: specQ.title,
          type: specQ.type,
          required: specQ.required,
          placeholder: specQ.placeholder,
          options: specQ.options,
          conditionalField: specQ.conditionalField,
        };
      });

      // 1.1) Add missing spec questions that are not present in existing config
      for (const specQ of spec.questions) {
        if (!normalizedQuestions.some(q => q.id === specQ.id)) {
          normalizedQuestions.push({ ...specQ });
        }
      }

      // 2) Merge standalone conditional questions back into their parent
      const idxLocalizacao = normalizedQuestions.findIndex(q => q.id === 'localizacao');
      if (idxLocalizacao >= 0) {
        const hasStandaloneCidadeEstado = normalizedQuestions.some(q => q.id === 'cidadeEstado');
        if (hasStandaloneCidadeEstado) {
          normalizedQuestions = normalizedQuestions.filter(q => q.id !== 'cidadeEstado');
          const specLocalizacao = specById.get('localizacao');
          if (specLocalizacao?.conditionalField) {
            normalizedQuestions[idxLocalizacao] = {
              ...normalizedQuestions[idxLocalizacao],
              conditionalField: {
                showWhen: specLocalizacao.conditionalField.showWhen,
                id: specLocalizacao.conditionalField.id,
                title: specLocalizacao.conditionalField.title,
                placeholder: specLocalizacao.conditionalField.placeholder,
              },
            };
          }
        } else {
          // Ensure conditional field is present even if never existed
          const specLocalizacao = specById.get('localizacao');
          if (specLocalizacao?.conditionalField) {
            normalizedQuestions[idxLocalizacao] = {
              ...normalizedQuestions[idxLocalizacao],
              conditionalField: specLocalizacao.conditionalField,
            };
          }
        }
      }

      const idxTipoNegocio = normalizedQuestions.findIndex(q => q.id === 'tipoNegocio');
      if (idxTipoNegocio >= 0) {
        const hasStandaloneOutro = normalizedQuestions.some(q => q.id === 'tipoNegocioOutro');
        if (hasStandaloneOutro) {
          normalizedQuestions = normalizedQuestions.filter(q => q.id !== 'tipoNegocioOutro');
          const specTipo = specById.get('tipoNegocio');
          if (specTipo?.conditionalField) {
            normalizedQuestions[idxTipoNegocio] = {
              ...normalizedQuestions[idxTipoNegocio],
              conditionalField: {
                showWhen: specTipo.conditionalField.showWhen,
                id: specTipo.conditionalField.id,
                title: specTipo.conditionalField.title,
                placeholder: specTipo.conditionalField.placeholder,
              },
            };
          }
        } else {
          const specTipo = specById.get('tipoNegocio');
          if (specTipo?.conditionalField) {
            normalizedQuestions[idxTipoNegocio] = {
              ...normalizedQuestions[idxTipoNegocio],
              conditionalField: specTipo.conditionalField,
            };
          }
        }
      }

      // 3) Sort known spec questions by spec order; unknowns follow after in their current order
      const isKnown = (qId: string) => specById.has(qId);
      normalizedQuestions = normalizedQuestions
        .sort((a, b) => {
          const aKnown = isKnown(a.id);
          const bKnown = isKnown(b.id);
          if (aKnown && bKnown) {
            const aSpec = specById.get(a.id)!.order;
            const bSpec = specById.get(b.id)!.order;
            return aSpec - bSpec;
          }
          if (aKnown && !bKnown) return -1;
          if (!aKnown && bKnown) return 1;
          return (a.order ?? 999) - (b.order ?? 999);
        })
        .map((q, i) => ({ ...q, order: i + 1 }));

      const normalizedConfig = {
        questions: normalizedQuestions,
        maxScore: calculateMaxScore({ ...existing, questions: normalizedQuestions }),
        thresholds: existing.thresholds || spec.thresholds,
      };
      res.json(normalizedConfig);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/form-config', requireAdmin, async (req, res) => {
    try {
      const config = req.body as FormConfig;

      // Validate basic structure
      if (!config.questions || !Array.isArray(config.questions)) {
        return res.status(400).json({ message: 'Invalid config: questions array required' });
      }

      // Recalculate maxScore based on options
      const maxScore = calculateMaxScore(config);
      const updatedConfig: FormConfig = {
        ...config,
        maxScore,
      };

      await storage.updateCompanySettings({ formConfig: updatedConfig });
      res.json(updatedConfig);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Form Leads
  app.get('/api/form-leads/:sessionId', async (req, res) => {
    const lead = await storage.getFormLeadBySession(req.params.sessionId);
    if (!lead) {
      return res.status(404).json({ message: 'Lead não encontrado' });
    }
    res.json(lead);
  });

  app.post('/api/form-leads/progress', async (req, res) => {
    try {
      const parsed = formLeadProgressSchema.parse(req.body);
      const settings = await storage.getCompanySettings();
      const formConfig = settings?.formConfig || DEFAULT_FORM_CONFIG;
      const companyName = settings?.companyName || 'Skale Club';
      const totalQuestions = formConfig.questions.length || DEFAULT_FORM_CONFIG.questions.length;
      const questionNumber = Math.min(parsed.questionNumber, totalQuestions);
      const payload = {
        ...parsed,
        questionNumber,
        formCompleto: parsed.formCompleto || questionNumber >= totalQuestions,
      };
      let lead = await storage.upsertFormLeadProgress(payload, { userAgent: req.get('user-agent') || undefined }, formConfig);

      const hasPhone = !!lead.telefone?.trim();
      if (hasPhone && !lead.notificacaoEnviada) {
        try {
          const twilioSettings = await storage.getTwilioSettings();
          if (twilioSettings) {
            const notifyResult = await sendHotLeadNotification(twilioSettings, lead, companyName);
            if (notifyResult.success) {
              const updated = await storage.updateFormLead(lead.id, { notificacaoEnviada: true });
              lead = updated || { ...lead, notificacaoEnviada: true };
            }
          }
        } catch (notificationError) {
          console.error('Lead notification error:', notificationError);
        }
      }

      if (lead.formCompleto) {
        try {
          const ghlSettings = await storage.getIntegrationSettings('gohighlevel');
          // GHL sync requires at least phone number
          if (ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.locationId && lead.telefone) {
            const nameParts = (lead.nome || '').trim().split(' ').filter(Boolean);
            const firstName = nameParts.shift() || lead.nome || 'Lead';
            const lastName = nameParts.join(' ');

            // Build custom fields from form config mappings
            const customFields: Array<{ id: string; field_value: string }> = [];
            const allAnswers: Record<string, string | undefined> = {
              nome: lead.nome || undefined,
              email: lead.email || undefined,
              telefone: lead.telefone || undefined,
              cidadeEstado: lead.cidadeEstado || undefined,
              tipoNegocio: lead.tipoNegocio || undefined,
              tipoNegocioOutro: lead.tipoNegocioOutro || undefined,
              tempoNegocio: lead.tempoNegocio || undefined,
              experienciaMarketing: lead.experienciaMarketing || undefined,
              orcamentoAnuncios: lead.orcamentoAnuncios || undefined,
              principalDesafio: lead.principalDesafio || undefined,
              disponibilidade: lead.disponibilidade || undefined,
              expectativaResultado: lead.expectativaResultado || undefined,
              ...(lead.customAnswers || {}),
            };

            // Map form questions with ghlFieldId to custom fields
            for (const question of formConfig.questions) {
              if (question.ghlFieldId && allAnswers[question.id]) {
                customFields.push({
                  id: question.ghlFieldId,
                  field_value: allAnswers[question.id]!,
                });
              }
              // Also check conditional field
              if (question.conditionalField?.id && allAnswers[question.conditionalField.id]) {
                // For conditional fields, use parent's ghlFieldId if set (or a custom one if we add it later)
                // For now, skip conditional fields as they don't have their own ghlFieldId
              }
            }

            const contactResult = await getOrCreateGHLContact(
              ghlSettings.apiKey,
              ghlSettings.locationId,
              {
                email: lead.email || '',
                firstName,
                lastName,
                phone: lead.telefone || '',
                address: lead.cidadeEstado || undefined,
                customFields: customFields.length > 0 ? customFields : undefined,
              }
            );

            if (contactResult.success && contactResult.contactId) {
              const synced = await storage.updateFormLead(lead.id, { ghlContactId: contactResult.contactId, ghlSyncStatus: 'synced' });
              if (synced) {
                lead = synced;
              }
            } else if (lead.ghlSyncStatus !== 'synced') {
              await storage.updateFormLead(lead.id, { ghlSyncStatus: 'failed' });
            }
          }
        } catch (ghlError) {
          console.log('GHL lead sync error (non-blocking):', ghlError);
          try {
            await storage.updateFormLead(lead.id, { ghlSyncStatus: 'failed' });
          } catch {
            // ignore best-effort update
          }
        }
      }
      res.json(lead);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors?.[0]?.message || 'Erro de validação' });
      }
      if (err?.code === '23505') {
        const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : null;
        if (sessionId) {
          const existing = await storage.getFormLeadBySession(sessionId);
          if (existing) {
            return res.json(existing);
          }
        }
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.get('/api/form-leads', requireAdmin, async (req, res) => {
    try {
      const parsed = api.formLeads.list.input ? api.formLeads.list.input.parse(req.query) : {};
      const filters = (parsed || {}) as { status?: LeadStatus; classificacao?: LeadClassification; formCompleto?: boolean; search?: string };
      const leads = await storage.listFormLeads(filters);
      res.json(leads);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid filters', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.patch('/api/form-leads/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: 'Invalid lead id' });
      }
      const updates = api.formLeads.update.input.parse(req.body) as { status?: LeadStatus; observacoes?: string; notificacaoEnviada?: boolean };
      const updated = await storage.updateFormLead(id, updates);
      if (!updated) {
        return res.status(404).json({ message: 'Lead not found' });
      }
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete('/api/form-leads/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid lead id' });
    const deleted = await storage.deleteFormLead(id);
    if (!deleted) return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Lead deleted' });
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
      const defaultName = company?.companyName || 'Skale Club Assistant';
      const fallbackName =
        settings.agentName && settings.agentName !== 'Skale Club Assistant'
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
        avgResponseTime: settings.avgResponseTime || '',
        languageSelectorEnabled: settings.languageSelectorEnabled ?? false,
        defaultLanguage: settings.defaultLanguage || 'en',
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

  app.get('/api/chat/response-time', requireAdmin, async (_req, res) => {
    try {
      const conversations = await storage.listConversations();
      let totalMs = 0;
      let samples = 0;

      for (const conversation of conversations) {
        const messages = await storage.getConversationMessages(conversation.id);
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (msg.role !== 'visitor') continue;
          const nextAssistant = messages.slice(i + 1).find((m) => m.role === 'assistant');
          if (!nextAssistant || !msg.createdAt || !nextAssistant.createdAt) continue;
          const start = new Date(msg.createdAt).getTime();
          const end = new Date(nextAssistant.createdAt).getTime();
          if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
          if (end < start) continue;
          totalMs += end - start;
          samples += 1;
        }
      }

      const avgSeconds = samples ? Math.round(totalMs / samples / 1000) : 0;
      const minutes = Math.floor(avgSeconds / 60);
      const seconds = avgSeconds % 60;
      const formatted = samples
        ? minutes > 0
          ? `${minutes}m ${seconds}s`
          : `${seconds}s`
        : 'No responses yet';

      const chatSettings = await storage.getChatSettings();
      if (chatSettings.lowPerformanceSmsEnabled && samples > 0) {
        const threshold = chatSettings.lowPerformanceThresholdSeconds || 300;
        const cooldownMs = 6 * 60 * 60 * 1000;
        const now = Date.now();
        const canAlert = !lastLowPerformanceAlertAt || now - lastLowPerformanceAlertAt > cooldownMs;
        if (avgSeconds >= threshold && canAlert) {
          const twilioSettings = await storage.getTwilioSettings();
          if (twilioSettings) {
            const company = await storage.getCompanySettings();
            const companyName = company?.companyName || 'Skale Club';
            const result = await sendLowPerformanceAlert(twilioSettings, avgSeconds, samples, companyName);
            if (result.success) {
              lastLowPerformanceAlertAt = now;
            }
          }
        }
      }

      res.json({ averageSeconds: avgSeconds, formatted, samples });
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
          useKnowledgeBase: z.boolean().optional(),
          useFaqs: z.boolean().optional(),
          calendarProvider: z.string().optional(),
          calendarId: z.string().optional(),
          calendarStaff: z.array(z.object({
            name: z.string(),
            calendarId: z.string(),
          })).optional(),
          languageSelectorEnabled: z.boolean().optional(),
          defaultLanguage: z.string().optional(),
          lowPerformanceSmsEnabled: z.boolean().optional(),
          lowPerformanceThresholdSeconds: z.number().int().positive().optional(),
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
        const company = await storage.getCompanySettings();
        const companyName = company?.companyName || 'Skale Club';
        const twilioSettings = await storage.getTwilioSettings();
        if (twilioSettings && isNewConversation) {
          sendNewChatNotification(twilioSettings, conversationId, input.pageUrl, companyName).catch(err => {
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
          language: input.language,
        },
      });

      const company = await storage.getCompanySettings();
      const history = await storage.getConversationMessages(conversationId);
      const historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = history.map((m) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content,
      }));

      // Lead qualification uses dynamic form config instead of static intake objectives
      const objectivesText = 'IMPORTANT: Use get_form_config and get_lead_state at the start to know which questions to ask. Follow the form configuration order. Save each answer with save_lead_answer before asking the next question.';
      const allowKnowledgeBase = settings.useKnowledgeBase !== false;
      const allowFaqs = settings.useFaqs !== false;
      const sourceRules = `SOURCES:
- Knowledge base is ${allowKnowledgeBase ? 'enabled' : 'disabled'}. ${allowKnowledgeBase ? 'Use search_knowledge_base for company-specific policies, prep instructions, service coverage, and internal knowledge.' : 'Do not call search_knowledge_base.'}
- FAQs are ${allowFaqs ? 'enabled' : 'disabled'}. ${allowFaqs ? 'If the knowledge base has no relevant info, use search_faqs for general policies, process, products, guarantees, cancellation, payment methods, and common questions.' : 'Do not call search_faqs.'}`;
      const languageInstruction = input.language
        ? `LANGUAGE:\n- Respond in ${input.language}.`
        : '';

      const defaultSystemPrompt = `You are a friendly, consultative lead qualification assistant for ${company?.companyName || 'Skale Club'}, a digital marketing agency that helps service businesses grow.

YOUR GOAL:
Qualify potential clients by collecting information through a natural conversation. Ask questions from the form configuration one at a time, in order.

STARTUP FLOW:
1. Call get_form_config to get the qualification questions
2. Call get_lead_state to check what info has already been collected
3. Start with a warm greeting and ask the first unanswered question

CONVERSATION FLOW:
- Ask one question at a time, conversationally
- After each answer, call save_lead_answer with the question_id and answer
- The tool returns the next question to ask - follow that order
- For select/multiple choice questions, present options naturally
- If the user's answer is unclear, clarify before saving
- When isComplete is true, call complete_lead to sync to CRM

FINALIZATION (after complete_lead):
Based on the classification returned:
- QUENTE (Hot): "Excelente! Um especialista entrará em contato em até 24 horas para discutir como podemos ajudar seu negócio a crescer!"
- MORNO (Warm): "Obrigado pelas informações! Vamos analisar seu perfil e entrar em contato em breve."
- FRIO (Cold): "Obrigado pelo interesse! Vamos enviar alguns conteúdos úteis para você."

SOURCES:
${allowKnowledgeBase ? '- Knowledge base is enabled. Use search_knowledge_base for company-specific information.' : ''}
${allowFaqs ? '- FAQs are enabled. Use search_faqs for common questions about Skale Club services.' : ''}

TOOLS:
- get_form_config: Get the qualification questions (call at start)
- get_lead_state: Check current progress and next question
- save_lead_answer: Save each answer and get next question
- complete_lead: Finalize lead and sync to CRM
- search_knowledge_base: For company-specific info${!allowKnowledgeBase ? ' (disabled)' : ''}
- search_faqs: For common questions${!allowFaqs ? ' (disabled)' : ''}

RULES:
- Keep responses concise (1-2 sentences)
- Be warm and professional, not robotic
- Never skip questions or change the order
- Support Portuguese, English, and Spanish - respond in the user's language
- If user asks about Skale Club services, answer then return to qualification
- Don't make up information - use search tools when needed

EXAMPLE CONVERSATION:

You: "Olá! Sou o assistente da Skale Club. Estamos aqui para ajudar seu negócio a crescer! Para começar, qual é o seu nome completo?"
User: "João Silva"
[Call save_lead_answer with question_id="nome", answer="João Silva"]
You: "Prazer, João! Qual é o seu email?"
User: "joao@email.com"
[Call save_lead_answer with question_id="email", answer="joao@email.com"]
You: "Ótimo! E qual é o seu número de WhatsApp?"
[Continue through all questions...]
[When complete, call complete_lead]
You: "Excelente, João! Um especialista entrará em contato em até 24 horas para discutir como podemos ajudar seu negócio a crescer!"`;
      const systemPrompt = settings.systemPrompt || defaultSystemPrompt;

      const chatMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'system',
          content: sourceRules,
        },
        ...(languageInstruction ? [{ role: 'system', content: languageInstruction } as const] : []),
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
            const toolResult = await runChatTool(call.function.name, args, conversationId, {
              allowFaqs,
              allowKnowledgeBase,
            });

            // Track lead capture (first time contact info is saved)
            if (call.function.name === 'update_contact' && toolResult.success) {
              const conv = await storage.getConversation(conversationId);
              if (conv?.visitorName || conv?.visitorEmail || conv?.visitorPhone) {
                leadCaptured = true;
              }
            }

            // Track lead completion
            if (call.function.name === 'complete_lead' && toolResult.success) {
              leadCaptured = true;
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

  // Get GHL custom fields (for mapping form fields)
  app.get('/api/integrations/ghl/custom-fields', requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings('gohighlevel');

      if (!settings?.isEnabled || !settings.apiKey || !settings.locationId) {
        return res.status(400).json({
          success: false,
          message: 'GHL não está configurado. Configure a API Key e Location ID primeiro.'
        });
      }

      const result = await getGHLCustomFields(settings.apiKey, settings.locationId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Erro ao buscar custom fields'
      });
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

  const cleanPhone = (value?: string | null): string =>
    (value || "").toString().replace(/[\s()-]/g, "").trim();

  const parseRecipients = (numbers?: string[] | null, fallback?: string | null): string[] => {
    const recipients: string[] = [];
    const push = (val?: string | null) => {
      const cleaned = cleanPhone(val);
      if (cleaned) recipients.push(cleaned);
    };

    if (Array.isArray(numbers)) {
      for (const num of numbers) push(num);
    }
    push(fallback);

    return Array.from(new Set(recipients));
  };

  const twilioSettingsSchema = z.object({
    accountSid: z.string().trim().optional(),
    authToken: z.string().trim().optional(),
    fromPhoneNumber: z.string().trim().optional(),
    toPhoneNumber: z.string().trim().optional(),
    toPhoneNumbers: z.array(z.string().trim()).optional(),
    notifyOnNewChat: z.boolean().optional(),
    enabled: z.boolean().optional(),
  });

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
          toPhoneNumbers: [],
          notifyOnNewChat: true
        });
      }
      const recipients = parseRecipients(settings.toPhoneNumbers as string[] | undefined, settings.toPhoneNumber);
      res.json({
        ...settings,
        toPhoneNumbers: recipients,
        toPhoneNumber: recipients[0] || '',
        authToken: settings.authToken ? '********' : ''
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Save Twilio settings
  app.put('/api/integrations/twilio', requireAdmin, async (req, res) => {
    try {
      const parsed = twilioSettingsSchema.parse(req.body);
      const existingSettings = await storage.getTwilioSettings();

      const accountSid = parsed.accountSid?.trim() || existingSettings?.accountSid;
      const fromPhoneNumber = parsed.fromPhoneNumber?.trim() || existingSettings?.fromPhoneNumber;
      const toPhoneNumbers = parseRecipients(
        parsed.toPhoneNumbers,
        parsed.toPhoneNumber || existingSettings?.toPhoneNumber
      );
      const tokenFromRequest = parsed.authToken && parsed.authToken !== '********'
        ? parsed.authToken.trim()
        : undefined;
      const authTokenToPersist = tokenFromRequest || existingSettings?.authToken;
      const enabled = parsed.enabled ?? existingSettings?.enabled ?? false;

      if (enabled && (!accountSid || !authTokenToPersist || !fromPhoneNumber || !toPhoneNumbers.length)) {
        return res.status(400).json({ message: 'All Twilio fields are required to enable notifications' });
      }

      const settingsToSave: any = {
        accountSid,
        fromPhoneNumber,
        toPhoneNumber: toPhoneNumbers[0] || null,
        toPhoneNumbers,
        notifyOnNewChat: parsed.notifyOnNewChat ?? existingSettings?.notifyOnNewChat ?? true,
        enabled
      };

      // Only update authToken if a new one is provided (not masked)
      if (tokenFromRequest) {
        settingsToSave.authToken = tokenFromRequest;
      } else if (existingSettings?.authToken) {
        settingsToSave.authToken = existingSettings.authToken;
      }

      const settings = await storage.saveTwilioSettings(settingsToSave);

      res.json({
        ...settings,
        authToken: settings.authToken ? '********' : ''
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid Twilio settings payload', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // Test Twilio connection
  app.post('/api/integrations/twilio/test', requireAdmin, async (req, res) => {
    try {
      const parsed = twilioSettingsSchema.parse(req.body);
      const existingSettings = await storage.getTwilioSettings();

      const accountSid = parsed.accountSid?.trim() || existingSettings?.accountSid;
      const fromPhoneNumber = parsed.fromPhoneNumber?.trim() || existingSettings?.fromPhoneNumber;
      const toPhoneNumbers = parseRecipients(
        parsed.toPhoneNumbers,
        parsed.toPhoneNumber || existingSettings?.toPhoneNumber
      );
      const tokenToTest = parsed.authToken && parsed.authToken !== '********'
        ? parsed.authToken.trim()
        : existingSettings?.authToken;

      if (!accountSid || !tokenToTest || !fromPhoneNumber || !toPhoneNumbers.length) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required to test Twilio connection'
        });
      }

      const company = await storage.getCompanySettings();
      const companyName = company?.companyName || 'Skale Club';

      // Send test SMS using Twilio
      const twilio = await import('twilio');
      const client = twilio.default(accountSid, tokenToTest);

      for (const to of toPhoneNumbers) {
        await client.messages.create({
          body: `Test message from ${companyName} - Your Twilio integration is working!`,
          from: fromPhoneNumber,
          to
        });
      }

      res.json({
        success: true,
        message: 'Test SMS sent successfully!'
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid Twilio test payload',
          errors: err.errors
        });
      }
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

  app.delete('/api/blog/tags/:tag', requireAdmin, async (req, res) => {
    try {
      const rawTag = decodeURIComponent(req.params.tag || '').trim();
      if (!rawTag) {
        return res.status(400).json({ message: 'Tag is required' });
      }
      const posts = await storage.getBlogPosts();
      const target = rawTag.toLowerCase();
      let updatedCount = 0;
      for (const post of posts) {
        const tags = (post.tags || '')
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean);
        if (!tags.length) continue;
        const filtered = tags.filter(tag => tag.toLowerCase() !== target);
        if (filtered.length !== tags.length) {
          await storage.updateBlogPost(post.id, { tags: filtered.join(',') });
          updatedCount += 1;
        }
      }
      res.json({ success: true, tag: rawTag, updatedCount });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put('/api/blog/tags/:tag', requireAdmin, async (req, res) => {
    try {
      const rawTag = decodeURIComponent(req.params.tag || '').trim();
      const nextTag = String(req.body?.name || '').trim();
      if (!rawTag || !nextTag) {
        return res.status(400).json({ message: 'Tag and new name are required' });
      }
      const fromLower = rawTag.toLowerCase();
      const toLower = nextTag.toLowerCase();
      const posts = await storage.getBlogPosts();
      let updatedCount = 0;

      for (const post of posts) {
        const tags = (post.tags || '')
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean);
        if (!tags.length) continue;

        const seen = new Set<string>();
        let changed = false;
        const nextTags: string[] = [];

        for (const tag of tags) {
          const lower = tag.toLowerCase();
          if (lower === fromLower) {
            changed = true;
            if (!seen.has(toLower)) {
              seen.add(toLower);
              nextTags.push(nextTag);
            }
            continue;
          }
          if (!seen.has(lower)) {
            seen.add(lower);
            nextTags.push(tag);
          }
        }

        if (changed) {
          await storage.updateBlogPost(post.id, { tags: nextTags.join(',') });
          updatedCount += 1;
        }
      }

      res.json({ success: true, tag: rawTag, renamedTo: nextTag, updatedCount });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
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

  // Knowledge Base (admin CRUD)
  app.get('/api/knowledge-base/categories', requireAdmin, async (req, res) => {
    try {
      const categories = await storage.getKnowledgeBaseCategories();
      res.json(categories);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get('/api/knowledge-base/categories/:id', requireAdmin, async (req, res) => {
    try {
      const category = await storage.getKnowledgeBaseCategory(Number(req.params.id));
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
      res.json(category);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post('/api/knowledge-base/categories', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertKnowledgeBaseCategorySchema.parse(req.body);
      const category = await storage.createKnowledgeBaseCategory(validatedData);
      res.status(201).json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put('/api/knowledge-base/categories/:id', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertKnowledgeBaseCategorySchema.partial().parse(req.body);
      const category = await storage.updateKnowledgeBaseCategory(Number(req.params.id), validatedData);
      res.json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete('/api/knowledge-base/categories/:id', requireAdmin, async (req, res) => {
    try {
      await storage.deleteKnowledgeBaseCategory(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.get('/api/knowledge-base/articles', requireAdmin, async (req, res) => {
    try {
      const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
      const articles = await storage.getKnowledgeBaseArticles(categoryId);
      res.json(articles);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.get('/api/knowledge-base/articles/:id', requireAdmin, async (req, res) => {
    try {
      const article = await storage.getKnowledgeBaseArticle(Number(req.params.id));
      if (!article) {
        return res.status(404).json({ message: 'Article not found' });
      }
      res.json(article);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.post('/api/knowledge-base/articles', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertKnowledgeBaseArticleSchema.parse(req.body);
      const article = await storage.createKnowledgeBaseArticle(validatedData);
      res.status(201).json(article);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.put('/api/knowledge-base/articles/:id', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertKnowledgeBaseArticleSchema.partial().parse(req.body);
      const article = await storage.updateKnowledgeBaseArticle(Number(req.params.id), validatedData);
      res.json(article);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.delete('/api/knowledge-base/articles/:id', requireAdmin, async (req, res) => {
    try {
      await storage.deleteKnowledgeBaseArticle(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.post('/api/knowledge-base/categories/:id/link-assistant', requireAdmin, async (req, res) => {
    try {
      const { isLinked } = req.body;
      await storage.toggleKnowledgeBaseCategoryAssistantLink(Number(req.params.id), isLinked);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  app.get('/api/knowledge-base/categories/:id/link-assistant', requireAdmin, async (req, res) => {
    try {
      const isLinked = await storage.getKnowledgeBaseCategoryAssistantLink(Number(req.params.id));
      res.json({ isLinked });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
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
