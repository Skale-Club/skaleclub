import type { Express } from "express";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "../storage.js";
import { insertFormSchema, updateFormSchema, formLeadProgressSchema } from "#shared/schema.js";
import { calculateMaxScore, DEFAULT_FORM_CONFIG, validateFormConfig } from "#shared/form.js";
import type { FormConfig } from "#shared/schema.js";
import { requireAdmin, sendError, setPublicCache } from "./_shared.js";
import { runLeadPostProcessing } from "../lib/lead-processing.js";
import { buildXphereBookingUrl } from "../integrations/xphere.js";
import { summarizeFormTranscript, transcribeFormAudio } from "../lib/form-audio.js";
import { rateLimitMiddleware } from "../lib/rateLimit.js";
import { SupabaseStorageService } from "../storage/supabaseStorage.js";

const SKALE_HUB_GROUP_FORM_SLUG = "skale-hub";

const uploadStorage = new SupabaseStorageService();

// Extension allowlist for public form uploads. SVG is excluded on purpose —
// see the note on the upload route below.
const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

// Throttle shared by every public (unauthenticated) lead endpoint.
// What a visitor may read back about their own lead. The full row carries
// admin-only columns (observacoes, status, ghlContactId, contact details) that
// anyone holding the sessionId must not be able to fetch.
function publicLeadView(
  lead: { id: number; sessionId: string | null; formCompleto: boolean | null; ultimaPerguntaRespondida: number | null; classificacao: string | null; scoreTotal: number | null },
  bookingUrl?: string | null,
) {
  return {
    id: lead.id,
    sessionId: lead.sessionId,
    formCompleto: lead.formCompleto,
    ultimaPerguntaRespondida: lead.ultimaPerguntaRespondida,
    classificacao: lead.classificacao,
    scoreTotal: lead.scoreTotal,
    ...(bookingUrl ? { bookingUrl } : {}),
  };
}

const publicLeadRateLimit = rateLimitMiddleware({
  limit: 120,
  windowMs: 10 * 60_000,
  message: "Too many form requests. Please try again in a few minutes.",
});

const skaleHubGroupLeadSchema = z.object({
  phone: z.string().trim().min(7).max(20),
  name: z.string().trim().min(3).max(100).optional(),
  urlOrigem: z.string().max(500).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
});

const SKALE_HUB_GROUP_FORM_CONFIG: FormConfig = {
  questions: [
    {
      id: "telefone",
      order: 1,
      title: "WhatsApp phone",
      type: "tel",
      required: true,
      placeholder: "(555) 123-4567",
    },
  ],
  maxScore: 0,
  thresholds: DEFAULT_FORM_CONFIG.thresholds,
};

