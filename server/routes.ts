import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { initializeSalesSchema, storage } from "./storage.js";
import { z } from "zod";
import OpenAI from "openai";
import crypto from "crypto";
import { getActiveAIClient } from "./lib/ai-provider.js";
import { insertChatSettingsSchema } from "#shared/schema.js";
import { DEFAULT_FORM_CONFIG, getSortedQuestions } from "#shared/form.js";
import type { FormAnswers } from "#shared/form.js";
import type { FormConfig } from "#shared/schema.js";
import { getOrCreateGHLContact } from "./integrations/ghl.js";
import { sendHotLeadNotification, sendLowPerformanceAlert, sendNewChatNotification } from "./integrations/twilio.js";
import { registerStorageRoutes } from "./storage/storageAdapter.js";
import { registerXpotRoutes } from "./routes/xpot/index.js";
import { registerPortfolioRoutes } from "./routes/portfolio.js";
import { registerFaqRoutes } from "./routes/faqs.js";
import { registerVCardRoutes } from "./routes/vcards.js";
import { registerBlogRoutes } from "./routes/blog.js";
import { registerTranslateRoutes } from "./routes/translate.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerCompanyRoutes } from "./routes/company.js";
import { registerFormRoutes } from "./routes/forms.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerEstimatesRoutes } from "./routes/estimates.js";
import { registerPresentationsRoutes } from "./routes/presentations.js";
import { registerUploadRoutes } from "./routes/uploads.js";
import { registerLinksPageRoutes } from "./routes/linksPage.js";
import { registerBrandGuidelinesRoutes } from "./routes/brandGuidelines.js";
import { registerPresentationsChatRoutes } from "./routes/presentationsChat.js";
import { registerBlogAutomationRoutes } from "./routes/blogAutomation.js";
import { db, pool } from "./db.js";
import { users } from "#shared/schema.js";
import { eq } from "drizzle-orm";


// Admin authentication middleware
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
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

