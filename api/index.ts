import 'dotenv/config';
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../server/app.js";
import type express from "express";

let app: express.Express | null = null;

async function getApp() {
  if (!app) {
    const result = await createApp();
    app = result.app;
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const expressApp = await getApp();
  return expressApp(req as any, res as any);
}
