import { storage } from "../../storage.js";
import { getActiveAIClient, getRuntimeGroqKey } from "../../lib/ai-provider.js";
import { getOrCreateGHLContact, createGHLOpportunity, updateGHLOpportunity, createGHLTask } from "../../integrations/ghl.js";
import { z } from "zod";

const visitAudioAnalysisSchema = z.object({
  summary: z.string().trim().max(1500).nullable().optional(),
  outcome: z.string().trim().max(300).nullable().optional(),
  nextStep: z.string().trim().max(300).nullable().optional(),
  sentiment: z.string().trim().max(100).nullable().optional(),
  objections: z.string().trim().max(600).nullable().optional(),
  competitorMentioned: z.string().trim().max(200).nullable().optional(),
  followUpRequired: z.boolean().optional(),
});

export type VisitAudioAnalysis = z.infer<typeof visitAudioAnalysisSchema>;

function buildVisitAudioAnalysisPrompt(transcript: string) {
  return `You analyze short field-sales voice notes recorded after an in-person visit.

Return ONLY a valid JSON object with these keys:
- summary: short visit summary in the same language as the transcript
- outcome: brief result of the visit
- nextStep: concrete next step if one is mentioned or clearly implied
- sentiment: one of positive, neutral, negative, or mixed
- objections: short description of objections or blockers, or null
- competitorMentioned: competitor name if explicitly mentioned, otherwise null
- followUpRequired: true if the rep should follow up, otherwise false

Rules:
- Do not invent facts.
- If a field is not supported by the transcript, use null.
- Keep summary under 3 sentences.
- Keep outcome and nextStep concise.
- Return raw JSON only, with no markdown.

Transcript:
"""${transcript}"""`;
}

function parseVisitAudioAnalysis(content: string | null | undefined): VisitAudioAnalysis | null {
  if (!content) return null;

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return visitAudioAnalysisSchema.parse(JSON.parse(jsonMatch[0]));
  } catch (error) {
    console.error("Failed to parse visit audio analysis:", error);
    return null;
  }
}

export async function analyzeVisitTranscript(transcript: string): Promise<VisitAudioAnalysis | null> {
  const cleanedTranscript = transcript.trim();
  if (!cleanedTranscript) return null;

  const prompt = buildVisitAudioAnalysisPrompt(cleanedTranscript);

  try {
    const aiClient = await getActiveAIClient();
    if (aiClient?.client) {
      const completion = await aiClient.client.chat.completions.create({
        model: aiClient.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });
      const parsed = parseVisitAudioAnalysis(completion.choices[0]?.message?.content);
      if (parsed) return parsed;
    }
  } catch (error) {
    console.error("Active AI provider analysis error:", error);
  }

  const groqIntegration = await storage.getChatIntegration("groq");
  const groqApiKey = getRuntimeGroqKey() || groqIntegration?.apiKey;
  if (!groqApiKey) return null;

  try {
    const Groq = (await import("groq-sdk")).default;
    const groq = new Groq({ apiKey: groqApiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    return parseVisitAudioAnalysis(completion.choices[0]?.message?.content || null);
  } catch (error) {
    console.error("Groq audio analysis error:", error);
    return null;
  }
}

export function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusMeters * c);
}

export async function syncLeadToGhl(leadId: number) {
  const integration = await storage.getIntegrationSettings("gohighlevel");
  if (!integration?.isEnabled || !integration.apiKey || !integration.locationId) {
    return { synced: false, message: "GHL not configured" };
  }

  const lead = await storage.getSalesLead(leadId);
  if (!lead) {
    return { synced: false, message: "Lead not found" };
  }

  if (!lead.email && !lead.phone) {
    await storage.createSalesSyncEvent({
      entityType: "sales_lead",
      entityId: String(lead.id),
      status: "needs_review",
      payload: { reason: "Missing email and phone for GHL sync" },
      lastError: "Missing email and phone for GHL sync",
    });
    return { synced: false, message: "Missing lead email and phone" };
  }

  const [firstName, ...rest] = lead.name.split(" ");
  const syncResult = await getOrCreateGHLContact(integration.apiKey, integration.locationId, {
    email: lead.email || "",
    firstName: firstName || lead.name,
    lastName: rest.join(" ") || lead.legalName || "Lead",
    phone: lead.phone || "",
    address: (await storage.listSalesLeadLocations(lead.id))[0]?.addressLine1,
  });

  if (!syncResult.success || !syncResult.contactId) {
    await storage.createSalesSyncEvent({
      entityType: "sales_lead",
      entityId: String(lead.id),
      status: "failed",
      payload: { leadId: lead.id },
      lastError: syncResult.message || "Failed to sync lead to GHL",
      lastAttemptAt: new Date(),
    });
    return { synced: false, message: syncResult.message || "Failed to sync lead" };
  }

  await storage.updateSalesLead(lead.id, { ghlContactId: syncResult.contactId });
  await storage.createSalesSyncEvent({
    entityType: "sales_lead",
    entityId: String(lead.id),
    status: "synced",
    payload: { ghlContactId: syncResult.contactId },
    lastAttemptAt: new Date(),
  });
  return { synced: true, ghlContactId: syncResult.contactId };
}

