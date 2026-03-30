import { Router } from "express";
import { storage } from "../../storage.js";
import { requireXpotUser, ensureXpotRep } from "./middleware.js";
import { syncAccountToGhl } from "./helpers.js";
import { xpotAccountCreateSchema, xpotAccountUpdateSchema, xpotAccountContactCreateSchema } from "#shared/xpot.js";

export function createAccountsRouter() {
  const router = Router();
  router.use(requireXpotUser);

  router.get("/accounts", async (req, res) => {
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

  router.post("/accounts", async (req, res) => {
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

  router.get("/accounts/:id", async (req, res) => {
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

  router.patch("/accounts/:id", async (req, res) => {
    const accountId = Number(req.params.id);
    const input = xpotAccountUpdateSchema.parse(req.body);
    const updated = await storage.updateSalesAccount(accountId, input);

    if (!updated) {
      return res.status(404).json({ message: "Account not found" });
    }

    const syncResult = await syncAccountToGhl(accountId);
    res.json({ account: updated, ghl: syncResult });
  });

  router.get("/accounts/:id/contacts", async (req, res) => {
    const accountId = Number(req.params.id);
    res.json(await storage.listSalesAccountContacts(accountId));
  });

  router.post("/accounts/:id/contacts", async (req, res) => {
    const accountId = Number(req.params.id);
    const input = xpotAccountContactCreateSchema.parse(req.body);
    const contact = await storage.createSalesAccountContact({ ...input, accountId });
    res.status(201).json(contact);
  });

  return router;
}
