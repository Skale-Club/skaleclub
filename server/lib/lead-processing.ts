// Shared helpers for the public lead-progress endpoint
// (`POST /api/forms/slug/:slug/leads/progress`) and the chat tool-use sites.
// Centralizes post-upsert work (notifications, GHL sync) so behavior stays
// consistent across entry points.

import { storage } from "../storage.js";
import { db } from "../db.js";
import { visitorSessions } from "#shared/schema.js";
import { eq } from "drizzle-orm";
import type { FormConfig, FormLead } from "#shared/schema.js";
import { getOrCreateGHLContact } from "../integrations/ghl.js";
import { dispatchNotification } from "./notifications.js";

type PostProcessResult = {
  lead: FormLead;
};

/**
 * Run the side-effects that follow a lead upsert: SMS notification (when the
 * lead has a phone number and hasn't been notified yet) and GHL contact sync
 * (when the form is complete). Errors in either side-effect are swallowed
 * (best-effort) and the lead is still returned.
 */
export async function runLeadPostProcessing(
  initialLead: FormLead,
  formConfig: FormConfig,
  companyName: string,
  visitorUuid?: string,
): Promise<PostProcessResult> {
  let lead = initialLead;

  // 1) Twilio SMS notification
  const hasPhone = !!lead.telefone?.trim();
  if (hasPhone && !lead.notificacaoEnviada) {
    try {
      await dispatchNotification(storage, 'hot_lead', {
        company: companyName,
        name: lead.nome?.trim() || 'No name',
        phone: lead.telefone?.trim() || 'No phone',
        classification: lead.classificacao || '',
      });
      const updated = await storage.updateFormLead(lead.id, { notificacaoEnviada: true });
      lead = updated || { ...lead, notificacaoEnviada: true };
    } catch (err) {
      console.error("Lead notification error:", err);
    }
  }

  // 2) GHL contact sync on form completion
  if (lead.formCompleto) {
    try {
      const ghlSettings = await storage.getIntegrationSettings("gohighlevel");
      if (ghlSettings?.isEnabled && ghlSettings.apiKey && ghlSettings.locationId && lead.telefone) {
        const nameParts = (lead.nome || "").trim().split(" ").filter(Boolean);
        const firstName = nameParts.shift() || lead.nome || "Lead";
        const lastName = nameParts.join(" ");

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
            email: lead.email || "",
            firstName,
            lastName,
            phone: lead.telefone || "",
            address: lead.cidadeEstado || undefined,
            customFields: customFields.length > 0 ? customFields : undefined,
          },
        );

        if (contactResult.success && contactResult.contactId) {
          const synced = await storage.updateFormLead(lead.id, {
            ghlContactId: contactResult.contactId,
            ghlSyncStatus: "synced",
          });
          if (synced) lead = synced;
        } else if (lead.ghlSyncStatus !== "synced") {
          await storage.updateFormLead(lead.id, { ghlSyncStatus: "failed" });
        }
      }
    } catch (err) {
      console.log("GHL lead sync error (non-blocking):", err);
      try {
        await storage.updateFormLead(lead.id, { ghlSyncStatus: "failed" });
      } catch {
        // ignore best-effort update
      }
    }
  }

  // 3) Marketing attribution (Phase 45) — fire-and-forget.
  // Wrapped so any failure (missing visitor, network blip, FK violation, etc.) cannot
  // bubble up and break the lead-create caller. Logs to console but always returns.
  if (visitorUuid) {
    try {
      const fk = await storage.linkLeadToVisitor(lead.id, visitorUuid);
      if (fk !== null) {
        // Denormalize ft_*/lt_* by fetching the session row (single round-trip).
        const [session] = await db
          .select({
            ftSource: visitorSessions.ftSource,
            ftMedium: visitorSessions.ftMedium,
            ftCampaign: visitorSessions.ftCampaign,
            ftLandingPage: visitorSessions.ftLandingPage,
            ltSource: visitorSessions.ltSource,
            ltMedium: visitorSessions.ltMedium,
            ltCampaign: visitorSessions.ltCampaign,
            ltLandingPage: visitorSessions.ltLandingPage,
          })
          .from(visitorSessions)
          .where(eq(visitorSessions.id, fk));

        await storage.createAttributionConversion({
          visitorId: fk,
          leadId: lead.id,
          conversionType: 'lead_created',
          pagePath: lead.urlOrigem ?? null,
          ftSource: session?.ftSource ?? null,
          ftMedium: session?.ftMedium ?? null,
          ftCampaign: session?.ftCampaign ?? null,
          ftLandingPage: session?.ftLandingPage ?? null,
          ltSource: session?.ltSource ?? null,
          ltMedium: session?.ltMedium ?? null,
          ltCampaign: session?.ltCampaign ?? null,
          ltLandingPage: session?.ltLandingPage ?? null,
        });
      }
    } catch (err) {
      console.error('[attribution] lead-creation hook failed:', err);
      // Swallow — attribution must NEVER block the lead-create critical path.
    }
  }

  return { lead };
}
