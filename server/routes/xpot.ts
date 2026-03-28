import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import {
  xpotAccountContactCreateSchema,
  xpotAccountCreateSchema,
  xpotAccountUpdateSchema,
  xpotCheckInSchema,
  xpotCheckOutSchema,
  xpotOpportunityCreateSchema,
  xpotOpportunityUpdateSchema,
  xpotTaskCreateSchema,
  xpotTaskUpdateSchema,
  xpotVisitNoteUpsertSchema,
} from "#shared/xpot.js";
import { getGHLPipelines, getOrCreateGHLContact, createGHLOpportunity, updateGHLOpportunity, createGHLTask } from "../integrations/ghl.js";

const isReplit = !!process.env.REPL_ID;

type SessionUser = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
};

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
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

async function getCurrentSessionUser(req: Request): Promise<SessionUser | null> {
  if (isReplit) {
    const user = (req as any).user;
    if (!req.isAuthenticated || !req.isAuthenticated() || !user?.claims?.sub) {
      return null;
    }

    return {
      userId: user.claims.sub,
      email: typeof user.claims.email === "string" ? user.claims.email : null,
      firstName: typeof user.claims.first_name === "string" ? user.claims.first_name : null,
      lastName: typeof user.claims.last_name === "string" ? user.claims.last_name : null,
      isAdmin: false,
    };
  }

  const sess = req.session as any;
  if (!sess?.userId) {
    return null;
  }

  return {
    userId: sess.userId,
    email: sess.email ?? null,
    firstName: sess.firstName ?? null,
    lastName: sess.lastName ?? null,
    isAdmin: Boolean(sess.isAdmin),
  };
}

async function ensureXpotRep(req: Request) {
  const user = await getCurrentSessionUser(req);
  if (!user) {
    return null;
  }

  const existingRep = await storage.getSalesRepByUserId(user.userId);
  if (existingRep) {
    return { user, rep: existingRep };
  }

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || "Xpot Rep";
  const rep = await storage.upsertSalesRep({
    userId: user.userId,
    displayName,
    email: user.email,
    role: user.isAdmin ? "admin" : "rep",
    isActive: true,
  });

  return { user, rep };
}

async function requireXpotUser(req: Request, res: Response, next: NextFunction) {
  const actor = await ensureXpotRep(req);
  if (!actor) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!actor.rep.isActive) {
    return res.status(403).json({ message: "Xpot access disabled" });
  }
  (req as any).xpotActor = actor;
  next();
}

async function requireXpotManager(req: Request, res: Response, next: NextFunction) {
  const actor = await ensureXpotRep(req);
  if (!actor) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!actor.user.isAdmin && !["manager", "admin"].includes(actor.rep.role)) {
    return res.status(403).json({ message: "Manager access required" });
  }
  (req as any).xpotActor = actor;
  next();
}