export async function syncOpportunityToGhl(opportunityId: number) {
  const integration = await storage.getIntegrationSettings("gohighlevel");
  const appSettings = await storage.getSalesAppSettings();

  if (!integration?.isEnabled || !integration.apiKey || !integration.locationId) {
    return { synced: false, message: "GHL not configured" };
  }

  const opportunity = (await storage.listSalesOpportunities()).find((item) => item.id === opportunityId);
  if (!opportunity) {
    return { synced: false, message: "Opportunity not found" };
  }

  const lead = await storage.getSalesLead(opportunity.leadId);
  if (!lead?.ghlContactId) {
    return { synced: false, message: "Lead is not synced to GHL yet" };
  }

  const pipelineId = opportunity.pipelineKey || appSettings.defaultPipelineKey || undefined;
  const stageId = opportunity.stageKey || appSettings.defaultStageKey || undefined;
  if (!pipelineId || !stageId) {
    return { synced: false, message: "Missing pipeline or stage mapping" };
  }

  if (opportunity.ghlOpportunityId) {
    const updateResult = await updateGHLOpportunity(integration.apiKey, opportunity.ghlOpportunityId, {
      name: opportunity.title,
      monetaryValue: opportunity.value,
      pipelineId,
      pipelineStageId: stageId,
      status: opportunity.status,
    });

    if (!updateResult.success) {
      return { synced: false, message: updateResult.message || "Failed to update opportunity" };
    }

    await storage.updateSalesOpportunity(opportunity.id, { syncStatus: "synced" });
    return { synced: true, ghlOpportunityId: opportunity.ghlOpportunityId };
  }

  const createResult = await createGHLOpportunity(integration.apiKey, integration.locationId, {
    contactId: lead.ghlContactId,
    name: opportunity.title,
    monetaryValue: opportunity.value,
    pipelineId,
    pipelineStageId: stageId,
  });

  if (!createResult.success || !createResult.opportunityId) {
    return { synced: false, message: createResult.message || "Failed to create opportunity" };
  }

  await storage.updateSalesOpportunity(opportunity.id, {
    ghlOpportunityId: createResult.opportunityId,
    syncStatus: "synced",
  });

  return { synced: true, ghlOpportunityId: createResult.opportunityId };
}

export async function syncTaskToGhl(taskId: number) {
  const integration = await storage.getIntegrationSettings("gohighlevel");
  
  if (!integration?.isEnabled || !integration.apiKey || !integration.locationId) {
    return { synced: false, message: "GHL not configured" };
  }

  const task = (await storage.listSalesTasks()).find((t) => t.id === taskId);
  if (!task) {
    return { synced: false, message: "Task not found" };
  }

  if (task.ghlTaskId) {
    return { synced: true, ghlTaskId: task.ghlTaskId };
  }

  let contactId: string | undefined;
  if (task.leadId) {
    const lead = await storage.getSalesLead(task.leadId);
    contactId = lead?.ghlContactId || undefined;
  }

  const createResult = await createGHLTask(integration.apiKey, integration.locationId, {
    name: task.title,
    description: task.description || undefined,
    dueDate: task.dueAt ? new Date(task.dueAt).toISOString() : undefined,
    contactId,
  });

  if (!createResult.success || !createResult.taskId) {
    return { synced: false, message: createResult.message || "Failed to create task in GHL" };
  }

  await storage.updateSalesTask(task.id, { status: "pending" });

  return { synced: true, ghlTaskId: createResult.taskId };
}
