import type { Express } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { systemHeartbeats } from "#shared/schema.js";
import { insertCompanySettingsSchema, formLeadProgressSchema } from "#shared/schema.js";
import type { FormConfig } from "#shared/schema.js";
import type { LeadClassification, LeadStatus } from "#shared/schema.js";
import { storage } from "../storage.js";
import { api } from "#shared/routes.js";
import { buildPagePaths, getPageSlugsValidationError, resolvePageSlugs } from "#shared/pageSlugs.js";
import { DEFAULT_FORM_CONFIG, calculateMaxScore, getSortedQuestions } from "#shared/form.js";
import { getOrCreateGHLContact } from "../integrations/ghl.js";
import { sendHotLeadNotification } from "../integrations/twilio.js";
import { requireAdmin, setPublicCache, isAuthorizedCronRequest } from "./_shared.js";

export function registerCompanyRoutes(app: Express) {
  // ===============================
  // Cron Routes
  // ===============================

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
          source: 'github-actions',
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

  // ===============================
  // Company Settings
  // ===============================

  app.get('/api/company-settings', async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      setPublicCache(res, 300);
      res.json(settings);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/company-settings', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCompanySettingsSchema.partial().parse(req.body);
      if (validatedData.pageSlugs) {
        const currentSettings = await storage.getCompanySettings();
        const mergedPageSlugs = resolvePageSlugs({
          ...(currentSettings.pageSlugs || {}),
          ...validatedData.pageSlugs,
        });
        const pageSlugError = getPageSlugsValidationError(mergedPageSlugs);
        if (pageSlugError) {
          return res.status(400).json({ message: pageSlugError });
        }
        validatedData.pageSlugs = mergedPageSlugs;
      }
      const settings = await storage.updateCompanySettings(validatedData);
      res.json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation error', errors: err.errors });
      }
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // ===============================
  // Form Config
  // ===============================

  app.get('/api/form-config', async (req, res) => {
    try {
      // Compat shim (Milestone 3 Phase 1): read from the default form instead
      // of the legacy company_settings.formConfig column.
      const defaultForm = await storage.ensureDefaultForm();
      const existing = (defaultForm.config as FormConfig | null) || DEFAULT_FORM_CONFIG;
      const spec = DEFAULT_FORM_CONFIG;
      const specById = new Map(spec.questions.map(q => [q.id, q]));

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

      for (const specQ of spec.questions) {
        if (!normalizedQuestions.some(q => q.id === specQ.id)) {
          normalizedQuestions.push({ ...specQ });
        }
      }

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
      setPublicCache(res, 300);
      res.json(normalizedConfig);
    } catch (err) {
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.put('/api/form-config', requireAdmin, async (req, res) => {
    try {
      const config = req.body as FormConfig;

      if (!config.questions || !Array.isArray(config.questions)) {
        return res.status(400).json({ message: 'Invalid config: questions array required' });
      }

      const maxScore = calculateMaxScore(config);
      const updatedConfig: FormConfig = { ...config, maxScore };

      // Compat shim: write to the default form row.
      const defaultForm = await storage.ensureDefaultForm();
      await storage.updateForm(defaultForm.id, { config: updatedConfig });
      res.json(updatedConfig);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // ===============================
  // Form Leads
  // ===============================

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
      // Compat shim (M3-01): legacy endpoint routes to the default form.
      const defaultForm = await storage.ensureDefaultForm();
      const formConfig = (defaultForm.config as FormConfig | null) || DEFAULT_FORM_CONFIG;
      const settings = await storage.getCompanySettings();
      const companyName = settings?.companyName || 'Company Name';
      const totalQuestions = formConfig.questions.length || DEFAULT_FORM_CONFIG.questions.length;
      const questionNumber = Math.min(parsed.questionNumber, totalQuestions);
      const payload = {
        ...parsed,
        questionNumber,
        formCompleto: parsed.formCompleto || questionNumber >= totalQuestions,
      };
      let lead = await storage.upsertFormLeadProgress(
        payload,
        { userAgent: req.get('user-agent') || undefined, formId: defaultForm.id },
        formConfig,
      );

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
          if (ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.locationId && lead.telefone) {
            const nameParts = (lead.nome || '').trim().split(' ').filter(Boolean);
            const firstName = nameParts.shift() || lead.nome || 'Lead';
            const lastName = nameParts.join(' ');

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
              const synced = await storage.updateFormLead(lead.id, { ghlContactId: contactResult.contactId, ghlSyncStatus: 'synced' });
              if (synced) lead = synced;
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
          if (existing) return res.json(existing);
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
      res.status(500).json({ message: (err as Error).message });
    }
  });

  app.delete('/api/form-leads/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid lead id' });
    const deleted = await storage.deleteFormLead(id);
    if (!deleted) return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Lead deleted' });
  });

  // ===============================
  // Sitemap & Robots
  // ===============================

  app.get('/sitemap_index.xml', (req, res) => {
    res.redirect(301, '/sitemap.xml');
  });

  app.get('/robots.txt', async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      const hostname = req.hostname || '';
      const canonicalUrl =
        settings?.seoCanonicalUrl ||
        `${req.protocol}://${hostname}`;

      const robotsTxt = `User-agent: *\nAllow: /\n\nSitemap: ${canonicalUrl}/sitemap.xml\n`;
      setPublicCache(res, 3600);
      res.type('text/plain').send(robotsTxt);
    } catch (err) {
      res.type('text/plain').send('User-agent: *\nAllow: /');
    }
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      const blogPostsList = await storage.getPublishedBlogPosts(100, 0);
      const pagePaths = buildPagePaths(settings?.pageSlugs);
      const hostname = req.hostname || '';
      const canonicalUrl =
        settings?.seoCanonicalUrl ||
        `${req.protocol}://${hostname}`;
      const lastMod = new Date().toISOString().split('T')[0];
      const publicPages = [
        { path: "/", changefreq: "weekly", priority: "1.0" },
        { path: pagePaths.contact, changefreq: "monthly", priority: "0.8" },
        { path: pagePaths.faq, changefreq: "monthly", priority: "0.7" },
        { path: pagePaths.portfolio, changefreq: "weekly", priority: "0.8" },
        { path: pagePaths.privacyPolicy, changefreq: "yearly", priority: "0.5" },
        { path: pagePaths.termsOfService, changefreq: "yearly", priority: "0.5" },
        { path: pagePaths.thankYou, changefreq: "monthly", priority: "0.6" },
        { path: pagePaths.blog, changefreq: "weekly", priority: "0.8" },
        { path: pagePaths.links, changefreq: "monthly", priority: "0.6" },
      ];

      let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicPages.map((page) => `  <url>
    <loc>${canonicalUrl}${page.path}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}`;

      for (const post of blogPostsList) {
        const postDate = post.updatedAt ? new Date(post.updatedAt).toISOString().split('T')[0] : lastMod;
        sitemap += `
  <url>
    <loc>${canonicalUrl}${pagePaths.blogPost(post.slug)}</loc>
    <lastmod>${postDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
      }

      sitemap += `\n</urlset>`;

      setPublicCache(res, 3600);
      res.type('application/xml').send(sitemap);
    } catch (err) {
      res.status(500).send('Error generating sitemap');
    }
  });
}