async function syncAccountToGhl(accountId: number) {
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

async function syncOpportunityToGhl(opportunityId: number) {
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

async function syncTaskToGhl(taskId: number) {
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

export function registerXpotRoutes(app: Express) {
  app.get("/api/xpot/place-search", requireXpotUser, async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (query.length < 2) {
      return res.json({ results: [] });
    }

    // First try to get API key from database, then fall back to environment variables
    const googlePlacesSettings = await storage.getIntegrationSettings("google_places");
    let apiKey: string | null = googlePlacesSettings?.isEnabled && googlePlacesSettings.apiKey 
      ? googlePlacesSettings.apiKey 
      : null;
    
    if (!apiKey) {
      apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || null;
    }
    
    if (!apiKey) {
      return res.status(503).json({ message: "Google Places is not configured. Please add API key in Admin > Integrations." });
    }

    const lat = typeof req.query.lat === "string" ? Number(req.query.lat) : undefined;
    const lng = typeof req.query.lng === "string" ? Number(req.query.lng) : undefined;

    const payload: Record<string, unknown> = {
      textQuery: query,
      pageSize: 6,
      languageCode: "en",
      regionCode: "US",
      strictTypeFiltering: false,
    };

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      payload.locationBias = {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius: 15000,
        },
      };
    }

    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.primaryTypeDisplayName",
          "places.websiteUri",
          "places.nationalPhoneNumber",
        ].join(","),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(502).json({ message: errorText || "Google Places search failed" });
    }

    const data = await response.json() as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        primaryTypeDisplayName?: { text?: string };
        websiteUri?: string;
        nationalPhoneNumber?: string;
      }>;
    };

    res.json({
      results: (data.places || []).map((place) => ({
        placeId: place.id || "",
        name: place.displayName?.text || "Unnamed place",
        address: place.formattedAddress || "",
        phone: place.nationalPhoneNumber || "",
        website: place.websiteUri || "",
        primaryType: place.primaryTypeDisplayName?.text || "",
        lat: place.location?.latitude,
        lng: place.location?.longitude,
      })).filter((place) => place.placeId && place.name),
    });
  });

  app.get("/api/xpot/me", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const activeVisit = await storage.getActiveSalesVisitForRep(actor!.rep.id);
    const enrichedVisit = activeVisit
      ? {
          ...activeVisit,
          account: await storage.getSalesAccount(activeVisit.accountId),
          note: await storage.getSalesVisitNote(activeVisit.id),
        }
      : null;
    res.json({
      user: actor!.user,
      rep: actor!.rep,
      activeVisit: enrichedVisit,
    });
  });

  app.get("/api/xpot/dashboard", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const [visits, opportunities, tasks, accounts] = await Promise.all([
      storage.listSalesVisits({ repId: actor!.rep.id }),
      storage.listSalesOpportunities({ repId: actor!.rep.id }),
      storage.listSalesTasks({ repId: actor!.rep.id }),
      storage.listSalesAccounts({ ownerRepId: actor!.rep.id }),
    ]);

    const activeVisit = visits.find((visit) => visit.status === "in_progress") || null;
    const completedVisits = visits.filter((visit) => visit.status === "completed");
    const openOpportunities = opportunities.filter((item) => item.status === "open");
    const pendingTasks = tasks.filter((item) => item.status === "pending");

    res.json({
      metrics: {
        visitsToday: visits.filter((visit) => {
          const createdAt = visit.createdAt ? new Date(visit.createdAt) : null;
          const today = new Date();
          return createdAt
            && createdAt.getFullYear() === today.getFullYear()
            && createdAt.getMonth() === today.getMonth()
            && createdAt.getDate() === today.getDate();
        }).length,
        completedVisits: completedVisits.length,
        activeVisit,
        openOpportunities: openOpportunities.length,
        pipelineValue: openOpportunities.reduce((sum, item) => sum + (item.value || 0), 0),
        pendingTasks: pendingTasks.length,
        assignedAccounts: accounts.length,
      },
      recentVisits: await Promise.all(visits.slice(0, 5).map(async (visit) => ({
        ...visit,
        account: await storage.getSalesAccount(visit.accountId),
        note: await storage.getSalesVisitNote(visit.id),
      }))),
      openOpportunities: await Promise.all(openOpportunities.slice(0, 5).map(async (item) => ({
        ...item,
        account: await storage.getSalesAccount(item.accountId),
      }))),
      pendingTasks: pendingTasks.slice(0, 5),
    });
  });

  app.get("/api/xpot/metrics", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [visits, opportunities, tasks] = await Promise.all([
      storage.listSalesVisits({ repId: actor!.rep.id }),
      storage.listSalesOpportunities({ repId: actor!.rep.id }),
      storage.listSalesTasks({ repId: actor!.rep.id }),
    ]);

    const visitsByDay: Record<string, { completed: number; total: number }> = {};
    const opportunitiesByDay: Record<string, { created: number; won: number; value: number }> = {};
    const tasksByDay: Record<string, { created: number; completed: number }> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      visitsByDay[dateKey] = { completed: 0, total: 0 };
      opportunitiesByDay[dateKey] = { created: 0, won: 0, value: 0 };
      tasksByDay[dateKey] = { created: 0, completed: 0 };
    }

    visits.forEach((visit) => {
      if (!visit.createdAt) return;
      const dateKey = new Date(visit.createdAt).toISOString().split("T")[0];
      if (visitsByDay[dateKey]) {
        visitsByDay[dateKey].total++;
        if (visit.status === "completed") {
          visitsByDay[dateKey].completed++;
        }
      }
    });

    opportunities.forEach((opp) => {
      if (!opp.createdAt) return;
      const dateKey = new Date(opp.createdAt).toISOString().split("T")[0];
      if (opportunitiesByDay[dateKey]) {
        opportunitiesByDay[dateKey].created++;
        if (opp.status === "won") {
          opportunitiesByDay[dateKey].won++;
          opportunitiesByDay[dateKey].value += opp.value || 0;
        }
      }
    });

    tasks.forEach((task) => {
      if (!task.createdAt) return;
      const dateKey = new Date(task.createdAt).toISOString().split("T")[0];
      if (tasksByDay[dateKey]) {
        tasksByDay[dateKey].created++;
        if (task.status === "completed") {
          tasksByDay[dateKey].completed++;
        }
      }
    });

    const totalVisits = Object.values(visitsByDay).reduce((sum, d) => sum + d.completed, 0);
    const totalOpportunities = Object.values(opportunitiesByDay).reduce((sum, d) => sum + d.won, 0);
    const totalPipeline = Object.values(opportunitiesByDay).reduce((sum, d) => sum + d.value, 0);
    const totalTasks = Object.values(tasksByDay).reduce((sum, d) => sum + d.completed, 0);

    res.json({
      period: { days, startDate: startDate.toISOString(), endDate: new Date().toISOString() },
      visits: visitsByDay,
      opportunities: opportunitiesByDay,
      tasks: tasksByDay,
      totals: {
        visits: totalVisits,
        opportunities: totalOpportunities,
        pipelineValue: totalPipeline,
        tasksCompleted: totalTasks,
      },
    });
  });

  app.get("/api/xpot/accounts", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const ownerRepId = actor!.user.isAdmin && req.query.all === "true" ? undefined : actor!.rep.id;
    const accounts = await storage.listSalesAccounts({ ownerRepId, search });

    const enriched = await Promise.all(accounts.map(async (account) => ({
      ...account,
      locations: await storage.listSalesAccountLocations(account.id),
      contacts: await storage.listSalesAccountContacts(account.id),
      openOpportunities: (await storage.listSalesOpportunities({ accountId: account.id, status: "open" })).length,
    })));

    res.json(enriched);
  });

  app.post("/api/xpot/accounts", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const input = xpotAccountCreateSchema.parse(req.body);

    const account = await storage.createSalesAccount({
      name: input.name,
      legalName: input.legalName,
      website: input.website,
      phone: input.phone,
      email: input.email,
      industry: input.industry,
      source: input.source || "field",
      status: input.status || "lead",
      ownerRepId: input.ownerRepId || actor!.rep.id,
      territoryName: input.territoryName,
      notes: input.notes,
    });

    if (input.primaryLocation?.addressLine1) {
      await storage.createSalesAccountLocation({
        accountId: account.id,
        label: input.primaryLocation.label || "Main",
        addressLine1: input.primaryLocation.addressLine1,
        addressLine2: input.primaryLocation.addressLine2,
        city: input.primaryLocation.city,
        state: input.primaryLocation.state,
        postalCode: input.primaryLocation.postalCode,
        country: input.primaryLocation.country || "US",
        lat: input.primaryLocation.lat,
        lng: input.primaryLocation.lng,
        geofenceRadiusMeters: input.primaryLocation.geofenceRadiusMeters || 150,
        isPrimary: input.primaryLocation.isPrimary ?? true,
      });
    }

    const syncResult = await syncAccountToGhl(account.id);
    const fullAccount = await storage.getSalesAccount(account.id);
    res.status(201).json({ account: fullAccount, ghl: syncResult });
  });

  app.get("/api/xpot/accounts/:id", requireXpotUser, async (req, res) => {
    const accountId = Number(req.params.id);
    if (!Number.isFinite(accountId)) {
      return res.status(400).json({ message: "Invalid account id" });
    }

    const account = await storage.getSalesAccount(accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const [locations, contacts, visits, opportunities, tasks] = await Promise.all([
      storage.listSalesAccountLocations(accountId),
      storage.listSalesAccountContacts(accountId),
      storage.listSalesVisits({ accountId }),
      storage.listSalesOpportunities({ accountId }),
      storage.listSalesTasks(),
    ]);

    res.json({
      account,
      locations,
      contacts,
      visits: visits.slice(0, 10),
      opportunities,
      tasks: tasks.filter((task) => task.accountId === accountId).slice(0, 10),
    });
  });

  app.patch("/api/xpot/accounts/:id", requireXpotUser, async (req, res) => {
    const accountId = Number(req.params.id);
    const input = xpotAccountUpdateSchema.parse(req.body);
    const updated = await storage.updateSalesAccount(accountId, input);

    if (!updated) {
      return res.status(404).json({ message: "Account not found" });
    }

    const syncResult = await syncAccountToGhl(accountId);
    res.json({ account: updated, ghl: syncResult });
  });

  app.get("/api/xpot/accounts/:id/contacts", requireXpotUser, async (req, res) => {
    const accountId = Number(req.params.id);
    res.json(await storage.listSalesAccountContacts(accountId));
  });

  app.post("/api/xpot/accounts/:id/contacts", requireXpotUser, async (req, res) => {
    const accountId = Number(req.params.id);
    const input = xpotAccountContactCreateSchema.parse(req.body);
    const contact = await storage.createSalesAccountContact({ ...input, accountId });
    res.status(201).json(contact);
  });

  app.get("/api/xpot/visits", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const accountId = typeof req.query.accountId === "string" ? Number(req.query.accountId) : undefined;
    const visits = await storage.listSalesVisits({
      repId: actor!.user.isAdmin && req.query.all === "true" ? undefined : actor!.rep.id,
      accountId,
    });

    const result = await Promise.all(visits.map(async (visit) => ({
      ...visit,
      account: await storage.getSalesAccount(visit.accountId),
      note: await storage.getSalesVisitNote(visit.id),
    })));

    res.json(result);
  });

  app.post("/api/xpot/visits/check-in", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const input = xpotCheckInSchema.parse(req.body);
    const activeVisit = await storage.getActiveSalesVisitForRep(actor!.rep.id);
    if (activeVisit) {
      return res.status(409).json({ message: "Rep already has an active visit" });
    }

    const appSettings = await storage.getSalesAppSettings();
    const account = await storage.getSalesAccount(input.accountId);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const locations = await storage.listSalesAccountLocations(input.accountId);
    const selectedLocation = input.locationId
      ? locations.find((location) => location.id === input.locationId)
      : locations.find((location) => location.isPrimary) || locations[0];

    let validationStatus: "valid" | "outside_geofence" | "gps_unavailable" | "manual_override" = "gps_unavailable";
    let distanceFromTargetMeters: number | undefined;

    if (
      selectedLocation?.lat && selectedLocation?.lng &&
      typeof input.lat === "number" &&
      typeof input.lng === "number"
    ) {
      distanceFromTargetMeters = getDistanceMeters(
        Number(selectedLocation.lat),
        Number(selectedLocation.lng),
        input.lat,
        input.lng,
      );
      const allowedRadius = selectedLocation.geofenceRadiusMeters || appSettings.defaultGeofenceRadiusMeters;
      validationStatus = distanceFromTargetMeters <= allowedRadius ? "valid" : "outside_geofence";
    }

    if (input.manualOverrideReason && appSettings.allowManualOverride) {
      validationStatus = "manual_override";
    }

    if (appSettings.checkInRequiresGps && validationStatus === "outside_geofence" && !input.manualOverrideReason) {
      return res.status(400).json({ message: "Outside geofence. Manual override reason required." });
    }

    const visit = await storage.createSalesVisit({
      repId: actor!.rep.id,
      accountId: account.id,
      locationId: selectedLocation?.id,
      status: "in_progress",
      scheduledAt: null,
      checkedInAt: new Date(),
      checkedOutAt: null,
      durationSeconds: null,
      checkInLat: input.lat?.toString(),
      checkInLng: input.lng?.toString(),
      checkOutLat: null,
      checkOutLng: null,
      distanceFromTargetMeters: distanceFromTargetMeters ?? null,
      gpsAccuracyMeters: input.gpsAccuracyMeters ?? null,
      validationStatus,
      manualOverrideReason: input.manualOverrideReason,
      source: "field-mobile",
    });

    await storage.updateSalesAccount(account.id, {
      lastVisitAt: visit.checkedInAt,
      nextVisitDueAt: null,
    });

    res.status(201).json({ visit, account, location: selectedLocation ?? null });
  });

  app.post("/api/xpot/visits/:id/check-out", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const visitId = Number(req.params.id);
    const input = xpotCheckOutSchema.parse(req.body);
    const visit = await storage.getSalesVisit(visitId);

    if (!visit || visit.repId !== actor!.rep.id) {
      return res.status(404).json({ message: "Visit not found" });
    }

    const checkedOutAt = new Date();
    const checkedInAt = visit.checkedInAt ? new Date(visit.checkedInAt) : checkedOutAt;
    const durationSeconds = Math.max(0, Math.round((checkedOutAt.getTime() - checkedInAt.getTime()) / 1000));

    const updated = await storage.updateSalesVisit(visit.id, {
      status: "completed",
      checkedOutAt,
      durationSeconds,
      checkOutLat: input.lat?.toString(),
      checkOutLng: input.lng?.toString(),
    });

    await storage.updateSalesAccount(visit.accountId, {
      lastVisitAt: checkedOutAt,
    });

    res.json(updated);
  });

  app.patch("/api/xpot/visits/:id/note", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const visitId = Number(req.params.id);
    const input = xpotVisitNoteUpsertSchema.parse(req.body);
    const visit = await storage.getSalesVisit(visitId);

    if (!visit || visit.repId !== actor!.rep.id) {
      return res.status(404).json({ message: "Visit not found" });
    }

    const note = await storage.upsertSalesVisitNote({
      visitId,
      createdByRepId: actor!.rep.id,
      ...input,
    });
    res.json(note);
  });

  app.post("/api/xpot/visits/:id/audio", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const visitId = Number(req.params.id);
    const { audioData, durationSeconds } = req.body;

    const visit = await storage.getSalesVisit(visitId);
    if (!visit || visit.repId !== actor!.rep.id) {
      return res.status(404).json({ message: "Visit not found" });
    }

    if (!audioData) {
      return res.status(400).json({ message: "Audio data is required" });
    }

    try {
      let audioUrl = "";
      const base64Data = audioData.replace(/^data:audio\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const filename = `visit_${visitId}_${Date.now()}.webm`;

      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const path = `audio/${actor!.rep.id}/${filename}`;
        const { error: uploadError } = await supabase.storage.from("uploads").upload(path, buffer, {
          contentType: "audio/webm",
          upsert: true,
        });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
        audioUrl = urlData.publicUrl;
      } else {
        return res.status(503).json({ message: "Storage not configured" });
      }

      const existingNote = await storage.getSalesVisitNote(visitId);
      if (existingNote) {
        const note = await storage.upsertSalesVisitNote({
          visitId,
          createdByRepId: actor!.rep.id,
          audioUrl,
          audioDurationSeconds: durationSeconds || null,
        });
        return res.json(note);
      } else {
        const note = await storage.upsertSalesVisitNote({
          visitId,
          createdByRepId: actor!.rep.id,
          audioUrl,
          audioDurationSeconds: durationSeconds || null,
        });
        return res.json(note);
      }
    } catch (error: any) {
      console.error("Audio upload error:", error);
      res.status(500).json({ message: error.message || "Failed to upload audio" });
    }
  });

  app.get("/api/xpot/opportunities", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const status = typeof req.query.status === "string"
      ? z.enum(["open", "won", "lost", "archived"]).parse(req.query.status)
      : undefined;
    const opportunities = await storage.listSalesOpportunities({
      repId: actor!.user.isAdmin && req.query.all === "true" ? undefined : actor!.rep.id,
      status,
    });

    const result = await Promise.all(opportunities.map(async (item) => ({
      ...item,
      account: await storage.getSalesAccount(item.accountId),
    })));
    res.json(result);
  });

  app.post("/api/xpot/opportunities", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const input = xpotOpportunityCreateSchema.parse(req.body);

    const opportunity = await storage.createSalesOpportunity({
      ...input,
      repId: actor!.rep.id,
      status: "open",
      syncStatus: "pending",
    });

    let syncMessage: string | null = null;
    const syncResult = await syncOpportunityToGhl(opportunity.id);
    if (!syncResult.synced) {
      syncMessage = syncResult.message || "Opportunity saved locally";
      await storage.updateSalesOpportunity(opportunity.id, { syncStatus: "needs_review" });
      await storage.createSalesSyncEvent({
        entityType: "sales_opportunity",
        entityId: String(opportunity.id),
        status: "needs_review",
        payload: { opportunityId: opportunity.id },
        lastError: syncMessage,
        lastAttemptAt: new Date(),
      });
    }

    res.status(201).json({
      opportunity: (await storage.listSalesOpportunities()).find((item) => item.id === opportunity.id),
      ghl: syncResult,
      message: syncMessage,
    });
  });

  app.patch("/api/xpot/opportunities/:id", requireXpotUser, async (req, res) => {
    const opportunityId = Number(req.params.id);
    const input = xpotOpportunityUpdateSchema.parse(req.body);
    const updated = await storage.updateSalesOpportunity(opportunityId, {
      ...input,
      syncStatus: "pending",
    });

    if (!updated) {
      return res.status(404).json({ message: "Opportunity not found" });
    }

    const syncResult = await syncOpportunityToGhl(opportunityId);
    if (!syncResult.synced) {
      await storage.updateSalesOpportunity(opportunityId, { syncStatus: "needs_review" });
      await storage.createSalesSyncEvent({
        entityType: "sales_opportunity",
        entityId: String(opportunityId),
        status: "needs_review",
        payload: { opportunityId },
        lastError: syncResult.message,
        lastAttemptAt: new Date(),
      });
    }

    res.json({
      opportunity: (await storage.listSalesOpportunities()).find((item) => item.id === opportunityId),
      ghl: syncResult,
    });
  });

  app.get("/api/xpot/tasks", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const status = typeof req.query.status === "string"
      ? z.enum(["pending", "completed", "cancelled"]).parse(req.query.status)
      : undefined;
    const tasks = await storage.listSalesTasks({
      repId: actor!.user.isAdmin && req.query.all === "true" ? undefined : actor!.rep.id,
      status,
    });
    res.json(tasks);
  });

  app.post("/api/xpot/tasks", requireXpotUser, async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const input = xpotTaskCreateSchema.parse(req.body);
    const task = await storage.createSalesTask({
      ...input,
      repId: actor!.rep.id,
      status: "pending",
    });

    const syncResult = await syncTaskToGhl(task.id);
    if (syncResult.synced && syncResult.ghlTaskId) {
      await storage.updateSalesTask(task.id, { ghlTaskId: syncResult.ghlTaskId });
    }

    res.status(201).json(task);
  });

  app.patch("/api/xpot/tasks/:id", requireXpotUser, async (req, res) => {
    const taskId = Number(req.params.id);
    const input = xpotTaskUpdateSchema.parse(req.body);
    const task = await storage.updateSalesTask(taskId, input);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json(task);
  });

  app.post("/api/xpot/sync/flush", requireXpotUser, async (_req, res) => {
    const accounts = await storage.listSalesAccounts();
    const opportunities = await storage.listSalesOpportunities();
    const tasks = await storage.listSalesTasks();

    const accountResults = await Promise.all(accounts.filter((account) => !account.ghlContactId).map((account) => syncAccountToGhl(account.id)));
    const opportunityResults = await Promise.all(opportunities.filter((item) => item.syncStatus !== "synced").map((item) => syncOpportunityToGhl(item.id)));
    const taskResults = await Promise.all(tasks.filter((task) => !task.ghlTaskId && task.status === "pending").map((task) => syncTaskToGhl(task.id)));

    res.json({
      accountsProcessed: accountResults.length,
      accountsSynced: accountResults.filter((item) => item.synced).length,
      opportunitiesProcessed: opportunityResults.length,
      opportunitiesSynced: opportunityResults.filter((item) => item.synced).length,
      tasksProcessed: taskResults.length,
      tasksSynced: taskResults.filter((item) => item.synced).length,
    });
  });

  app.get("/api/xpot/admin/overview", requireXpotManager, async (_req, res) => {
    const [reps, accounts, visits, opportunities, tasks, syncEvents] = await Promise.all([
      storage.listSalesReps(),
      storage.listSalesAccounts(),
      storage.listSalesVisits(),
      storage.listSalesOpportunities(),
      storage.listSalesTasks(),
      storage.listSalesSyncEvents(),
    ]);

    res.json({
      reps,
      metrics: {
        activeReps: reps.filter((rep) => rep.isActive).length,
        accounts: accounts.length,
        visitsInProgress: visits.filter((visit) => visit.status === "in_progress").length,
        completedVisits: visits.filter((visit) => visit.status === "completed").length,
        openOpportunities: opportunities.filter((item) => item.status === "open").length,
        pipelineValue: opportunities.filter((item) => item.status === "open").reduce((sum, item) => sum + (item.value || 0), 0),
        pendingTasks: tasks.filter((item) => item.status === "pending").length,
        syncIssues: syncEvents.filter((item) => item.status !== "synced").length,
      },
      latestSyncEvents: syncEvents.slice(0, 10),
    });
  });

  app.get("/api/xpot/admin/reps", requireXpotManager, async (_req, res) => {
    res.json(await storage.listSalesReps());
  });

  app.post("/api/xpot/admin/reps", requireXpotManager, async (req, res) => {
    const input = z.object({
      userId: z.string().min(1),
      displayName: z.string().min(1),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      team: z.string().optional().nullable(),
      role: z.enum(["rep", "manager", "admin"]).default("rep"),
      vcardId: z.number().int().positive().optional().nullable(),
      ghlUserId: z.string().optional().nullable(),
      isActive: z.boolean().default(true),
    }).parse(req.body);

    const rep = await storage.upsertSalesRep(input);
    res.status(201).json(rep);
  });

  app.get("/api/xpot/admin/sync-events", requireXpotManager, async (_req, res) => {
    res.json(await storage.listSalesSyncEvents());
  });

  app.get("/api/xpot/admin/ghl/pipelines", requireXpotManager, async (_req, res) => {
    const integration = await storage.getIntegrationSettings("gohighlevel");
    if (!integration?.isEnabled || !integration.apiKey || !integration.locationId) {
      return res.status(400).json({ message: "GHL integration not configured" });
    }

    const result = await getGHLPipelines(integration.apiKey, integration.locationId);
    if (!result.success) {
      return res.status(502).json({ message: result.message || "Failed to fetch pipelines" });
    }

    res.json(result);
  });
}