function setPublicCache(res: Response, seconds: number) {
  res.set("Cache-Control", `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 12}`);
}


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
  registerXpotRoutes(app);
  registerPortfolioRoutes(app);
  registerFaqRoutes(app);
  registerVCardRoutes(app);
  registerBlogAutomationRoutes(app);
  registerBlogRoutes(app);
  registerTranslateRoutes(app);
  registerUserRoutes(app);
  registerCompanyRoutes(app);
  registerUploadRoutes(app);
  registerLinksPageRoutes(app);
  registerFormRoutes(app);
  registerIntegrationRoutes(app);
  registerEstimatesRoutes(app);
  registerPresentationsRoutes(app);
  registerBrandGuidelinesRoutes(app);
  registerPresentationsChatRoutes(app);
  await initializeSalesSchema();






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


  // M3-03: Resolve which form the chat widget should qualify leads with.
  // Precedence: chat_settings.form_slug (if active) → default form.
  // Returns a full Form row (caller uses .id and .config).
  async function resolveChatForm() {
    try {
      const chat = await storage.getChatSettings();
      if (chat?.formSlug) {
        const byslug = await storage.getFormBySlug(chat.formSlug);
        if (byslug && byslug.isActive) return byslug;
      }
    } catch {
      // Fall through to default
    }
    return storage.ensureDefaultForm();
  }

  // Helper to get or create a lead for a conversation
  async function getOrCreateLeadForConversation(conversationId: string): Promise<{ lead: any; formConfig: FormConfig }> {
    const chatForm = await resolveChatForm();
    const formConfig = (chatForm.config as FormConfig | null) || DEFAULT_FORM_CONFIG;

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
      }, { conversationId, source: 'chat', formId: chatForm.id }, formConfig);
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
        const chatForm = await resolveChatForm();
        const formConfig = (chatForm.config as FormConfig | null) || DEFAULT_FORM_CONFIG;
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

        const chatForm = await resolveChatForm();
        const formConfig = (chatForm.config as FormConfig | null) || DEFAULT_FORM_CONFIG;

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
            const companyName = (await storage.getCompanySettings())?.companyName || 'My Company';
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

        const chatForm = await resolveChatForm();
        const formConfig = (chatForm.config as FormConfig | null) || DEFAULT_FORM_CONFIG;
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
          const chatForm = await resolveChatForm();
          const formConfig = (chatForm.config as FormConfig | null) || DEFAULT_FORM_CONFIG;

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

      setPublicCache(res, 300);
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
      const statsResult = await pool.query<{ average_seconds: string | null; samples: string }>(`
        WITH ordered_messages AS (
          SELECT
            conversation_id,
            role,
            created_at,
            LEAD(role) OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_role,
            LEAD(created_at) OVER (PARTITION BY conversation_id ORDER BY created_at) AS next_created_at
          FROM conversation_messages
        )
        SELECT
          AVG(EXTRACT(EPOCH FROM (next_created_at - created_at))) AS average_seconds,
          COUNT(*)::text AS samples
        FROM ordered_messages
        WHERE role = 'visitor'
          AND next_role = 'assistant'
          AND next_created_at IS NOT NULL
      `);

      const statsRow = statsResult.rows[0];
      const samples = Number(statsRow?.samples || 0);
      const avgSeconds = samples ? Math.round(Number(statsRow?.average_seconds || 0)) : 0;
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
          activeAiProvider: z.enum(['openai', 'gemini', 'openrouter']).optional(),
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
      const result = await pool.query<{
        id: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        lastMessageAt: string | null;
        firstPageUrl: string | null;
        visitorName: string | null;
        visitorEmail: string | null;
        visitorPhone: string | null;
        lastMessage: string | null;
        lastMessageRole: string | null;
        messageCount: string;
      }>(`
        WITH message_counts AS (
          SELECT conversation_id, COUNT(*)::text AS message_count
          FROM conversation_messages
          GROUP BY conversation_id
        ),
        latest_messages AS (
          SELECT DISTINCT ON (conversation_id)
            conversation_id,
            content,
            role
          FROM conversation_messages
          ORDER BY conversation_id, created_at DESC
        )
        SELECT
          c.id,
          c.status,
          c.created_at AS "createdAt",
          c.updated_at AS "updatedAt",
          c.last_message_at AS "lastMessageAt",
          c.first_page_url AS "firstPageUrl",
          c.visitor_name AS "visitorName",
          c.visitor_email AS "visitorEmail",
          c.visitor_phone AS "visitorPhone",
          lm.content AS "lastMessage",
          lm.role AS "lastMessageRole",
          COALESCE(mc.message_count, '0') AS "messageCount"
        FROM conversations c
        LEFT JOIN message_counts mc ON mc.conversation_id = c.id
        LEFT JOIN latest_messages lm ON lm.conversation_id = c.id
        ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
      `);

      res.json(result.rows.map((row) => ({
        ...row,
        messageCount: Number(row.messageCount || 0),
      })));
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

      // Get active AI provider (OpenAI, Gemini, or OpenRouter)
      const aiConfig = await getActiveAIClient();
      if (!aiConfig) {
        return res.status(503).json({
          message: 'AI chat is not configured. Please enable an AI provider (OpenAI, Gemini, or OpenRouter) in Admin → Integrations.'
        });
      }

      const { client: openai, model, provider } = aiConfig;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Using ${provider} provider with model ${model}`);
      }
      const conversationId = input.conversationId || crypto.randomUUID();
      const company = await storage.getCompanySettings();
      const companyName = company?.companyName || 'Skale Club';

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

      const visitorMessageId = crypto.randomUUID();
      const visitorMessage = {
        id: visitorMessageId,
        conversationId,
        role: 'visitor',
        content: input.message.trim(),
        metadata: {
          pageUrl: input.pageUrl,
          userAgent: input.userAgent,
          visitorId: input.visitorId,
          language: input.language,
        },
      };
      await storage.addConversationMessage(visitorMessage);

      const historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [...existingMessages, visitorMessage].map((m) => ({
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

      const defaultSystemPrompt = `You are a friendly, consultative lead qualification assistant for ${companyName}, a digital marketing agency that helps service businesses grow.

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
- QUENTE (Hot): "Excellent! A specialist will contact you within 24 hours to discuss how we can help your business grow."
- MORNO (Warm): "Thanks for sharing those details! We'll review your profile and reach out soon."
- FRIO (Cold): "Thanks for your interest! We'll send over a few helpful resources for you."

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

You: "Hi! I'm the virtual assistant. We're here to help your business grow. To get started, what's your full name?"
User: "John Smith"
[Call save_lead_answer with question_id="nome", answer="John Smith"]
You: "Nice to meet you, John! What's your email?"
User: "john@email.com"
[Call save_lead_answer with question_id="email", answer="john@email.com"]
You: "Great! And what's your WhatsApp or mobile number?"
[Continue through all questions...]
[When complete, call complete_lead]
You: "Excellent, John! A specialist will contact you within 24 hours to discuss how we can help your business grow."`;
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

  return httpServer;
}

