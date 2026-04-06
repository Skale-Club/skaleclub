import { Router } from "express";
import { storage } from "../../storage.js";
import { requireXpotUser, ensureXpotRep } from "./middleware.js";
import { syncLeadToGhl } from "./helpers.js";
import { xpotLeadCreateSchema, xpotLeadUpdateSchema, xpotLeadContactCreateSchema } from "#shared/xpot.js";

export function createLeadsRouter() {
  const router = Router();
  router.use(requireXpotUser);

  router.get("/leads", async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const ownerRepId = actor!.user.isAdmin && req.query.all === "true" ? undefined : actor!.rep.id;
    const leads = await storage.listSalesLeads({ ownerRepId, search });

    const enriched = await Promise.all(leads.map(async (lead) => ({
      ...lead,
      locations: await storage.listSalesLeadLocations(lead.id),
      contacts: await storage.listSalesLeadContacts(lead.id),
      openOpportunities: (await storage.listSalesOpportunities({ leadId: lead.id, status: "open" })).length,
    })));

    res.json(enriched);
  });

  router.post("/leads", async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const input = xpotLeadCreateSchema.parse(req.body);

    const lead = await storage.createSalesLead({
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
      socialUrls: input.socialUrls,
    });

    if (input.primaryLocation?.addressLine1) {
      await storage.createSalesLeadLocation({
        leadId: lead.id,
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

    const syncResult = await syncLeadToGhl(lead.id);
    const fullLead = await storage.getSalesLead(lead.id);
    res.status(201).json({ lead: fullLead, ghl: syncResult });
  });

  router.get("/leads/:id", async (req, res) => {
    const leadId = Number(req.params.id);
    if (!Number.isFinite(leadId)) {
      return res.status(400).json({ message: "Invalid lead id" });
    }

    const lead = await storage.getSalesLead(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const [locations, contacts, visits, opportunities, tasks] = await Promise.all([
      storage.listSalesLeadLocations(leadId),
      storage.listSalesLeadContacts(leadId),
      storage.listSalesVisits({ leadId }),
      storage.listSalesOpportunities({ leadId }),
      storage.listSalesTasks(),
    ]);

    res.json({
      lead,
      locations,
      contacts,
      visits: visits.slice(0, 10),
      opportunities,
      tasks: tasks.filter((task) => task.leadId === leadId).slice(0, 10),
    });
  });

  router.patch("/leads/:id", async (req, res) => {
    const leadId = Number(req.params.id);
    const input = xpotLeadUpdateSchema.parse(req.body);
    const updated = await storage.updateSalesLead(leadId, input);

    if (!updated) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const syncResult = await syncLeadToGhl(leadId);
    res.json({ lead: updated, ghl: syncResult });
  });

  router.delete("/leads/:id", async (req, res) => {
    const actor = (req as any).xpotActor as Awaited<ReturnType<typeof ensureXpotRep>>;
    const leadId = Number(req.params.id);

    if (!Number.isFinite(leadId)) {
      return res.status(400).json({ message: "Invalid lead id" });
    }

    const lead = await storage.getSalesLead(leadId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const canDelete = actor!.user.isAdmin || lead.ownerRepId === actor!.rep.id;
    if (!canDelete) {
      return res.status(403).json({ message: "You can only delete your own leads" });
    }

    await storage.deleteSalesLead(leadId);
    res.status(204).end();
  });

  router.get("/leads/:id/contacts", async (req, res) => {
    const leadId = Number(req.params.id);
    res.json(await storage.listSalesLeadContacts(leadId));
  });

  router.post("/leads/:id/contacts", async (req, res) => {
    const leadId = Number(req.params.id);
    const input = xpotLeadContactCreateSchema.parse(req.body);
    const contact = await storage.createSalesLeadContact({ ...input, leadId });
    res.status(201).json(contact);
  });

  return router;
}
