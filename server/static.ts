import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Missing hashed assets (e.g. a stale tab requests an old chunk after deploy)
  // must 404 cleanly — otherwise the SPA fallback below would return index.html
  // with text/html, and the browser would reject the module script with
  // "Expected a JavaScript-or-Wasm module script but the server responded with
  // a MIME type of text/html". The client catches the 404 and reloads.
  app.use("/assets/", (_req: Request, res: Response) => {
    res.status(404).type("text/plain").send("asset not found");
  });

  // Fall through to index.html for actual SPA routes (no extension / known UI paths).
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
