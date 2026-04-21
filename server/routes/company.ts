import type { Express } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { systemHeartbeats } from "#shared/schema.js";
import { insertCompanySettingsSchema } from "#shared/schema.js";
import type { LeadClassification, LeadStatus } from "#shared/schema.js";
import { storage } from "../storage.js";
import { api } from "#shared/routes.js";
import { buildPagePaths, getPageSlugsValidationError, resolvePageSlugs } from "#shared/pageSlugs.js";
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
  // Form Leads
  // ===============================

  app.get('/api/form-leads/:sessionId', async (req, res) => {
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
