import 'dotenv/config';
import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { setupSupabaseAuth } from "../server/auth/supabaseAuth.js";
import { registerXpotRoutes } from "../server/routes/xpot/index.js";

let app: express.Express | null = null;
let initPromise: Promise<express.Express> | null = null;

async function getApp() {
  if (app) return app;

  if (!initPromise) {
    initPromise = (async () => {
      const expressApp = express();
      expressApp.set("trust proxy", 1);
      expressApp.use(express.json({ limit: '50mb', verify: (_req, _res, buf) => { (_req as any).rawBody = buf; } }));
      expressApp.use(express.urlencoded({ extended: false, limit: '50mb' }));
      await setupSupabaseAuth(expressApp);
      registerXpotRoutes(expressApp);
      return expressApp;
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }

  return initPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const expressApp = await getApp();
  return expressApp(req as any, res as any);
}
