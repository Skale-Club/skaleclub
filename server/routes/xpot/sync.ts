import { Router } from "express";
import { storage } from "../../storage.js";
import { requireXpotUser } from "./middleware.js";
import { syncAccountToGhl, syncOpportunityToGhl, syncTaskToGhl } from "./helpers.js";

export function createSyncRouter() {
  const router = Router();
  router.use(requireXpotUser);

  router.post("/sync/flush", async (_req, res) => {
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

  return router;
}
