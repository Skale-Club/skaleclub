import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../server/app.js";
import type express from "express";

let app: express.Express | null = null;
let initPromise: Promise<express.Express> | null = null;

async function getApp() {
  if (app) return app;

  if (!initPromise) {
    initPromise = createApp()
      .then((result) => {
        app = result.app;

        // SPA fallback for single-segment paths routed here by Vercel rewrites.
        // When the redirect resolver finds no DB record it calls next(), and this
        // serves index.html so the React router can render the correct page.
        // Use process.cwd() (the Vercel function root, /vercel/path0) — this is
        // an ES module, so __dirname is not defined. Matches server/app.ts.
        const indexPath = path.join(process.cwd(), 'dist', 'public', 'index.html');
        app.use((_req: any, res: any) => {
          if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
          } else {
            res.status(404).send('Not found');
          }
        });

        return app;
      })
      .catch((err) => {
        // Reset so next request retries initialization
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
