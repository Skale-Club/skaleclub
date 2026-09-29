import type { Express, Request } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { systemHeartbeats } from "#shared/schema.js";
import { insertCompanySettingsSchema, normalizeSocialLinks } from "#shared/schema.js";
import type { LeadClassification, LeadStatus } from "#shared/schema.js";
import { storage } from "../storage.js";
import { api } from "#shared/routes.js";
import { getPageSlugsValidationError, resolvePageSlugs } from "#shared/pageSlugs.js";
import { buildSitemapXml, collectSitemapUrls } from "../seo/sitemap.js";
import { requireAdmin, sendError, setPublicCache, isAuthorizedCronRequest } from "./_shared.js";

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
      let heartbeat: { id: number; createdAt: Date | null } | null = null;
      let heartbeatLogged = false;
      let heartbeatWarning: string | null = null;

      try {
        [heartbeat] = await db
          .insert(systemHeartbeats)
          .values({
            source: 'github-actions',
            note: 'supabase-keepalive',
          })
          .returning({
            id: systemHeartbeats.id,
            createdAt: systemHeartbeats.createdAt,
          });
        heartbeatLogged = true;
      } catch (heartbeatError) {
        heartbeatWarning = (heartbeatError as Error).message;
        console.warn('[supabase-keepalive] Heartbeat logging failed:', heartbeatWarning);
      }

      return res.json({
        ok: true,
        databasePing: true,
        heartbeatLogged,
        heartbeatId: heartbeat?.id ?? null,
        createdAt: heartbeat?.createdAt ?? null,
        ...(heartbeatWarning ? { heartbeatWarning } : {}),
      });
    } catch (error) {
      console.error('[company] supabase keepalive failed:', error);
      return res.status(500).json({
        ok: false,
        message: 'Health check failed',
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
      // The column is jsonb and older writes were not shape-checked, so it can
      // hold `{}`. Normalizing here means every consumer gets an array without
      // each one having to guard, and without a data migration first.
      res.json({
        ...settings,
        socialLinks: normalizeSocialLinks(settings.socialLinks),
      });
    } catch (err) {
      console.error('[company] GET /api/company-settings failed:', err);
      res.status(500).json({ message: 'Failed to load company settings' });
    }
  });

  app.put('/api/company-settings', requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCompanySettingsSchema.partial().parse(req.body);
      if (validatedData.socialLinks) {
        validatedData.socialLinks = normalizeSocialLinks(validatedData.socialLinks);
      }
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
      sendError(res, err, "Failed to update company settings");
    }
  });

  // ===============================
  // Form Leads
  // ===============================

  // requireAdmin: this returned the whole form_leads row — admin notes
  // (`observacoes`), classification, status, phone and email — to anyone
  // holding a session UUID. No client code calls it (the admin panel works by
  // numeric id), so gating it costs nothing.
  app.get('/api/form-leads/:sessionId', requireAdmin, async (req, res) => {
    const lead = await storage.getFormLeadBySession(req.params.sessionId);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    res.json(lead);
  });

  app.get('/api/form-leads', requireAdmin, async (req, res) => {
    try {
      const parsed = api.formLeads.list.input ? api.formLeads.list.input.parse(req.query) : {};
      const filters = (parsed || {}) as { status?: LeadStatus; classificacao?: LeadClassification; formCompleto?: boolean; completionStatus?: 'completo' | 'em_progresso' | 'abandonado'; search?: string; formId?: number };
      console.log('[form-leads] query:', req.query, 'parsed filters:', filters);
      const leads = await storage.listFormLeads(filters);
      res.json(leads);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid filters', errors: err.errors });
      }
      sendError(res, err, "Failed to load form leads");
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
      console.error('[company] PUT /api/form-leads/:id failed:', err);
      res.status(500).json({ message: 'Failed to update lead' });
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

  // The setting is the homepage's canonical ("https://skale.club/"), so its
  // trailing slash doubled every URL built on it ("https://skale.club//faq").
  // Reduce it to an origin, the same way use-seo.ts does on the client.
  function canonicalOrigin(setting: string | null | undefined, req: Request): string {
    if (setting) {
      try {
        return new URL(setting).origin;
      } catch {
        // Malformed value in settings — the request's own host is the better guess.
      }
    }
    return `${req.protocol}://${req.hostname || ''}`;
  }

  app.get('/sitemap_index.xml', (req, res) => {
    res.redirect(301, '/sitemap.xml');
  });


  // /e/ and /p/ stay crawlable on purpose: crawlers have to fetch them to read
  // their noindex header and meta tag instead of listing them from links alone.
  app.get('/robots.txt', async (req, res) => {
    const disallow = ['/admin', '/oauth', '/print', '/api'].map((path) => `Disallow: ${path}`).join('\n');
    try {
      const settings = await storage.getCompanySettings();
      const canonicalUrl = canonicalOrigin(settings?.seoCanonicalUrl, req);

      const robotsTxt = `User-agent: *\nAllow: /\n${disallow}\n\nSitemap: ${canonicalUrl}/sitemap.xml\n`;
      setPublicCache(res, 3600);
      res.type('text/plain').send(robotsTxt);
    } catch (err) {
      res.type('text/plain').send(`User-agent: *\nAllow: /\n${disallow}\n\nSitemap: ${req.protocol}://${req.hostname}/sitemap.xml\n`);
    }
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const [settings, pages, posts] = await Promise.all([
        storage.getCompanySettings(),
        storage.listPages(),
        storage.getPublishedBlogPosts(1000, 0),
      ]);
      const urls = collectSitemapUrls({ pageSlugs: settings?.pageSlugs, pages, posts });
      const sitemap = buildSitemapXml(canonicalOrigin(settings?.seoCanonicalUrl, req), urls);

      setPublicCache(res, 3600);
      res.type('application/xml').send(sitemap);
    } catch (err) {
      console.error('[company] sitemap generation failed:', err);
      res.status(500).send('Error generating sitemap');
    }
  });
}
