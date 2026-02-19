import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage.js";
import { api } from "#shared/routes.js";
import { z } from "zod";
import OpenAI from "openai";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getGeminiClient } from "./lib/gemini.js";
import { getActiveAIClient, setRuntimeOpenAiKey, setRuntimeGeminiKey, getRuntimeOpenAiKey, getRuntimeGeminiKey } from "./lib/ai-provider.js";
import { insertCompanySettingsSchema, insertFaqSchema, insertIntegrationSettingsSchema, insertBlogPostSchema, insertChatSettingsSchema, insertChatIntegrationsSchema, formLeadProgressSchema } from "#shared/schema.js";
import type { LeadClassification, LeadStatus } from "#shared/schema.js";
import { DEFAULT_FORM_CONFIG, calculateMaxScore, calculateFormScoresWithConfig, classifyLead, getSortedQuestions, KNOWN_FIELD_IDS } from "#shared/form.js";
import type { FormAnswers } from "#shared/form.js";
import type { FormConfig } from "#shared/schema.js";
import { testGHLConnection, getOrCreateGHLContact, getGHLCustomFields } from "./integrations/ghl.js";
import { sendHotLeadNotification, sendLowPerformanceAlert, sendNewChatNotification } from "./integrations/twilio.js";
import { registerStorageRoutes } from "./storage/storageAdapter.js";
import { db } from "./db.js";
import { users, systemHeartbeats } from "#shared/schema.js";
import { eq, sql } from "drizzle-orm";

const isReplit = !!process.env.REPL_ID;