async function ensureSkaleHubGroupForm() {
  const existing = await storage.getFormBySlug(SKALE_HUB_GROUP_FORM_SLUG);
  if (existing) {
    if (!existing.isActive) {
      return await storage.updateForm(existing.id, { isActive: true });
    }
    return existing;
  }

  try {
    return await storage.createForm({
      slug: SKALE_HUB_GROUP_FORM_SLUG,
      name: "Skale Hub Group",
      description: "Phone capture landing page for Skale Hub ads.",
      isActive: true,
      isDefault: false,
      config: SKALE_HUB_GROUP_FORM_CONFIG,
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      const form = await storage.getFormBySlug(SKALE_HUB_GROUP_FORM_SLUG);
      if (form) return form;
    }
    throw err;
  }
}

export function registerFormRoutes(app: Express) {
  // Ensure the Skale Hub group form exists in the DB at startup so it always
  // appears in the admin Forms panel, even before the first lead submits.
  ensureSkaleHubGroupForm().catch((err) =>
    console.warn("[forms] Could not pre-create skale-hub form:", err?.message)
  );

  // ──────────────────────────────────────────────────────────
  // Admin: list / CRUD
  // ──────────────────────────────────────────────────────────

  // List all forms. ?includeInactive=true to include archived.
  app.get("/api/forms", requireAdmin, async (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === "true";
      const list = await storage.listForms(includeInactive);

      // Enrich each form with its lead count (cheap — one query per form).
      const enriched = await Promise.all(
        list.map(async (f) => ({
          ...f,
          _leadCount: await storage.countLeadsForForm(f.id),
        })),
      );

      res.json(enriched);
    } catch (err) {
      console.error("[forms]", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // List leads for a form (admin), paginated.
  app.get("/api/forms/:id/leads", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;

      const form = await storage.getForm(id);
      if (!form) return res.status(404).json({ message: "Form not found" });

      const result = await storage.listLeadsForForm(id, limit, offset);
      res.json(result);
    } catch (err) {
      console.error("[forms]", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Read one form (admin).
  app.get("/api/forms/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

      const form = await storage.getForm(id);
      if (!form) return res.status(404).json({ message: "Form not found" });

      const leadCount = await storage.countLeadsForForm(id);
      res.json({ ...form, _leadCount: leadCount });
    } catch (err) {
      console.error("[forms]", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create a form.
  app.post("/api/forms", requireAdmin, async (req, res) => {
    try {
      // Allow the client to omit `config` for a blank starter form.
      const body = {
        ...req.body,
        config: req.body?.config ?? {
          questions: [],
          maxScore: 0,
          thresholds: DEFAULT_FORM_CONFIG.thresholds,
        },
      };
      const parsed = insertFormSchema.parse(body);
      const configErrors = validateFormConfig(parsed.config, { requireQuestions: parsed.isActive === true });
      if (configErrors.length > 0) {
        return res.status(400).json({ message: "Invalid form configuration", errors: configErrors });
      }

      // Normalize maxScore from the questions if the client didn't compute it.
      const normalizedConfig: FormConfig = {
        ...parsed.config,
        maxScore: calculateMaxScore(parsed.config),
      };

      const created = await storage.createForm({ ...parsed, config: normalizedConfig });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      // Unique violation on slug
      if ((err as any)?.code === "23505") {
        return res.status(409).json({ message: "A form with that slug already exists" });
      }
      sendError(res, err, "Failed to create form");
    }
  });

  // Update a form (config, metadata, active/default flags).
  app.put("/api/forms/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

      const parsed = updateFormSchema.parse(req.body);
      const existing = await storage.getForm(id);
      if (!existing) return res.status(404).json({ message: "Form not found" });

      // Prevent archiving the Skale Hub group form.
      if (existing?.slug === SKALE_HUB_GROUP_FORM_SLUG && parsed.isActive === false) {
        return res.status(400).json({
          message: "Cannot archive the Skale Hub group form — it is required by the landing page.",
        });
      }

      // Recompute maxScore if the caller sent a new config.
      const updates: typeof parsed = { ...parsed };
      if (parsed.config) {
        updates.config = { ...parsed.config, maxScore: calculateMaxScore(parsed.config) };
      }

      const nextConfig = (updates.config ?? existing.config) as FormConfig;
      const nextActive = parsed.isActive ?? existing.isActive;
      const configErrors = validateFormConfig(nextConfig, { requireQuestions: nextActive === true });
      if (configErrors.length > 0) {
        return res.status(400).json({ message: "Invalid form configuration", errors: configErrors });
      }

      const updated = await storage.updateForm(id, updates);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      if ((err as any)?.code === "23505") {
        return res.status(409).json({ message: "A form with that slug already exists" });
      }
      sendError(res, err, "Failed to update form");
    }
  });

  // Delete a form. Default: soft-delete (sets isActive=false).
  // ?force=true → hard-delete, but only when countLeadsForForm(id) === 0.
  app.delete("/api/forms/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

      const form = await storage.getForm(id);
      if (!form) return res.status(404).json({ message: "Form not found" });

      if (form.isDefault) {
        return res.status(400).json({
          message: "Cannot delete the default form. Set another form as default first.",
        });
      }

      if (form.slug === SKALE_HUB_GROUP_FORM_SLUG) {
        return res.status(400).json({
          message: "Cannot delete the Skale Hub group form — it is required by the landing page.",
        });
      }

      const force = req.query.force === "true";
      if (force) {
        const leadCount = await storage.countLeadsForForm(id);
        if (leadCount > 0) {
          return res.status(409).json({
            message: `Form has ${leadCount} lead(s). Archive it instead or remove leads first.`,
            leadCount,
          });
        }
        // For hard delete we still use softDelete since the leads are 0 — but we
        // want the row gone. TODO(M3-05): add explicit hardDeleteForm method.
        // For now, archive covers the behavior; surfacing a true hard delete
        // can wait until M3-05 cleanup.
        await storage.softDeleteForm(id);
        return res.status(204).end();
      }

      await storage.softDeleteForm(id);
      res.status(204).end();
    } catch (err) {
      sendError(res, err, "Failed to delete form");
    }
  });

  // Duplicate a form. Body may override slug/name.
  app.post("/api/forms/:id/duplicate", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

      const body = z
        .object({
          slug: z.string().min(1).max(80).optional(),
          name: z.string().min(1).max(120).optional(),
        })
        .parse(req.body ?? {});

      const copy = await storage.duplicateForm(id, body);
      res.status(201).json(copy);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      sendError(res, err, "Failed to duplicate form");
    }
  });

  // Promote a form to default. Also restores active flag if it was archived.
  app.post("/api/forms/:id/set-default", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

      const form = await storage.getForm(id);
      if (!form) return res.status(404).json({ message: "Form not found" });

      const updated = await storage.setDefaultForm(id);
      res.json(updated);
    } catch (err) {
      sendError(res, err, "Failed to set default form");
    }
  });

  // ──────────────────────────────────────────────────────────
  // Public: resolve a form config by slug (mounted for M3-03)
  // ──────────────────────────────────────────────────────────

  app.get("/api/forms/slug/:slug/config", async (req, res) => {
    try {
      const form = await storage.getFormBySlug(req.params.slug);
      if (!form || !form.isActive) {
        return res.status(404).json({ message: "Form not found" });
      }
      const config = (form.config as FormConfig | null) ?? DEFAULT_FORM_CONFIG;
      setPublicCache(res, 300);
      res.json(config);
    } catch (err) {
      console.error("[forms]", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(
    "/api/forms/skale-hub-group/leads",
    rateLimitMiddleware({
      limit: 30,
      windowMs: 10 * 60_000,
      message: "Too many form requests. Please try again in a few minutes.",
    }),
    async (req, res) => {
    try {
      const parsed = skaleHubGroupLeadSchema.parse(req.body);
      const form = await ensureSkaleHubGroupForm();
      const settings = await storage.getCompanySettings();
      const companyName = settings?.companyName || "Skale Club";

      const initialLead = await storage.upsertFormLeadProgress(
        {
          sessionId: crypto.randomUUID(),
          questionNumber: 1,
          nome: parsed.name || "Skale Hub Visitor",
          telefone: parsed.phone,
          formCompleto: true,
          urlOrigem: parsed.urlOrigem,
          utmSource: parsed.utmSource,
          utmMedium: parsed.utmMedium,
          utmCampaign: parsed.utmCampaign,
          startedAt: new Date().toISOString(),
          customAnswers: {
            skaleHubIntent: "join-group",
            sourcePage: "skale-hub-group",
          },
        },
        {
          userAgent: req.get("user-agent") || undefined,
          formId: form.id,
          source: "skale-hub-group",
        },
        (form.config as FormConfig | null) ?? SKALE_HUB_GROUP_FORM_CONFIG,
      );

      const { lead } = await runLeadPostProcessing(
        initialLead,
        (form.config as FormConfig | null) ?? SKALE_HUB_GROUP_FORM_CONFIG,
        companyName,
        typeof req.body?.__visitorId === 'string' ? req.body.__visitorId : undefined,
      );

      res.status(201).json({ success: true, leadId: lead.id });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors?.[0]?.message || "Validation error" });
      }
      // Public endpoint: never echo the internal error back to the caller.
      console.error("[forms] skale-hub-group lead failed:", err);
      res.status(400).json({ message: "Could not save your data. Please try again." });
    }
  });

  // Public: progressive lead submission for a specific form (by slug). Stamps
  // the lead with the form resolved from the URL slug.
  app.post(
    "/api/forms/slug/:slug/leads/progress",
    publicLeadRateLimit,
    async (req, res) => {
    try {
      const form = await storage.getFormBySlug(req.params.slug);
      if (!form || !form.isActive) {
        return res.status(404).json({ message: "Form not found" });
      }

      const parsed = formLeadProgressSchema.parse(req.body);
      const formConfig = (form.config as FormConfig | null) ?? DEFAULT_FORM_CONFIG;
      const settings = await storage.getCompanySettings();
      const companyName = settings?.companyName || "Company Name";
      const totalQuestions = formConfig.questions.length || DEFAULT_FORM_CONFIG.questions.length;
      const questionNumber = Math.min(parsed.questionNumber, totalQuestions);

      const payload = {
        ...parsed,
        questionNumber,
        // Reaching the last question is not the same as submitting it. The
        // client marks completion only after the explicit Finish action.
        formCompleto: parsed.formCompleto === true,
      };

      const initialLead = await storage.upsertFormLeadProgress(
        payload,
        { userAgent: req.get("user-agent") || undefined, formId: form.id },
        formConfig,
      );

      const { lead, bookingUrl } = await runLeadPostProcessing(
        initialLead,
        formConfig,
        companyName,
        typeof req.body?.__visitorId === 'string' ? req.body.__visitorId : undefined,
        form.slug,
      );
      res.json(publicLeadView(lead, bookingUrl));
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors?.[0]?.message || "Validation error" });
      }
      if (err?.code === "23505") {
        const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
        if (sessionId) {
          const existing = await storage.getFormLeadBySession(sessionId);
          if (existing) {
            // Double-submitted final step: still surface the booking URL so the
            // thank-you CTA appears. No enqueue here — the original request did
            // it, or the sweep's reconcile will.
            if (existing.formCompleto) {
              try {
                const form = await storage.getFormBySlug(req.params.slug);
                const cfg = (form?.config as FormConfig | null) ?? DEFAULT_FORM_CONFIG;
                const xphere = await storage.getXphereSettings();
                const bookingUrl = xphere ? buildXphereBookingUrl(existing, cfg, xphere) : null;
                if (bookingUrl) return res.json(publicLeadView(existing, bookingUrl));
              } catch { /* fall through: respond exactly as before */ }
            }
            return res.json(publicLeadView(existing));
          }
        }
      }
      // Public endpoint: never echo the internal error back to the caller.
      console.error("[forms] progressive lead failed:", err);
      res.status(400).json({ message: "Could not save your data. Please try again." });
    }
    },
  );

  // Public: file attached to a form answer (order-form logo). The question's
  // own `upload` config is the allowlist — a caller cannot widen it by asking.
  //
  // SVG is deliberately absent from EXT_TO_MIME: it is an executable document,
  // and these files are served from the bucket and opened by whoever reviews
  // the order.
  app.post(
    "/api/forms/slug/:slug/upload",
    rateLimitMiddleware({
      limit: 10,
      windowMs: 10 * 60_000,
      message: "Too many uploads. Please try again in a few minutes.",
    }),
    async (req, res) => {
      try {
        const form = await storage.getFormBySlug(req.params.slug);
        if (!form || !form.isActive) {
          return res.status(404).json({ message: "Form not found" });
        }

        const parsed = z
          .object({
            questionId: z.string().min(1).max(120),
            filename: z.string().min(1).max(200),
            data: z.string().min(1),
          })
          .parse(req.body);

        const config = (form.config as FormConfig | null) ?? DEFAULT_FORM_CONFIG;
        const question = config.questions.find((q) => q.id === parsed.questionId);
        if (!question || question.type !== "fileUpload") {
          return res.status(400).json({ message: "This question does not accept files" });
        }

        const allowed = question.upload?.extensions ?? [];
        const maxSizeMb = question.upload?.maxSizeMb ?? 3;
        const ext = (parsed.filename.split(".").pop() || "").toLowerCase();
        const contentType = EXT_TO_MIME[ext];
        if (!allowed.includes(ext) || !contentType) {
          return res.status(415).json({
            message: `Accepted formats: ${allowed.map((e) => e.toUpperCase()).join(", ")}`,
          });
        }

        const base64 = parsed.data.includes(",") ? parsed.data.slice(parsed.data.indexOf(",") + 1) : parsed.data;
        const buffer = Buffer.from(base64, "base64");
        if (buffer.length === 0) {
          return res.status(400).json({ message: "The file appears to be empty" });
        }
        if (buffer.length > maxSizeMb * 1024 * 1024) {
          return res.status(413).json({ message: `Maximum file size: ${maxSizeMb} MB` });
        }

        const url = await uploadStorage.uploadFormAsset(
          buffer,
          form.slug,
          question.id,
          parsed.filename,
          contentType,
        );
        res.status(201).json({ url, filename: parsed.filename });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: "Validation error" });
        }
        console.error("[forms] upload failed:", err);
        res.status(500).json({ message: "Could not upload the file. Please try again." });
      }
    },
  );

  app.post(
    "/api/forms/slug/:slug/audio/transcribe",
    rateLimitMiddleware({
      limit: 10,
      windowMs: 5 * 60_000,
      message: "Too many transcription requests. Please try again in a few minutes.",
    }),
    async (req, res) => {
      try {
        const form = await storage.getFormBySlug(req.params.slug);
        if (!form || !form.isActive) {
          return res.status(404).json({ message: "Form not found" });
        }

        const parsed = z.object({
          audioData: z.string().min(100),
          questionId: z.string().min(1).max(120),
          language: z.string().min(2).max(8).optional(),
        }).parse(req.body);

        const result = await transcribeFormAudio({
          audioData: parsed.audioData,
          language: parsed.language,
        });
        const summary = await summarizeFormTranscript(result.text);

        res.json({
          questionId: parsed.questionId,
          transcript: result.text,
          summary,
          provider: result.provider,
          model: result.model,
        });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: "Validation error", errors: err.errors });
        }
        sendError(res, err, "Failed to transcribe audio");
      }
    },
  );
}
