// Shared helpers for the public lead-progress endpoints.
//
// Both `POST /api/form-leads/progress` (legacy/compat shim, default form) and
// `POST /api/forms/:slug/leads/progress` (M3-03, specific form) call
// `runLeadPostProcessing()` after upserting the lead so notifications and
// GHL sync stay identical across entry points.

import { storage } from "../storage.js";
import type { FormConfig, FormLead } from "#shared/schema.js";
import { getOrCreateGHLContact } from "../integrations/ghl.js";
import { sendHotLeadNotification } from "../integrations/twilio.js";

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
): Promise<PostProcessResult> {
  let lead = initialLead;

  // 1) Twilio SMS notification
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

  return { lead };
}
