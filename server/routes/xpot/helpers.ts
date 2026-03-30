import { storage } from "../../storage.js";
import { getOrCreateGHLContact, createGHLOpportunity, updateGHLOpportunity, createGHLTask } from "../../integrations/ghl.js";

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

export async function syncAccountToGhl(accountId: number) {
  const integration = await storage.getIntegrationSettings("gohighlevel");
  if (!integration?.isEnabled || !integration.apiKey || !integration.locationId) {
    return { synced: false, message: "GHL not configured" };
  }

  const account = await storage.getSalesAccount(accountId);
  if (!account) {
    return { synced: false, message: "Account not found" };
  }

  if (!account.email && !account.phone) {
    await storage.createSalesSyncEvent({
      entityType: "sales_account",
      entityId: String(account.id),
      status: "needs_review",
      payload: { reason: "Missing email and phone for GHL sync" },
      lastError: "Missing email and phone for GHL sync",
    });
    return { synced: false, message: "Missing account email and phone" };
  }

  const [firstName, ...rest] = account.name.split(" ");
  const syncResult = await getOrCreateGHLContact(integration.apiKey, integration.locationId, {
    email: account.email || "",
    firstName: firstName || account.name,
    lastName: rest.join(" ") || account.legalName || "Account",
    phone: account.phone || "",
    address: (await storage.listSalesAccountLocations(account.id))[0]?.addressLine1,
  });

  if (!syncResult.success || !syncResult.contactId) {
    await storage.createSalesSyncEvent({
      entityType: "sales_account",
      entityId: String(account.id),
      status: "failed",
      payload: { accountId: account.id },
      lastError: syncResult.message || "Failed to sync account to GHL",
      lastAttemptAt: new Date(),
    });
    return { synced: false, message: syncResult.message || "Failed to sync account" };
  }

  await storage.updateSalesAccount(account.id, { ghlContactId: syncResult.contactId });
  await storage.createSalesSyncEvent({
    entityType: "sales_account",
    entityId: String(account.id),
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

  const account = await storage.getSalesAccount(opportunity.accountId);
  if (!account?.ghlContactId) {
    return { synced: false, message: "Account is not synced to GHL yet" };
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
    contactId: account.ghlContactId,
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
  if (task.accountId) {
    const account = await storage.getSalesAccount(task.accountId);
    contactId = account?.ghlContactId || undefined;
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
