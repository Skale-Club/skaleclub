import { Router } from "express";
import { storage } from "../../storage.js";
import { requireXpotUser, ensureXpotRep } from "./middleware.js";

export function createAuthRouter() {
  const router = Router();
  router.use(requireXpotUser);

  router.get("/me", async (req, res) => {
    try {
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
    } catch (err) {
      console.error("[GET /api/xpot/me]", err);
      res.status(500).json({ message: (err as Error).message || "Internal server error" });
    }
  });

  return router;
}
