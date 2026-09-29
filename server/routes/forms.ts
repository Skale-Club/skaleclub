import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { insertFormSchema, updateFormSchema } from "#shared/schema.js";
import { calculateMaxScore, DEFAULT_FORM_CONFIG, validateFormConfig } from "#shared/form.js";
import type { FormConfig } from "#shared/schema.js";
import { requireAdmin, sendError } from "./_shared.js";
import { SKALE_HUB_GROUP_FORM_SLUG, ensureSkaleHubGroupForm, registerFormPublicRoutes } from "./formsPublic.js";

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

  registerFormPublicRoutes(app);
}
