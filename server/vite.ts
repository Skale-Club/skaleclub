import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { buildShell } from "./seo/shell.js";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      // The same head, body and status production serves (server/seo/shell.ts), so a
      // dev-only shell cannot drift from the real one.
      const pathname = url.split("?", 1)[0];
      const shell = await buildShell({ template, pathname, vite, dev: true });
      if (shell.redirect) return res.redirect(301, shell.redirect + url.slice(pathname.length));
      const page = await vite.transformIndexHtml(url, shell.html);
      if (shell.noindex || shell.status === 404) res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.status(shell.status).set({ "Content-Type": "text/html", "Cache-Control": shell.cacheControl }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