function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;
  const hasVercelCronHeader = typeof req.headers["x-vercel-cron"] === "string";

  if (cronSecret) {
    return bearerToken === cronSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return hasVercelCronHeader;
}

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
  app.get('/api/cron/supabase-keepalive', async (req, res) => {
    if (!isAuthorizedCronRequest(req)) {
      return res.status(401).json({ message: 'Unauthorized cron request' });
    }

    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
    const isSupabaseDatabase = databaseUrl.includes('.supabase.');
    if (!isSupabaseDatabase) {
      return res.json({
        ok: true,
        skipped: true,
        reason: 'DATABASE_URL is not Supabase',
      });
    }

    try {
      await db.execute(sql`select now()`);
      const [heartbeat] = await db
        .insert(systemHeartbeats)
        .values({
          source: 'vercel-cron',
          note: 'supabase-keepalive',
        })
        .returning({
          id: systemHeartbeats.id,
          createdAt: systemHeartbeats.createdAt,
        });

      return res.json({
        ok: true,
        heartbeatId: heartbeat?.id ?? null,
        createdAt: heartbeat?.createdAt ?? null,
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: (error as Error).message,
      });
    }
  });

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
  let runtimeGeminiKey = process.env.GEMINI_API_KEY || "";

  // Initialize runtime keys in the ai-provider module
  if (runtimeOpenAiKey) setRuntimeOpenAiKey(runtimeOpenAiKey);
  if (runtimeGeminiKey) setRuntimeGeminiKey(runtimeGeminiKey);

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
        name: "search_faqs",
        description: "Search frequently asked questions database to answer questions about services, pricing, process, and other common inquiries",
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
    const key = apiKey || getRuntimeOpenAiKey() || runtimeOpenAiKey || process.env.OPENAI_API_KEY;
    if (!key) return null;
    return new OpenAI({ apiKey: key });
  }

  function getGeminiOpenAIClient(apiKey?: string) {
    const key = apiKey || getRuntimeGeminiKey() || runtimeGeminiKey || process.env.GEMINI_API_KEY;
    if (!key) return null;
    return getGeminiClient(key);
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
    options?: { allowFaqs?: boolean }
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
            const companyName = settings?.companyName || 'My Company';
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
      const companyName = settings?.companyName || 'Company Name';
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
      const filters = (parsed || {}) as { status?: LeadStatus; classificacao?: LeadClassification; formCompleto?: boolean; completionStatus?: 'completo' | 'em_progresso' | 'abandonado'; search?: string };
      console.log('[form-leads] query:', req.query, 'parsed filters:', filters);
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
      const hostname = req.hostname || '';
      const canonicalUrl =
        settings?.seoCanonicalUrl ||
        `${req.protocol}://${hostname}`;
      
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
      const blogPostsList = await storage.getPublishedBlogPosts(100, 0);
      const hostname = req.hostname || '';
      const canonicalUrl =
        settings?.seoCanonicalUrl ||
        `${req.protocol}://${hostname}`;
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
    <loc>${canonicalUrl}/blog</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;

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

  // ===============================
  // Chat Routes
  // ===============================

  // Public chat configuration for widget
  app.get('/api/chat/config', async (_req, res) => {
    try {
      const settings = await storage.getChatSettings();
      const company = await storage.getCompanySettings();
      const defaultName = company?.companyName || 'Company Assistant';
      const fallbackName =
        settings.agentName && settings.agentName !== 'Company Assistant'
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
            const companyName = company?.companyName || 'Company Name';
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
          activeAiProvider: z.enum(['openai', 'gemini']).optional(),
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

      // Get active AI provider (OpenAI or Gemini)
      const aiConfig = await getActiveAIClient();
      if (!aiConfig) {
        return res.status(503).json({
          message: 'AI chat is not configured. Please enable an AI provider (OpenAI or Gemini) in Admin → Integrations.'
        });
      }

      const { client: openai, model, provider } = aiConfig;
      console.log(`Using ${provider} provider with model ${model}`);
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
      const allowFaqs = settings.useFaqs !== false;
      const sourceRules = `SOURCES:
- FAQs are ${allowFaqs ? 'enabled' : 'disabled'}. ${allowFaqs ? 'Use search_faqs for general policies, process, products, guarantees, cancellation, payment methods, and common questions.' : 'Do not call search_faqs.'}`;
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
${allowFaqs ? '- FAQs are enabled. Use search_faqs for common questions about our services.' : ''}

TOOLS:
- get_form_config: Get the qualification questions (call at start)
- get_lead_state: Check current progress and next question
- save_lead_answer: Save each answer and get next question
- complete_lead: Finalize lead and sync to CRM
- search_faqs: For common questions${!allowFaqs ? ' (disabled)' : ''}

RULES:
- Keep responses concise (1-2 sentences)
- Be warm and professional, not robotic
- Never skip questions or change the order
- Support Portuguese, English, and Spanish - respond in the user's language
- If user asks about our services, answer then return to qualification
- Don't make up information - use search tools when needed

EXAMPLE CONVERSATION:

You: "Olá! Sou o assistente virtual. Estamos aqui para ajudar seu negócio a crescer! Para começar, qual é o seu nome completo?"
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

      let assistantResponse = 'Sorry, I could not process that request.';
      let leadCaptured = false;

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
        leadCaptured
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
        hasKey: !!(getRuntimeOpenAiKey() || runtimeOpenAiKey || process.env.OPENAI_API_KEY || integration?.apiKey),
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
      const keyToPersist = providedKey ?? existing?.apiKey ?? getRuntimeOpenAiKey() ?? runtimeOpenAiKey ?? process.env.OPENAI_API_KEY;
      if (providedKey) {
        runtimeOpenAiKey = providedKey;
        setRuntimeOpenAiKey(providedKey);
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
      setRuntimeOpenAiKey(keyToUse);
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
  // Gemini Integration Routes
  // ===============================

  app.get('/api/integrations/gemini', requireAdmin, async (_req, res) => {
    try {
      const integration = await storage.getChatIntegration('gemini');
      res.json({
        provider: 'gemini',
        enabled: integration?.enabled || false,
        model: integration?.model || 'gemini-1.5-flash',
        hasKey: !!(getRuntimeGeminiKey() || runtimeGeminiKey || process.env.GEMINI_API_KEY || integration?.apiKey),
      });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/integrations/gemini', requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getChatIntegration('gemini');
      const payload = insertChatIntegrationsSchema
        .partial()
        .extend({
          apiKey: z.string().min(10).optional(),
        })
        .parse({ ...req.body, provider: 'gemini' });

      const providedKey = payload.apiKey && payload.apiKey !== '********' ? payload.apiKey : undefined;
      const keyToPersist = providedKey ?? existing?.apiKey ?? getRuntimeGeminiKey() ?? runtimeGeminiKey ?? process.env.GEMINI_API_KEY;
      if (providedKey) {
        runtimeGeminiKey = providedKey;
        setRuntimeGeminiKey(providedKey);
      }

      const willEnable = payload.enabled ?? false;
      const keyAvailable = !!keyToPersist;
      if (willEnable && !keyAvailable) {
        return res.status(400).json({ message: 'Provide a valid API key and test it before enabling.' });
      }

      const updated = await storage.upsertChatIntegration({
        provider: 'gemini',
        enabled: payload.enabled ?? false,
        model: payload.model || 'gemini-1.5-flash',
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

  app.post('/api/integrations/gemini/test', requireAdmin, async (req, res) => {
    try {
      const bodySchema = z.object({
        apiKey: z.string().min(10).optional(),
        model: z.string().optional(),
      });
      const { apiKey, model } = bodySchema.parse(req.body);
      const existing = await storage.getChatIntegration('gemini');
      const keyToUse =
        (apiKey && apiKey !== '********' ? apiKey : undefined) ||
        getRuntimeGeminiKey() ||
        runtimeGeminiKey ||
        process.env.GEMINI_API_KEY ||
        existing?.apiKey;

      if (!keyToUse) {
        return res.status(400).json({ success: false, message: 'API key is required' });
      }

      const client = getGeminiOpenAIClient(keyToUse);
      if (!client) {
        return res.status(400).json({ success: false, message: 'Invalid API key' });
      }

      try {
        await client.chat.completions.create({
          model: model || 'gemini-1.5-flash',
          messages: [{ role: 'user', content: 'Say pong' }],
          max_tokens: 5,
        });
      } catch (err: any) {
        const message = err?.message || 'Failed to test Gemini connection';
        const status = err?.status || err?.response?.status;
        return res.status(500).json({
          success: false,
          message: status ? `Gemini error (${status}): ${message}` : message,
        });
      }

      // Cache key in memory for runtime use
      runtimeGeminiKey = keyToUse;
      setRuntimeGeminiKey(keyToUse);
      await storage.upsertChatIntegration({
        provider: 'gemini',
        enabled: existing?.enabled ?? false,
        model: model || existing?.model || 'gemini-1.5-flash',
        apiKey: keyToUse,
      });

      res.json({ success: true, message: 'Connection successful' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Failed to test Gemini connection' });
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

  // ===============================
  // User Management Routes
  // ===============================

  // Get all users from Supabase Auth and local DB
  app.get('/api/users', requireAdmin, async (_req, res) => {
    try {
      const { getSupabaseAdmin } = await import('./lib/supabase.js');
      const supabaseAdmin = getSupabaseAdmin();
      
      // Fetch users from Supabase Auth
      const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers();
      
      if (error) {
        console.error('Error fetching users from Supabase:', error);
        return res.status(500).json({ message: 'Failed to fetch users from Supabase' });
      }

      // Fetch local user data (roles, names)
      const localUsers = await db.select().from(users);
      const localUserMap = new Map(localUsers.map(u => [u.id, u]));

      // Merge Supabase auth data with local DB data
      const mergedUsers = authUsers.users.map(authUser => {
        const localUser = localUserMap.get(authUser.id);
        return {
          id: authUser.id,
          email: authUser.email,
          firstName: localUser?.firstName ?? authUser.user_metadata?.first_name ?? '',
          lastName: localUser?.lastName ?? authUser.user_metadata?.last_name ?? '',
          profileImageUrl: localUser?.profileImageUrl ?? authUser.user_metadata?.avatar_url ?? '',
          isAdmin: localUser?.isAdmin || false,
          createdAt: authUser.created_at,
          lastSignInAt: authUser.last_sign_in_at,
          emailConfirmed: authUser.email_confirmed_at != null,
        };
      });

      res.json(mergedUsers);
    } catch (err) {
      console.error('Error in /api/users:', err);
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Update user
  app.patch('/api/users/:id', requireAdmin, async (req, res) => {
    try {
      const updateSchema = z.object({
        isAdmin: z.boolean().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        profileImageUrl: z.string().optional(),
      });
      const updates = updateSchema.parse(req.body);
      const userId = req.params.id;

      // Upsert local database record (insert if not exists, update if exists)
      const [existingUser] = await db.select().from(users).where(eq(users.id, userId));

      let localUser;
      if (existingUser) {
        const [updated] = await db
          .update(users)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(users.id, userId))
          .returning();
        localUser = updated;
      } else {
        // User exists in Supabase Auth but not in local DB — create local record
        let email: string | undefined;
        if (!isReplit) {
          const { getSupabaseAdmin } = await import("./lib/supabase.js");
          const supabase = getSupabaseAdmin();
          const { data: authUser } = await supabase.auth.admin.getUserById(userId);
          email = authUser?.user?.email ?? undefined;
        }

        const [newUser] = await db
          .insert(users)
          .values({
            id: userId,
            email: email ?? null,
            isAdmin: updates.isAdmin ?? false,
            firstName: updates.firstName ?? '',
            lastName: updates.lastName ?? '',
            profileImageUrl: updates.profileImageUrl ?? '',
          })
          .returning();
        localUser = newUser;
      }

      // Also update Supabase Auth user_metadata so GET /api/users picks up changes
      if (!isReplit) {
        try {
          const { getSupabaseAdmin } = await import("./lib/supabase.js");
          const supabase = getSupabaseAdmin();

          const metadata: Record<string, unknown> = {};
          if (updates.firstName !== undefined) metadata.first_name = updates.firstName;
          if (updates.lastName !== undefined) metadata.last_name = updates.lastName;
          if (updates.profileImageUrl !== undefined) metadata.avatar_url = updates.profileImageUrl;

          if (Object.keys(metadata).length > 0) {
            await supabase.auth.admin.updateUserById(userId, {
              user_metadata: metadata,
            });
          }
        } catch (metaErr) {
          console.error('[PATCH /api/users/:id] Failed to update Supabase metadata:', metaErr);
          // Non-fatal — local DB was already updated
        }
      }

      // Return merged data matching GET /api/users shape
      res.json({
        id: localUser.id,
        email: localUser.email,
        firstName: localUser.firstName,
        lastName: localUser.lastName,
        profileImageUrl: localUser.profileImageUrl,
        isAdmin: localUser.isAdmin,
        createdAt: localUser.createdAt,
      });
    } catch (err) {
      console.error('[PATCH /api/users/:id] Error:', err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Delete user
  app.delete('/api/users/:id', requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;

      // Delete from Supabase Auth
      const { getSupabaseAdmin } = await import('./lib/supabase.js');
      const supabaseAdmin = getSupabaseAdmin();
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        console.error('Error deleting user from Supabase:', error);
        return res.status(500).json({ message: 'Failed to delete user from Supabase' });
      }

      // Delete from local database
      await db.delete(users).where(eq(users.id, userId));

      res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  // Invite/create new user
  app.post('/api/users', requireAdmin, async (req, res) => {
    try {
      const { email, firstName, lastName, isAdmin: makeAdmin } = z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        isAdmin: z.boolean().default(false),
      }).parse(req.body);

      const { getSupabaseAdmin } = await import('./lib/supabase.js');
      const supabaseAdmin = getSupabaseAdmin();

      // Create user in Supabase Auth
      const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

      if (error) {
        console.error('Error creating user in Supabase:', error);
        return res.status(500).json({ message: error.message });
      }

      if (!authUser?.user) {
        return res.status(500).json({ message: 'Failed to create user' });
      }

      // Create user in local database
      const [newUser] = await db
        .insert(users)
        .values({
          id: authUser.user.id,
          email,
          firstName: firstName || '',
          lastName: lastName || '',
          isAdmin: makeAdmin,
        })
        .returning();

      res.status(201).json(newUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(500).json({ message: (err as Error).message });
    }
  });

  return httpServer;
}

