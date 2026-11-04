import express from "express";
import { ContractService } from "../../../contracts/service.js";
import { MemoryContractStore } from "../../../contracts/__tests__/memoryStore.js";
import { registerContractRoutes } from "../../contracts.js";

export function createContractsHarness({ alwaysAdmin = false } = {}) {
  const store = new MemoryContractStore();
  const mail: { to: string[]; subject: string; body: string }[] = [];
  const service = new ContractService(store, {
    secret: () => "test-contract-signing-secret-at-least-32-chars",
    mail: async (to, subject, body) => {
      mail.push({ to, subject, body });
      return true;
    },
  });
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req, _res, next) => {
    (req as unknown as { session: object }).session = { userId: "test-admin" };
    next();
  });
  registerContractRoutes(app, service, (req, res, next) => {
    if (alwaysAdmin || req.get("x-test-admin") === "1") next();
    else res.status(401).json({ message: "Authentication required" });
  });
  return { app, service, store, mail };
}
