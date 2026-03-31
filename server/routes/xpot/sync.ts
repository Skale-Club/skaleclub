import { Router } from "express";
import { storage } from "../../storage.js";
import { requireXpotUser } from "./middleware.js";
import { syncLeadToGhl, syncOpportunityToGhl, syncTaskToGhl } from "./helpers.js";

export function createSyncRouter() {
  const router = Router();
  router.use(requireXpotUser);

  router.post("/sync/flush", async (_req, res) => {
    const leads = await storage.listSalesLeads();
    const opportunities = await storage.listSalesOpportunities();
    const tasks = await storage.listSalesTasks();

    const leadResults = await Promise.all(leads.filter((lead) => !lead.ghlContactId).map((lead) => syncLeadToGhl(lead.id)));
    const opportunityResults = await Promise.all(opportunities.filter((item) => item.syncStatus !== "synced").map((item) => syncOpportunityToGhl(item.id)));
    const taskResults = await Promise.all(tasks.filter((task) => !task.ghlTaskId && task.status === "pending").map((task) => syncTaskToGhl(task.id)));

    res.json({
      leadsProcessed: leadResults.length,
      leadsSynced: leadResults.filter((item) => item.synced).length,
      opportunitiesProcessed: opportunityResults.length,
      opportunitiesSynced: opportunityResults.filter((item) => item.synced).length,
      tasksProcessed: taskResults.length,
      tasksSynced: taskResults.filter((item) => item.synced).length,
    });
  });

  return router;
}
